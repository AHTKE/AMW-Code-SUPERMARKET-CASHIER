// Hidden activation system with rotating passwords

const ACTIVATION_KEY = 'pos_device_activated';
const DEVICE_ID_KEY = 'pos_device_id';

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
  return Math.floor(Date.now() / (5 * 60 * 1000));
}

// Generate device ID (unique per browser/device, persisted)
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = String(Math.floor(10000000 + Math.random() * 90000000)); // 8 digits
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// Rotating password (8 chars, changes every 5 min)
export function getCurrentPassword(): string {
  const slot = getTimeSlot();
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

// Rotating SMS code (7 digits, changes every 5 min)
export function getCurrentSmsCode(): string {
  const slot = getTimeSlot();
  const seed = simpleHash(`AMW_SMS_${slot}_CODE`);
  let code = '';
  let s = seed;
  for (let i = 0; i < 7; i++) {
    s = simpleHash(`${s}_${i}_sms`);
    code += String(s % 10);
  }
  return code;
}

// Generate activation code for a specific device
export function generateActivationCode(deviceId: string): string {
  const seed = simpleHash(`AMW_ACTIVATE_${deviceId}_DEVICE`);
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
export function verifyActivationCode(code: string): boolean {
  const deviceId = getDeviceId();
  const expected = generateActivationCode(deviceId);
  return code.trim() === expected;
}
