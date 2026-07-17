// Hidden activation system with rotating passwords
import { normalizeNumericSecret, normalizeSecret } from '@/lib/normalizeSecret';

const ACTIVATION_KEY = 'pos_device_activated';
const DEVICE_ID_KEY = 'pos_device_id';
const TIME_SLOT_MS = 5 * 60 * 1000;
const FAST_CLOCK_SKEW_SLOTS = 12; // 1 hour
const OLD_WINDOWS_CLOCK_SKEW_SLOTS = 288; // 24 hours

// Simple seeded hash for deterministic generation
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Get 5-minute time slot
function getTimeSlot(): number {
  return Math.floor(Date.now() / TIME_SLOT_MS);
}

function getPasswordForSlot(slot: number): string {
  const seed = simpleHash(`AMW_PASS_${slot}_SECRET`);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pass = '';
  let s = seed;
  for (let i = 0; i < 8; i++) {
    s = simpleHash(`${s}_${i}_pass`);
    pass += chars[s % chars.length];
  }
  return pass;
}

function getSmsCodeForSlot(slot: number): string {
  const seed = simpleHash(`AMW_SMS_${slot}_CODE`);
  let code = '';
  let s = seed;
  for (let i = 0; i < 7; i++) {
    s = simpleHash(`${s}_${i}_sms`);
    code += String(s % 10);
  }
  return code;
}

// Generate device ID (unique per browser/device, persisted)
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (id) {
    const normalized = normalizeNumericSecret(id);
    if (normalized && normalized !== id) {
      id = normalized;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
  }
  if (!id) {
    id = String(Math.floor(10000000 + Math.random() * 90000000)); // 8 digits
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// Rotating password (8 chars, changes every 5 min)
export function getCurrentPassword(): string {
  return getPasswordForSlot(getTimeSlot());
}

// Rotating SMS code (7 digits, changes every 5 min)
export function getCurrentSmsCode(): string {
  return getSmsCodeForSlot(getTimeSlot());
}

// Generate activation code for a specific device
export function generateActivationCode(deviceId: string): string {
  const normalizedDeviceId = normalizeNumericSecret(deviceId);
  const seed = simpleHash(`AMW_ACTIVATE_${normalizedDeviceId}_DEVICE`);
  let code = '';
  let s = seed;
  for (let i = 0; i < 8; i++) {
    s = simpleHash(`${s}_${i}_act`);
    code += String(s % 10);
  }
  return code;
}

// Check activation
export function isDeviceActivated(): boolean {
  return localStorage.getItem(ACTIVATION_KEY) === 'true';
}

export function activateDevice() {
  localStorage.setItem(ACTIVATION_KEY, 'true');
}

export function deactivateDevice() {
  localStorage.removeItem(ACTIVATION_KEY);
}

// Verify activation code for current device
export function verifyActivationCode(code: string, visibleDeviceId?: string): boolean {
  const normalizedCode = normalizeNumericSecret(code);
  if (!normalizedCode) return false;

  const candidateDeviceIds = [visibleDeviceId, getDeviceId()]
    .map((id) => normalizeNumericSecret(id))
    .filter((id, index, list): id is string => Boolean(id) && list.indexOf(id) === index);

  return candidateDeviceIds.some((deviceId) => {
    const expected = generateActivationCode(deviceId);
    return normalizedCode === normalizeNumericSecret(expected);
  });
}

// Verify a user-entered rotating password against the current 5-min slot.
// Use this instead of raw `=== getCurrentPassword()` — it normalises the
// input to survive clipboard artefacts on old Windows/Electron builds.
export function verifyRotatingPassword(input: string): boolean {
  const normalizedInput = normalizeSecret(input);
  const normalizedNumericInput = normalizeNumericSecret(input);
  if (!normalizedInput) return false;
  const currentSlot = getTimeSlot();

  const matchesSlot = (slot: number) => {
    if (normalizedInput === normalizeSecret(getPasswordForSlot(slot))) return true;
    // The hidden panel also shows a numeric SMS code. Accepting it here gives
    // old Windows 7/8 devices a safe path that avoids keyboard-layout symbol
    // problems with @ # $ and upper/lowercase letters.
    return Boolean(normalizedNumericInput) && normalizedNumericInput === normalizeNumericSecret(getSmsCodeForSlot(slot));
  };

  // Fast path: normal machines and small clock drift.
  for (let offset = -FAST_CLOCK_SKEW_SLOTS; offset <= FAST_CLOCK_SKEW_SLOTS; offset++) {
    if (matchesSlot(currentSlot + offset)) {
      return true;
    }
  }

  // Windows 7/8 machines with weak CMOS batteries commonly have a wrong clock
  // or timezone/DST offset. This wider fallback only runs after the fast path
  // fails, so current devices stay quick while old PCs stop rejecting a correct
  // password/code from another machine.
  for (let offset = -OLD_WINDOWS_CLOCK_SKEW_SLOTS; offset <= OLD_WINDOWS_CLOCK_SKEW_SLOTS; offset++) {
    if (offset >= -FAST_CLOCK_SKEW_SLOTS && offset <= FAST_CLOCK_SKEW_SLOTS) continue;
    if (matchesSlot(currentSlot + offset)) return true;
  }

  return false;
}
