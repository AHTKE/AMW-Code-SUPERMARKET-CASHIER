// Telegram-based multi-branch sync.
// Each branch uploads a compressed snapshot (as a document) to a private
// Telegram channel where the bot is admin. Telegram bots cannot reliably read
// their own sent channel history through getUpdates, so every upload also
// updates one pinned manifest message. Any device can read that pinned manifest
// with getChat, then download the latest file_id for each branch.
//
// Free forever: uses standard Telegram Bot API only.

import LZString from "lz-string";

export interface TelegramConfig {
  botToken: string;
  chatId: string; // e.g. -1001234567890 (private channel)
  branchId: string; // unique per branch, e.g. "branch-01"
  branchName: string; // display name, e.g. "فرع المهندسين"
  autoSyncMinutes: number; // 0 = manual only
  role: "branch" | "manager" | "both";
  lastSyncAt?: number;
  lastUploadFileId?: string;
  lastUploadTimestamp?: number;
}

export interface BranchSnapshot {
  branchId: string;
  branchName: string;
  timestamp: number;
  data: Record<string, any>;
  messageId: number;
  fileId?: string;
  syncId?: string;
  incomplete?: boolean;
  syncError?: string;
}

const CFG_KEY = "pos_telegram_config";
const MANAGER_CFG_KEY = "pos_telegram_manager_config";
const BRANCHES_CACHE_KEY = "pos_telegram_branches_cache";
const LOCAL_DIRTY_KEY = "pos_telegram_local_dirty_since";
const LAST_REMOTE_APPLIED_KEY = "pos_telegram_last_remote_applied";
const MANIFEST_MARKER = "#POS_BRANCH_MANIFEST_V2";
const CHUNK_MARKER = "#POS_BRANCH_CHUNK_V1";
const MANIFEST_TEXT_LIMIT = 4096;
const TELEGRAM_TEXT_LIMIT = 4096;
const CHUNK_PAYLOAD_SIZE = 3000;
const AUTO_UPLOAD_DEBOUNCE_MS = 150;
const MIN_AUTO_SYNC_INTERVAL_MS = 1_500;
const FAST_BRANCH_PULL_INTERVAL_MS = 1_500;

interface BranchManifestEntry {
  branchId: string;
  branchName: string;
  timestamp: number;
  fileId?: string;
  messageId: number;
  syncId?: string;
  parts?: number;
  transport?: "chunks" | "document";
}

interface BranchManifest {
  messageId?: number;
  updatedAt: number;
  branches: Record<string, BranchManifestEntry>;
}

export const SNAPSHOT_KEYS = [
  "pos_products",
  "pos_sales",
  "pos_expenses",
  "pos_income",
  "pos_cashiers",
  "pos_cashier_sessions",
  "pos_returns",
  "pos_settings",
  "pos_store_info",
  "pos_categories_supermarket",
  "pos_categories_cafe",
  "pos_held_invoices",
  "pos_coupons",
  "pos_product_offers",
  "pos_purchases",
  "pos_global_cashier_permissions",
  "pos_admin_activity_log",
  "pos_used_invoice_numbers",
  "pos_custom_shortcuts",
  "pos_font_config",
  "pos_font_permission_cashier",
  "pos_theme",
  "pos_theme_color",
  "pos_admin_credentials",
];
const ALL_KEYS = SNAPSHOT_KEYS;

const REMOTE_REPLACE_KEYS = new Set([
  "pos_products",
  "pos_cashiers",
  "pos_settings",
  "pos_store_info",
  "pos_categories_supermarket",
  "pos_categories_cafe",
  "pos_coupons",
  "pos_product_offers",
  "pos_global_cashier_permissions",
  "pos_custom_shortcuts",
  "pos_font_config",
  "pos_font_permission_cashier",
  "pos_theme",
  "pos_theme_color",
]);

// Keys that are local-only and must never be synced through Telegram.
const LOCAL_ONLY_KEYS = new Set([
  "pos_manager_credentials",
  "pos_admin_credentials", // each branch keeps its own admin credentials
]);

function collectSnapshotData(
  cfg: TelegramConfig,
  override?: { branchId: string; branchName: string },
): Record<string, any> {
  const branchId = override?.branchId || cfg.branchId;
  const branchName = override?.branchName || cfg.branchName;
  const dataObj: Record<string, any> = {
    _branchId: branchId,
    _branchName: branchName,
    _timestamp: Date.now(),
    _version: "1.0",
  };
  for (const k of ALL_KEYS) {
    if (LOCAL_ONLY_KEYS.has(k)) continue;
    const raw = localStorage.getItem(k);
    if (raw) {
      try {
        dataObj[k] = JSON.parse(raw);
      } catch {
        dataObj[k] = raw;
      }
    }
  }
  return dataObj;
}

function upsertCachedBranch(snapshot: BranchSnapshot) {
  const existing = getCachedBranches();
  const byBranch: Record<string, BranchSnapshot> = {};
  existing.forEach((b) => {
    byBranch[b.branchId] = b;
  });
  const prev = byBranch[snapshot.branchId];
  if (!prev || snapshot.timestamp >= prev.timestamp) byBranch[snapshot.branchId] = snapshot;
  saveCachedBranches(Object.values(byBranch).sort((a, b) => b.timestamp - a.timestamp));
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getTelegramConfig(): TelegramConfig | null {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTelegramConfig(c: TelegramConfig) {
  localStorage.setItem(CFG_KEY, JSON.stringify(c));
}

export function getManagerTelegramConfig(): TelegramConfig | null {
  try {
    const raw = localStorage.getItem(MANAGER_CFG_KEY);
    if (raw) return JSON.parse(raw);
    const branchCfg = getTelegramConfig();
    if (!branchCfg?.botToken || !branchCfg?.chatId) return null;
    return {
      ...branchCfg,
      branchId: "manager",
      branchName: "مدير الفروع",
      autoSyncMinutes: 0,
      role: "manager",
    };
  } catch {
    return null;
  }
}

// True only when this device has an explicit manager telegram config saved
// locally (not synthesised from a branch config). Used by the start screen to
// decide whether the "مدير الفروع" role owns this device.
export function hasManagerTelegramConfigRaw(): boolean {
  try {
    return !!localStorage.getItem(MANAGER_CFG_KEY);
  } catch {
    return false;
  }
}

export function saveManagerTelegramConfig(c: TelegramConfig) {
  localStorage.setItem(
    MANAGER_CFG_KEY,
    JSON.stringify({
      ...c,
      branchId: "manager",
      branchName: "مدير الفروع",
      autoSyncMinutes: 0,
      role: "manager",
    }),
  );
}

export function clearTelegramConfig() {
  localStorage.removeItem(CFG_KEY);
  localStorage.removeItem(BRANCHES_CACHE_KEY);
}

function collectSnapshot(cfg: TelegramConfig): string {
  return JSON.stringify(collectSnapshotData(cfg));
}

function makeSyncId(branchId: string): string {
  return `${branchId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitPayload(payload: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < payload.length; i += CHUNK_PAYLOAD_SIZE) {
    chunks.push(payload.slice(i, i + CHUNK_PAYLOAD_SIZE));
  }
  return chunks.length ? chunks : [""];
}

function parseSnapshotPayload(
  compressed: string,
  fallback: Pick<
    BranchManifestEntry,
    "branchId" | "branchName" | "timestamp" | "messageId" | "fileId" | "syncId"
  >,
): BranchSnapshot {
  const json = LZString.decompressFromBase64(compressed);
  if (!json) throw new Error("فشل فك ضغط البيانات");
  const parsed = JSON.parse(json);
  return {
    branchId: parsed._branchId || fallback.branchId,
    branchName: parsed._branchName || fallback.branchName,
    timestamp: parsed._timestamp || fallback.timestamp,
    data: parsed,
    messageId: fallback.messageId,
    fileId: fallback.fileId,
    syncId: fallback.syncId,
  };
}

async function fetchTelegramFileText(cfg: TelegramConfig, filePath: string): Promise<string> {
  const directUrl = `https://api.telegram.org/file/bot${cfg.botToken}/${filePath}`;
  try {
    const direct = await fetch(directUrl);
    if (direct.ok) return direct.text();
  } catch {
    // Browser CORS/network failures are expected on Telegram file downloads in some environments.
  }

  const proxied = await fetch("/api/public/telegram-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ botToken: cfg.botToken, filePath }),
  });
  if (!proxied.ok) {
    let details = "";
    try {
      const body = await proxied.json();
      details = body?.details || body?.error || "";
    } catch {
      details = await proxied.text().catch(() => "");
    }
    throw new Error(
      `فشل تحميل ملف الفرع من السيرفر: ${proxied.status}${details ? ` — ${details}` : ""}`,
    );
  }
  return proxied.text();
}

function createPlaceholderSnapshot(entry: BranchManifestEntry, error: string): BranchSnapshot {
  return {
    branchId: entry.branchId,
    branchName: entry.branchName,
    timestamp: entry.timestamp,
    messageId: entry.messageId,
    fileId: entry.fileId,
    syncId: entry.syncId,
    incomplete: true,
    syncError: error,
    data: {
      _branchId: entry.branchId,
      _branchName: entry.branchName,
      _timestamp: entry.timestamp,
      _version: "1.0",
      _syncError: error,
    },
  };
}

// ─── Rate limiter (protects the bot from Telegram flood-ban) ───
// Telegram allows ~30 msg/sec globally per bot. Stay well below that and also
// space channel writes so bulk manager pushes do not trigger flood-wait blocks.
const RATE_LIMIT_PER_SEC = 12;
const TELEGRAM_WRITE_GAP_MS = 1_050;
const TELEGRAM_WRITE_GAP_FAST_MS = 350;
const callTimestamps: number[] = [];
let rateListener: ((info: { queue: number; waitMs: number }) => void) | null = null;
let lastTelegramWriteAt = 0;
let telegramWriteQueue = Promise.resolve();

export function onRateInfo(cb: ((info: { queue: number; waitMs: number }) => void) | null) {
  rateListener = cb;
}

function pruneOld() {
  const cutoff = Date.now() - 1000;
  while (callTimestamps.length && callTimestamps[0] < cutoff) callTimestamps.shift();
}

function isTelegramWrite(method: string): boolean {
  const name = method.split("?")[0];
  return (
    name === "sendMessage" ||
    name === "sendDocument" ||
    name === "editMessageText" ||
    name === "pinChatMessage"
  );
}

async function acquireWriteSlot() {
  const run = async () => {
    // Use a shorter gap when the queue is empty (single edit) to keep sync under 3s.
    const gap =
      telegramWriteQueue === Promise.resolve() ? TELEGRAM_WRITE_GAP_FAST_MS : TELEGRAM_WRITE_GAP_MS;
    const wait = Math.max(0, lastTelegramWriteAt + gap - Date.now());
    if (wait > 0) {
      rateListener?.({ queue: callTimestamps.length, waitMs: wait });
      await new Promise((r) => setTimeout(r, wait));
    }
    lastTelegramWriteAt = Date.now();
  };
  const next = telegramWriteQueue.then(run, run);
  telegramWriteQueue = next.catch(() => {});
  await next;
}

async function acquireSlot(method: string) {
  while (true) {
    pruneOld();
    if (callTimestamps.length < RATE_LIMIT_PER_SEC) {
      callTimestamps.push(Date.now());
      rateListener?.({ queue: callTimestamps.length, waitMs: 0 });
      if (isTelegramWrite(method)) await acquireWriteSlot();
      return;
    }
    const wait = 1000 - (Date.now() - callTimestamps[0]) + 20;
    rateListener?.({ queue: callTimestamps.length, waitMs: wait });
    await new Promise((r) => setTimeout(r, wait));
  }
}

async function tgApi(token: string, method: string, body?: any) {
  await acquireSlot(method);
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    ...(body && !(body instanceof FormData)
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : body
        ? { body }
        : {}),
  });
  const data = await res.json();
  if (!data.ok) {
    // Handle 429 (flood) by respecting retry_after and re-queueing.
    if (data.error_code === 429 && data.parameters?.retry_after) {
      const waitMs = (data.parameters.retry_after + 1) * 1000;
      rateListener?.({ queue: callTimestamps.length, waitMs });
      await new Promise((r) => setTimeout(r, waitMs));
      return tgApi(token, method, body);
    }
    const err: any = new Error(data.description || `Telegram ${method} failed`);
    err.error_code = data.error_code;
    err.description = data.description;
    throw err;
  }
  return data.result;
}

/** Get list of unique branch names currently known on the channel (fresh fetch, no cache mutation). */
export async function fetchRemoteBranchNames(
  cfg: TelegramConfig,
): Promise<{ branchId: string; branchName: string }[]> {
  if (!cfg.botToken) return [];
  const seen = new Map<string, string>();
  // Use cached branches first; then the pinned manifest; then a legacy getUpdates poll.
  getCachedBranches().forEach((b) => seen.set(b.branchId, b.branchName));
  try {
    const manifest = await loadBranchManifest(cfg);
    Object.values(manifest.branches).forEach((b) => seen.set(b.branchId, b.branchName));
  } catch {
    /* ignore — fallback below */
  }
  try {
    await deleteWebhook(cfg.botToken);
    const updates: any[] = await tgApi(
      cfg.botToken,
      `getUpdates?timeout=0&offset=-100&allowed_updates=${encodeURIComponent(JSON.stringify(["channel_post", "message"]))}`,
    );
    for (const u of updates) {
      const msg = u.channel_post || u.message;
      const caption: string = msg?.caption || "";
      const bm = caption.match(/#BRANCH:([^#\s]+)/);
      const nm = caption.match(/#NAME:([^#\s]+)/);
      if (bm) seen.set(bm[1], nm ? safeDecode(nm[1]) : bm[1]);
    }
  } catch {
    /* ignore — just return what we have cached */
  }
  return Array.from(seen.entries()).map(([branchId, branchName]) => ({ branchId, branchName }));
}

/** Generate a unique branch id not colliding with any known branch. */
export function generateUniqueBranchId(existing: string[]): string {
  const set = new Set(existing);
  for (let i = 0; i < 50; i++) {
    const id = `branch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    if (!set.has(id)) return id;
  }
  return `branch-${Date.now()}`;
}

/** Normalize a channel chat id so it always begins with -100 for private channels. */
export function normalizeChatId(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return s;
  if (s.startsWith("@")) return s; // public username
  if (s.startsWith("-100")) return s;
  if (s.startsWith("-")) return s;
  // Pure positive digits — private channel id needs -100 prefix
  if (/^\d+$/.test(s)) {
    if (s.startsWith("100")) return `-${s}`;
    return `-100${s}`;
  }
  return s;
}

/** Explicitly clear any webhook set on this bot so getUpdates can work. */
export async function deleteWebhook(token: string): Promise<void> {
  try {
    await tgApi(token, "deleteWebhook?drop_pending_updates=false");
  } catch (e) {
    console.warn("deleteWebhook failed (may be already unset):", e);
  }
}

function encodeManifest(manifest: BranchManifest): string {
  const compact = Object.values(manifest.branches)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((b) => [
      b.branchId,
      b.branchName,
      b.timestamp,
      b.fileId || "",
      b.messageId,
      b.syncId || "",
      b.parts || 0,
      b.transport || (b.syncId ? "chunks" : "document"),
    ]);
  const compressed = LZString.compressToEncodedURIComponent(
    JSON.stringify({
      v: 2,
      u: Date.now(),
      b: compact,
    }),
  );
  return `${MANIFEST_MARKER}\n${compressed}`;
}

function decodeManifestText(text: string): BranchManifest | null {
  if (!text || !text.startsWith(MANIFEST_MARKER)) return null;
  const compressed = text.slice(MANIFEST_MARKER.length).trim();
  if (!compressed) return { updatedAt: 0, branches: {} };
  const json = LZString.decompressFromEncodedURIComponent(compressed);
  if (!json) return null;
  const parsed = JSON.parse(json);
  const branches: Record<string, BranchManifestEntry> = {};
  for (const row of parsed.b || []) {
    const [branchId, branchName, timestamp, fileId, messageId, syncId, parts, transport] =
      row || [];
    if (!branchId) continue;
    branches[String(branchId)] = {
      branchId: String(branchId),
      branchName: String(branchName || branchId),
      timestamp: Number(timestamp || 0),
      fileId: fileId ? String(fileId) : undefined,
      messageId: Number(messageId || 0),
      syncId: syncId ? String(syncId) : undefined,
      parts: Number(parts || 0) || undefined,
      transport: transport === "chunks" ? "chunks" : "document",
    };
  }
  return { updatedAt: Number(parsed.u || 0), branches };
}

interface ChunkPart {
  syncId: string;
  branchId: string;
  branchName: string;
  timestamp: number;
  part: number;
  total: number;
  payload: string;
  messageId: number;
}

function parseChunkMessage(msg: any): ChunkPart | null {
  const text = String(msg?.text || "");
  if (!text.startsWith(CHUNK_MARKER)) return null;
  const lineBreak = text.indexOf("\n");
  const header = lineBreak === -1 ? text : text.slice(0, lineBreak);
  const payload = lineBreak === -1 ? "" : text.slice(lineBreak + 1).trim();
  const read = (name: string) => header.match(new RegExp(`#${name}:([^#\\s]+)`))?.[1] || "";
  const partMatch = header.match(/#PART:(\d+)\/(\d+)/);
  const syncId = read("SYNC");
  const branchId = read("BRANCH");
  if (!syncId || !branchId || !partMatch) return null;
  return {
    syncId,
    branchId,
    branchName: safeDecode(read("NAME") || branchId),
    timestamp: Number(read("TS") || 0),
    part: Number(partMatch[1]),
    total: Number(partMatch[2]),
    payload,
    messageId: Number(msg.message_id || 0),
  };
}

async function sendSnapshotChunks(
  cfg: TelegramConfig,
  branchId: string,
  branchName: string,
  timestamp: number,
  compressed: string,
): Promise<{ syncId: string; parts: number; messageId: number }> {
  const chatId = normalizeChatId(cfg.chatId);
  const syncId = makeSyncId(branchId);
  const chunks = splitPayload(compressed);
  let lastMessageId = 0;

  for (let i = 0; i < chunks.length; i++) {
    const header = `${CHUNK_MARKER} #SYNC:${syncId} #BRANCH:${branchId} #TS:${timestamp} #NAME:${encodeURIComponent(branchName)} #PART:${i + 1}/${chunks.length}`;
    const text = `${header}\n${chunks[i]}`;
    if (text.length > TELEGRAM_TEXT_LIMIT)
      throw new Error("حجم جزء البيانات أكبر من حد رسالة السيرفر");
    const sent = await tgApi(cfg.botToken, "sendMessage", {
      chat_id: chatId,
      text,
      disable_notification: true,
      disable_web_page_preview: true,
    });
    lastMessageId = sent.message_id;
  }

  return { syncId, parts: chunks.length, messageId: lastMessageId };
}

async function getRecentTelegramMessages(cfg: TelegramConfig): Promise<any[]> {
  await deleteWebhook(cfg.botToken);
  const params = new URLSearchParams({
    timeout: "0",
    allowed_updates: JSON.stringify(["channel_post", "message"]),
    offset: "-100",
  });
  const updates: any[] = (await tgApi(cfg.botToken, `getUpdates?${params.toString()}`)) || [];
  return updates.map((u) => u.channel_post || u.message).filter(Boolean);
}

function snapshotFromChunks(entry: BranchManifestEntry, messages: any[]): BranchSnapshot {
  const parsed = messages.map(parseChunkMessage).filter(Boolean) as ChunkPart[];
  const candidates = parsed.filter((p) =>
    entry.syncId ? p.syncId === entry.syncId : p.branchId === entry.branchId,
  );
  if (candidates.length === 0)
    throw new Error(
      "رسائل بيانات الفرع مش موجودة في تحديثات السيرفر. ارفع نسخة جديدة من جهاز الفرع.",
    );

  const syncId = entry.syncId || candidates.sort((a, b) => b.timestamp - a.timestamp)[0].syncId;
  const parts = candidates.filter((p) => p.syncId === syncId).sort((a, b) => a.part - b.part);
  const total = parts[0]?.total || entry.parts || 0;
  if (!total || parts.length < total) {
    throw new Error(
      `بيانات الفرع ناقصة (${parts.length}/${total || "?"}) — اضغط رفع نسخة الفرع الآن مرة ثانية.`,
    );
  }
  for (let i = 1; i <= total; i++) {
    if (!parts.some((p) => p.part === i))
      throw new Error(`بيانات الفرع ناقصة: الجزء ${i}/${total}`);
  }

  const latestMessageId = Math.max(...parts.map((p) => p.messageId), entry.messageId || 0);
  return parseSnapshotPayload(parts.map((p) => p.payload).join(""), {
    branchId: entry.branchId,
    branchName: entry.branchName,
    timestamp: entry.timestamp,
    messageId: latestMessageId,
    syncId,
    fileId: entry.fileId,
  });
}

// The pinned manifest changes only when a branch uploads a new snapshot.
// Cache it briefly so many quick polls don't burn getChat calls (Telegram
// bot limit is ~30 req/s globally — with N branches polling this matters).
// Kept short so a manager edit propagates to branch devices within a few
// seconds without needing a manual refresh. The manifest is a single small
// getChat call, so refreshing it often is safe against Telegram flood limits.
const MANIFEST_CACHE_TTL_MS = 4_000;
let manifestCache: { key: string; at: number; manifest: BranchManifest } | null = null;

async function loadBranchManifest(
  cfg: TelegramConfig,
  opts?: { force?: boolean },
): Promise<BranchManifest> {
  if (!cfg.botToken || !cfg.chatId) return { updatedAt: 0, branches: {} };
  const cacheKey = `${cfg.botToken}#${cfg.chatId}`;
  if (
    !opts?.force &&
    manifestCache &&
    manifestCache.key === cacheKey &&
    Date.now() - manifestCache.at < MANIFEST_CACHE_TTL_MS
  ) {
    return manifestCache.manifest;
  }
  const chatId = normalizeChatId(cfg.chatId);
  const chat = await tgApi(cfg.botToken, "getChat", { chat_id: chatId });
  const pinned = chat?.pinned_message;
  const manifest = decodeManifestText(pinned?.text || pinned?.caption || "") || {
    updatedAt: 0,
    branches: {},
  };
  if (pinned?.message_id) manifest.messageId = pinned.message_id;
  manifestCache = { key: cacheKey, at: Date.now(), manifest };
  return manifest;
}

function invalidateManifestCache() {
  manifestCache = null;
}

async function saveBranchManifest(cfg: TelegramConfig, manifest: BranchManifest): Promise<number> {
  const chatId = normalizeChatId(cfg.chatId);
  const text = encodeManifest(manifest);
  if (text.length > MANIFEST_TEXT_LIMIT) {
    throw new Error(
      "فهرس الفروع على السيرفر كبر عن حد الرسالة الواحدة. قلل عدد الفروع على نفس البوت أو استخدم بوت/قناة ثانية لبعض الفروع.",
    );
  }

  if (manifest.messageId) {
    try {
      await tgApi(cfg.botToken, "editMessageText", {
        chat_id: chatId,
        message_id: manifest.messageId,
        text,
        disable_web_page_preview: true,
      });
      return manifest.messageId;
    } catch (e: any) {
      const desc = String(e.description || e.message || "").toLowerCase();
      if (desc.includes("message is not modified")) return manifest.messageId;
      // If the old pinned message cannot be edited, create a fresh bot-owned manifest below.
      if (!desc.includes("message to edit not found") && !desc.includes("message can't be edited"))
        throw e;
    }
  }

  const sent = await tgApi(cfg.botToken, "sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    disable_notification: true,
  });
  try {
    await tgApi(cfg.botToken, "pinChatMessage", {
      chat_id: chatId,
      message_id: sent.message_id,
      disable_notification: true,
    });
  } catch (e: any) {
    throw new Error(
      "تم رفع ملف الفرع لكن فشل تثبيت فهرس الفروع. لازم البوت يكون Admin في القناة ومعاه صلاحية Pin Messages / Manage Messages.",
    );
  }
  return sent.message_id;
}

async function downloadSnapshotFromFileId(
  cfg: TelegramConfig,
  entry: BranchManifestEntry,
): Promise<BranchSnapshot> {
  if (!entry.fileId) throw new Error("لا يوجد ملف قديم لهذا الفرع — ارفع نسخة جديدة من جهاز الفرع");
  const fileInfo = await tgApi(cfg.botToken, `getFile?file_id=${entry.fileId}`);
  if (!fileInfo?.file_path) throw new Error("ملف الفرع مش متاح على السيرفر");
  const compressed = await fetchTelegramFileText(cfg, fileInfo.file_path);
  return parseSnapshotPayload(compressed, entry);
}

// Content fingerprint per (bot,chat,branch) — lets us skip sendDocument when
// the payload hasn't actually changed since the last successful upload.
// Deliberately excludes _timestamp / _version so identical data doesn't force a re-upload.
const LAST_UPLOAD_HASH_KEY = "pos_telegram_last_upload_hash";
function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}
function payloadFingerprint(dataObj: Record<string, any>): string {
  const clone: Record<string, any> = {};
  for (const k of Object.keys(dataObj).sort()) {
    if (k === "_timestamp" || k === "_version") continue;
    clone[k] = dataObj[k];
  }
  try {
    return hashString(JSON.stringify(clone));
  } catch {
    return String(Date.now());
  }
}
function getLastUploadHash(cacheKey: string): string | null {
  const map = readJson<Record<string, string>>(LAST_UPLOAD_HASH_KEY, {});
  return map[cacheKey] || null;
}
function setLastUploadHash(cacheKey: string, hash: string) {
  const map = readJson<Record<string, string>>(LAST_UPLOAD_HASH_KEY, {});
  map[cacheKey] = hash;
  localStorage.setItem(LAST_UPLOAD_HASH_KEY, JSON.stringify(map));
}

/** Test connection: getMe + optional test send. Auto-normalizes chat id and clears webhook. */
export async function testConnection(cfg: TelegramConfig): Promise<{ botName: string }> {
  await deleteWebhook(cfg.botToken);
  const me = await tgApi(cfg.botToken, "getMe");
  if (cfg.chatId) {
    const chatId = normalizeChatId(cfg.chatId);
    try {
      await tgApi(cfg.botToken, "sendMessage", {
        chat_id: chatId,
        text: `✅ اتصال ناجح — ${cfg.branchName || cfg.branchId}`,
        disable_notification: true,
      });
    } catch (e: any) {
      if (
        String(e.description || e.message || "")
          .toLowerCase()
          .includes("chat not found")
      ) {
        throw new Error(
          "القناة مش لاقيها. تأكد من:\n" +
            "1) الـ Chat ID يبدأ بـ -100 (مثال: -1001234567890)\n" +
            "2) البوت مضاف في القناة كـ Admin (مش عضو عادي)\n" +
            "3) ابعت أي رسالة في القناة الأول عشان البوت يتعرف عليها",
        );
      }
      throw e;
    }
  }
  return { botName: me.username || me.first_name };
}

/** Upload current branch state as a compressed document.
 *  override lets the branch-manager push edits back under a specific branch identity.
 */
export async function uploadSnapshot(
  cfg: TelegramConfig,
  override?: { branchId: string; branchName: string },
): Promise<number> {
  if (!cfg.botToken || !cfg.chatId) {
    throw new Error("الإعدادات ناقصة (توكن/قناة)");
  }
  const branchId = override?.branchId || cfg.branchId;
  const branchName = override?.branchName || cfg.branchName;
  if (!branchId) throw new Error("معرّف الفرع مطلوب");

  const dataObj = collectSnapshotData(cfg, { branchId, branchName });
  return uploadSnapshotData(cfg, dataObj, { branchId, branchName });
}

export class BranchVersionConflictError extends Error {
  remoteVersion: number;
  parentVersion: number;
  branchId: string;
  branchName: string;
  constructor(branchId: string, branchName: string, remoteVersion: number, parentVersion: number) {
    super(
      `الفرع "${branchName}" اتحدث من مكان تاني (نسخة ${remoteVersion}). اعمل تحديث الآن قبل ما ترفع تعديلاتك.`,
    );
    this.name = "BranchVersionConflictError";
    this.remoteVersion = remoteVersion;
    this.parentVersion = parentVersion;
    this.branchId = branchId;
    this.branchName = branchName;
  }
}

export async function uploadSnapshotData(
  cfg: TelegramConfig,
  dataObj: Record<string, any>,
  override?: { branchId: string; branchName: string; force?: boolean },
): Promise<number> {
  const {
    emitSyncProgress,
    withRetry,
    bumpAndGetVersion,
    getKnownVersion,
    rememberVersion,
    computeKeyHashes,
  } = await import("./branchSyncFeatures");
  const { logBranchAudit } = await import("./branchAudit");

  if (!cfg.botToken || !cfg.chatId) {
    throw new Error("الإعدادات ناقصة (توكن/قناة)");
  }
  const branchId = override?.branchId || dataObj._branchId || cfg.branchId;
  const branchName = override?.branchName || dataObj._branchName || cfg.branchName;
  if (!branchId) throw new Error("معرّف الفرع مطلوب");

  const chatId = normalizeChatId(cfg.chatId);

  const parentVersion = getKnownVersion(branchId);
  const nextVersion = bumpAndGetVersion(branchId);

  dataObj = {
    ...dataObj,
    _branchId: branchId,
    _branchName: branchName,
    _timestamp: Date.now(),
    _schema: dataObj._schema || "1.0",
    _version: nextVersion,
    _parentVersion: parentVersion,
    _keyHashes: computeKeyHashes(dataObj),
  };

  // Conflict detection: refuse to upload if the remote is newer than the
  // parentVersion we branched from (unless caller passes `force`).
  if (!override?.force) {
    try {
      const manifestCheck = await loadBranchManifest(cfg, { force: true });
      const remote = manifestCheck.branches[branchId];
      // Remote version is embedded in manifest via timestamp+syncId only; we do a
      // cheap freshness heuristic — if remote timestamp is newer than our last
      // known upload for this branch, warn.
      const cached = getCachedBranches().find((b) => b.branchId === branchId);
      const remoteVersion = Number((cached?.data as any)?._version || 0);
      if (remote && remoteVersion > parentVersion && parentVersion > 0) {
        throw new BranchVersionConflictError(branchId, branchName, remoteVersion, parentVersion);
      }
    } catch (e) {
      if (e instanceof BranchVersionConflictError) throw e;
      // manifest read failed — proceed (rare offline case)
    }
  }

  // Content-hash short-circuit: if meaningful data unchanged, skip upload.
  const uploadCacheKey = `${cfg.botToken}#${cfg.chatId}#${branchId}`;
  const fingerprint = payloadFingerprint(dataObj);
  const lastHash = getLastUploadHash(uploadCacheKey);
  if (lastHash === fingerprint) {
    const cached = getCachedBranches().find((b) => b.branchId === branchId);
    if (cached?.messageId) {
      emitSyncProgress({ stage: "done", branchName, message: "مفيش تغييرات جديدة — تم التخطي" });
      return cached.messageId;
    }
  }

  emitSyncProgress({ stage: "uploading", branchName, message: "جاري رفع النسخة..." });

  const compressed = LZString.compressToBase64(JSON.stringify(dataObj));
  const caption = `#BRANCH:${branchId}#TS:${dataObj._timestamp}#NAME:${encodeURIComponent(branchName)}#V:${nextVersion}`;

  const result = await withRetry(
    async (attempt) => {
      if (attempt > 1)
        emitSyncProgress({
          stage: "retrying",
          branchName,
          attempt,
          message: `إعادة محاولة ${attempt}...`,
        });
      const blob = new Blob([compressed], { type: "text/plain" });
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("caption", caption);
      form.append("document", blob, `${branchId}_${dataObj._timestamp}.lz.txt`);
      return tgApi(cfg.botToken, "sendDocument", form);
    },
    { retries: 3, onRetry: (a, e) => console.warn(`upload retry ${a}:`, e?.message) },
  );

  const fileId = result.document?.file_id;
  if (!fileId) throw new Error("تم الرفع لكن السيرفر ما رجعش file_id للملف");

  upsertCachedBranch({
    branchId,
    branchName,
    timestamp: dataObj._timestamp,
    data: dataObj,
    messageId: result.message_id,
    fileId,
  });

  try {
    const manifest = await loadBranchManifest(cfg, { force: true });
    manifest.branches[branchId] = {
      branchId,
      branchName,
      timestamp: dataObj._timestamp,
      fileId,
      messageId: result.message_id,
      transport: "document",
    };
    manifest.updatedAt = Date.now();
    await withRetry(() => saveBranchManifest(cfg, manifest), { retries: 2 });
    invalidateManifestCache();
    setLastUploadHash(uploadCacheKey, fingerprint);
    rememberVersion(branchId, nextVersion);
  } catch (e: any) {
    logBranchAudit({
      kind: "upload",
      actor: cfg.branchId === branchId ? `branch:${branchName}` : "manager",
      branchId,
      branchName,
      ok: false,
      message: e.message || "فشل تحديث الفهرس",
      version: nextVersion,
      parentVersion,
      bytes: compressed.length,
    });
    emitSyncProgress({ stage: "error", branchName, message: e.message || "فشل تحديث الفهرس" });
    throw new Error(e.message || "تم رفع الملف لكن فشل تحديث فهرس الفروع المثبت على القناة");
  }

  const isOwnBranchUpload = branchId === cfg.branchId;
  if (isOwnBranchUpload) {
    const newerDirtySince = Number(localStorage.getItem(LOCAL_DIRTY_KEY) || 0);
    if (!newerDirtySince || newerDirtySince <= dataObj._timestamp) {
      localStorage.removeItem(LOCAL_DIRTY_KEY);
    } else {
      scheduleAutoUpload();
    }
    cfg.lastUploadFileId = fileId;
    cfg.lastUploadTimestamp = dataObj._timestamp;
  }
  cfg.lastSyncAt = Date.now();
  if (isBranchSyncEnabled(cfg)) saveTelegramConfig(cfg);
  else if (cfg.role === "manager" || cfg.branchId === "manager") saveManagerTelegramConfig(cfg);

  logBranchAudit({
    kind: "upload",
    actor: isOwnBranchUpload ? `branch:${branchName}` : "manager",
    branchId,
    branchName,
    ok: true,
    version: nextVersion,
    parentVersion,
    bytes: compressed.length,
    message: `تم رفع نسخة v${nextVersion} (${(compressed.length / 1024).toFixed(1)}KB)`,
  });
  emitSyncProgress({ stage: "done", branchName, message: `تم رفع v${nextVersion}` });

  return result.message_id;
}

export function getCachedBranches(): BranchSnapshot[] {
  try {
    const raw = localStorage.getItem(BRANCHES_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCachedBranches(list: BranchSnapshot[]) {
  localStorage.setItem(BRANCHES_CACHE_KEY, JSON.stringify(list));
}

function isSnapshotKey(key: string): boolean {
  return ALL_KEYS.includes(key);
}

function isBranchPreviewActive(): boolean {
  return (
    typeof window !== "undefined" &&
    window.localStorage.getItem("pos_internal_branch_preview_active") === "1"
  );
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function mergeIncomingValue(key: string, incoming: any) {
  if (Array.isArray(incoming)) {
    if (incoming.length === 0) return;
    const existing = readJson<any[]>(key, []);
    const current = Array.isArray(existing) ? existing : [];
    const incomingIds = new Set(
      incoming.map((it: any) => it?.id).filter((v: any) => v !== undefined && v !== null),
    );
    const kept = current.filter((it: any) => !it?.id || !incomingIds.has(it.id));
    localStorage.setItem(key, JSON.stringify([...kept, ...incoming]));
    return;
  }

  if (incoming && typeof incoming === "object") {
    if (Object.keys(incoming).length === 0) return;
    const existing = readJson<Record<string, any>>(key, {});
    localStorage.setItem(
      key,
      JSON.stringify({
        ...(existing && typeof existing === "object" ? existing : {}),
        ...incoming,
      }),
    );
    return;
  }

  if (incoming === null || incoming === undefined || incoming === "") return;
  localStorage.setItem(key, JSON.stringify(incoming));
}

let suspendAutoUpload = false;

export function runWithoutTelegramDirtyTracking<T>(fn: () => T): T {
  const previous = suspendAutoUpload;
  suspendAutoUpload = true;
  try {
    return fn();
  } finally {
    suspendAutoUpload = previous;
  }
}

export function applyBranchSnapshotToLocal(snapshot: BranchSnapshot, merge = true) {
  suspendAutoUpload = true;
  // On a manager device, never overwrite this device's own admin credentials or
  // manager credentials with values coming from a branch snapshot.
  const isManagerDevice =
    typeof window !== "undefined" &&
    window.localStorage.getItem("pos_telegram_manager_config") !== null;
  const protectedKeys = new Set([...LOCAL_ONLY_KEYS]);
  if (isManagerDevice) {
    protectedKeys.add("pos_admin_credentials");
  }
  try {
    for (const key of ALL_KEYS) {
      if (!(key in snapshot.data)) continue;
      if (protectedKeys.has(key)) continue;
      const value = snapshot.data[key];
      if (merge && !REMOTE_REPLACE_KEYS.has(key)) mergeIncomingValue(key, value);
      else if (value === undefined || value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  } finally {
    suspendAutoUpload = false;
  }
  // Track version so subsequent uploads carry the right parentVersion.
  import("./branchSyncFeatures")
    .then(({ rememberVersion }) => {
      const v = Number((snapshot.data as any)?._version || 0);
      if (v > 0) rememberVersion(snapshot.branchId, v);
    })
    .catch(() => {});
  import("./branchAudit")
    .then(({ logBranchAudit }) => {
      logBranchAudit({
        kind: "apply",
        actor: "local",
        branchId: snapshot.branchId,
        branchName: snapshot.branchName,
        ok: true,
        version: Number((snapshot.data as any)?._version || 0),
        message: merge ? "دمج نسخة الفرع" : "استبدال نسخة الفرع",
      });
    })
    .catch(() => {});
  // Fire per-key storage events so any component listening via the standard
  // `storage` event picks up the remote change without needing a manual
  // refresh / tab switch. Native `storage` events fire only cross-tab, so
  // synthesize them here for same-tab listeners.
  for (const key of ALL_KEYS) {
    if (!(key in snapshot.data)) continue;
    try {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          newValue: localStorage.getItem(key),
          storageArea: localStorage,
        }),
      );
    } catch {
      /* older browsers */
    }
  }
  window.dispatchEvent(new Event("pos-settings-changed"));
  window.dispatchEvent(
    new CustomEvent("pos-data-changed", {
      detail: { branchId: snapshot.branchId, timestamp: snapshot.timestamp },
    }),
  );
}

export async function fetchOwnBranchSnapshot(cfg: TelegramConfig): Promise<BranchSnapshot | null> {
  if (!cfg.botToken || !cfg.chatId || !cfg.branchId) return null;
  // Force-refresh the manifest here so a branch device always sees the latest
  // edit from the manager on the next poll (no stale cache delay).
  const manifest = await loadBranchManifest(cfg, { force: true });
  const entry = manifest.branches[cfg.branchId];
  if (!entry) return null;
  const cached = getCachedBranches().find((b) => b.branchId === cfg.branchId);
  const sameChunk = entry.syncId && cached?.syncId === entry.syncId && !cached.incomplete;
  const sameFile =
    !entry.syncId && entry.fileId && cached?.fileId === entry.fileId && !cached.incomplete;
  if (sameChunk || sameFile) return cached!;

  let snapshot: BranchSnapshot;
  if (entry.syncId || entry.transport === "chunks") {
    snapshot = snapshotFromChunks(entry, await getRecentTelegramMessages(cfg));
  } else {
    snapshot = await downloadSnapshotFromFileId(cfg, entry);
  }
  upsertCachedBranch(snapshot);
  return snapshot;
}

function getRemoteFingerprint(snapshot: BranchSnapshot): string {
  return snapshot.fileId || snapshot.syncId || String(snapshot.timestamp || 0);
}

function getLastRemoteApplied(branchId: string): { fingerprint?: string; timestamp?: number } {
  const map = readJson<Record<string, { fingerprint?: string; timestamp?: number }>>(
    LAST_REMOTE_APPLIED_KEY,
    {},
  );
  return map[branchId] || {};
}

function setLastRemoteApplied(branchId: string, fingerprint: string, timestamp: number) {
  const map = readJson<Record<string, { fingerprint?: string; timestamp?: number }>>(
    LAST_REMOTE_APPLIED_KEY,
    {},
  );
  map[branchId] = { fingerprint, timestamp };
  localStorage.setItem(LAST_REMOTE_APPLIED_KEY, JSON.stringify(map));
}

export function markTelegramDataDirty() {
  if (suspendAutoUpload || isBranchPreviewActive()) return;
  localStorage.setItem(LOCAL_DIRTY_KEY, String(Date.now()));
  scheduleAutoUpload();
}

let autoUploadTimer: number | null = null;
let autoSyncInFlight = false;
let autoSyncRerunRequested = false;
let storageWatcherInstalled = false;
let originalSetItem: typeof Storage.prototype.setItem | null = null;
let originalRemoveItem: typeof Storage.prototype.removeItem | null = null;

function installAutoUploadWatcher() {
  if (storageWatcherInstalled || typeof window === "undefined") return;
  storageWatcherInstalled = true;
  originalSetItem = Storage.prototype.setItem;
  originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.setItem = function patchedSetItem(key: string, value: string) {
    originalSetItem!.call(this, key, value);
    if (this === window.localStorage && isSnapshotKey(key) && !suspendAutoUpload)
      markTelegramDataDirty();
  };

  Storage.prototype.removeItem = function patchedRemoveItem(key: string) {
    originalRemoveItem!.call(this, key);
    if (this === window.localStorage && isSnapshotKey(key) && !suspendAutoUpload)
      markTelegramDataDirty();
  };
}

function scheduleAutoUpload() {
  if (isBranchPreviewActive()) return;
  const cfg = getTelegramConfig();
  // Always auto-upload on data changes for a bound branch device, regardless
  // of the periodic-pull `autoSyncMinutes` setting. This removes the need to
  // ever tell the branch operator "press upload manually" — every local
  // mutation debounces into an upload automatically.
  if (!cfg || !isBranchSyncEnabled(cfg)) return;
  if (autoUploadTimer !== null) window.clearTimeout(autoUploadTimer);
  autoUploadTimer = window.setTimeout(() => {
    autoUploadTimer = null;
    syncBranchNow({ forceUpload: true }).catch((err) => console.error("auto upload failed:", err));
  }, AUTO_UPLOAD_DEBOUNCE_MS);
}


function isBranchSyncEnabled(cfg: TelegramConfig | null): boolean {
  return !!cfg && !!cfg.botToken && !!cfg.chatId && !!cfg.branchId && cfg.branchId !== "manager";
}

export async function syncBranchNow(
  options: { forceUpload?: boolean } = {},
): Promise<{ applied: boolean; uploaded: boolean }> {
  if (isBranchPreviewActive()) return { applied: false, uploaded: false };
  const cfg = getTelegramConfig();
  if (!cfg || !isBranchSyncEnabled(cfg)) return { applied: false, uploaded: false };
  if (autoSyncInFlight) {
    autoSyncRerunRequested = true;
    return { applied: false, uploaded: false };
  }

  autoSyncInFlight = true;
  let applied = false;
  let uploaded = false;
  try {
    try {
      const remote = await fetchOwnBranchSnapshot(cfg);
      if (remote && !remote.incomplete) {
        const fingerprint = getRemoteFingerprint(remote);
        const lastApplied = getLastRemoteApplied(cfg.branchId);
        const isOwnUpload = !!remote.fileId && remote.fileId === cfg.lastUploadFileId;
        if (isOwnUpload) {
          setLastRemoteApplied(cfg.branchId, fingerprint, remote.timestamp);
        } else if (fingerprint && lastApplied.fingerprint !== fingerprint) {
          applyBranchSnapshotToLocal(remote, true);
          setLastRemoteApplied(cfg.branchId, fingerprint, remote.timestamp);
          applied = true;
        }
      }
    } catch (e) {
      console.warn("auto download failed:", e);
    }

    const latestCfg = getTelegramConfig() || cfg;
    const dirtySince = Number(localStorage.getItem(LOCAL_DIRTY_KEY) || 0);
    const shouldUpload =
      options.forceUpload || !latestCfg.lastSyncAt || dirtySince > (latestCfg.lastSyncAt || 0);
    if (shouldUpload) {
      await uploadSnapshot(latestCfg);
      uploaded = true;
    }
    return { applied, uploaded };
  } finally {
    autoSyncInFlight = false;
    if (autoSyncRerunRequested) {
      autoSyncRerunRequested = false;
      scheduleAutoUpload();
    }
  }
}

/** Manager: fetch a single branch's latest snapshot using the pinned manifest.
 *  Downloads exactly one file (or reads chunk messages for one branch) — a
 *  much cheaper poll than fetchBranches when only one branch is visible. */
export async function fetchSingleBranch(
  cfg: TelegramConfig,
  branchId: string,
  opts?: { force?: boolean },
): Promise<BranchSnapshot | null> {
  if (!cfg.botToken) throw new Error("التوكن مطلوب");
  const manifest = await loadBranchManifest(cfg, { force: opts?.force });
  const entry = manifest.branches[branchId];
  if (!entry) return null;
  const cached = getCachedBranches().find((b) => b.branchId === branchId);
  const sameChunk = entry.syncId && cached?.syncId === entry.syncId && !cached.incomplete;
  const sameFile =
    !entry.syncId && entry.fileId && cached?.fileId === entry.fileId && !cached.incomplete;
  if (sameChunk || sameFile) return cached!;
  let snapshot: BranchSnapshot;
  try {
    if (entry.syncId || entry.transport === "chunks") {
      snapshot = snapshotFromChunks(entry, await getRecentTelegramMessages(cfg));
    } else {
      snapshot = await downloadSnapshotFromFileId(cfg, entry);
    }
  } catch (e: any) {
    snapshot = createPlaceholderSnapshot(entry, e?.message || String(e));
  }
  upsertCachedBranch(snapshot);
  return snapshot;
}

/** Manager: fetch new updates from channel, merge into branches cache.
 *  Auto-clears any active webhook that would otherwise cause a 409 Conflict.
 */
export async function fetchBranches(
  cfg: TelegramConfig,
  opts?: { force?: boolean },
): Promise<BranchSnapshot[]> {
  if (!cfg.botToken) throw new Error("التوكن مطلوب");

  const existing = getCachedBranches();
  const byBranch: Record<string, BranchSnapshot> = {};
  existing.forEach((b) => {
    byBranch[b.branchId] = b;
  });

  const manifestErrors: string[] = [];
  let manifestEntries: BranchManifestEntry[] = [];
  let recentMessages: any[] | null = null;
  const ensureRecentMessages = async () => {
    if (!recentMessages) recentMessages = await getRecentTelegramMessages(cfg);
    return recentMessages;
  };
  try {
    const manifest = await loadBranchManifest(cfg, { force: opts?.force });

    manifestEntries = Object.values(manifest.branches);
    for (const entry of manifestEntries) {
      const already = byBranch[entry.branchId];
      const sameChunkSnapshot =
        entry.syncId && already?.syncId === entry.syncId && !already.incomplete;
      const sameFileSnapshot =
        !entry.syncId && entry.fileId && already?.fileId === entry.fileId && !already.incomplete;
      if (sameChunkSnapshot || sameFileSnapshot) continue;
      try {
        let snapshot: BranchSnapshot;
        if (entry.syncId || entry.transport === "chunks") {
          snapshot = snapshotFromChunks(entry, await ensureRecentMessages());
        } else {
          try {
            snapshot = await downloadSnapshotFromFileId(cfg, entry);
          } catch (fileError) {
            snapshot = snapshotFromChunks(entry, await ensureRecentMessages());
          }
        }
        const prev = byBranch[snapshot.branchId];
        if (!prev || snapshot.timestamp >= prev.timestamp) byBranch[snapshot.branchId] = snapshot;
      } catch (e: any) {
        manifestErrors.push(`${entry.branchName}: ${e?.message || String(e)}`);
        if (!byBranch[entry.branchId]) {
          byBranch[entry.branchId] = createPlaceholderSnapshot(entry, e?.message || String(e));
        }
      }
    }
  } catch (e: any) {
    manifestErrors.push(`فشل قراءة فهرس الفروع المثبت: ${e?.message || String(e)}`);
  }

  if (manifestEntries.length > 0) {
    const list = Object.values(byBranch).sort((a, b) => b.timestamp - a.timestamp);
    saveCachedBranches(list);
    return list;
  }

  // IMPORTANT: never send a positive offset — that ACKs the updates on
  // Telegram's side and no other manager device (or a fresh install of the
  // same app on the same phone) would ever see them again. `getUpdates` is
  // single-consumer, so cross-device manager sync only works if we keep
  // the updates in the 24h pending queue and dedupe locally by message_id.

  // Always clear the webhook first so getUpdates can work. If another app
  // registered a webhook on this bot, getUpdates will fail with a 409 conflict.
  await deleteWebhook(cfg.botToken);

  const params = new URLSearchParams({
    timeout: "0",
    allowed_updates: JSON.stringify(["channel_post", "message"]),
    offset: "-100", // last 100 updates without confirming
  });

  let updates: any[];
  try {
    updates = await tgApi(cfg.botToken, `getUpdates?${params.toString()}`);
  } catch (e: any) {
    const desc = String(e.description || e.message || "").toLowerCase();
    if (desc.includes("webhook is active") || desc.includes("conflict") || e.error_code === 409) {
      await deleteWebhook(cfg.botToken);
      updates = await tgApi(cfg.botToken, `getUpdates?${params.toString()}`);
    } else {
      throw e;
    }
  }

  if (!Array.isArray(updates)) updates = [];

  let docCount = 0;
  let matchCount = 0;
  const downloadErrors: string[] = [];

  for (const update of updates) {
    const msg = update.channel_post || update.message;
    if (!msg?.document) continue;
    docCount++;
    const caption: string = msg.caption || "";
    const bm = caption.match(/#BRANCH:([^#\s]+)/);
    if (!bm) continue;
    matchCount++;
    const branchId = bm[1];
    const nameMatch = caption.match(/#NAME:([^#\s]+)/);
    const branchName = nameMatch ? safeDecode(nameMatch[1]) : branchId;

    // Skip re-download if we already downloaded this exact message.
    const already = byBranch[branchId];
    if (already && already.messageId === msg.message_id) continue;

    try {
      const fileInfo = await tgApi(cfg.botToken, `getFile?file_id=${msg.document.file_id}`);
      if (!fileInfo?.file_path) throw new Error("ملف الفرع مش متاح على السيرفر");
      const compressed = await fetchTelegramFileText(cfg, fileInfo.file_path);
      const snapshot = parseSnapshotPayload(compressed, {
        branchId,
        branchName,
        timestamp: msg.date * 1000,
        messageId: msg.message_id,
        fileId: msg.document.file_id,
      });
      const prev = byBranch[branchId];
      if (!prev || snapshot.timestamp >= prev.timestamp) byBranch[branchId] = snapshot;
    } catch (e: any) {
      const errText = e?.message || String(e);
      console.error("branch download failed for", branchId, errText);
      downloadErrors.push(`${branchId}: ${errText}`);
    }
  }

  console.log("[fetchBranches]", {
    totalUpdates: updates.length,
    documents: docCount,
    branchCaptionMatches: matchCount,
    downloaded: Object.keys(byBranch).length,
    errors: downloadErrors,
  });

  const list = Object.values(byBranch).sort((a, b) => b.timestamp - a.timestamp);
  saveCachedBranches(list);

  if (list.length === 0 && updates.length > 0 && matchCount === 0) {
    throw new Error(
      'القناة فيها رسايل، لكن مفيش فهرس مثبت للفروع ولا رسالة قديمة فيها ملف #BRANCH. افتح جهاز الفرع واضغط "رفع نسخة الفرع الآن" بعد التحديث الجديد.',
    );
  }
  if (list.length === 0 && updates.length === 0 && manifestErrors.length > 0) {
    throw new Error(manifestErrors[0]);
  }
  if (list.length === 0 && matchCount > 0 && downloadErrors.length > 0) {
    throw new Error(
      "لقينا فروع على القناة، لكن التحميل فشل:\n" + downloadErrors.slice(0, 3).join("\n"),
    );
  }

  return list;
}

/** Diagnostic: list recent channel messages without downloading files. */
export async function diagnoseChannel(cfg: TelegramConfig): Promise<{
  ok: boolean;
  botName?: string;
  updatesCount: number;
  manifestMessageId?: number;
  manifestBranches?: {
    branchId: string;
    branchName: string;
    messageId: number;
    date: number;
    fileId?: string;
  }[];
  branchMessages: {
    branchId: string;
    branchName: string;
    messageId: number;
    date: number;
    fileId?: string;
  }[];
  error?: string;
}> {
  if (!cfg.botToken)
    return { ok: false, updatesCount: 0, branchMessages: [], error: "التوكن مطلوب" };
  try {
    await deleteWebhook(cfg.botToken);
    const me = await tgApi(cfg.botToken, "getMe");
    const manifest = await loadBranchManifest(cfg);
    const manifestBranches = Object.values(manifest.branches).map((b) => ({
      branchId: b.branchId,
      branchName: b.branchName,
      messageId: b.messageId,
      date: Math.floor(b.timestamp / 1000),
      fileId: b.fileId,
    }));
    const params = new URLSearchParams({
      timeout: "0",
      allowed_updates: JSON.stringify(["channel_post", "message"]),
      offset: "-100",
    });
    const updates: any[] = (await tgApi(cfg.botToken, `getUpdates?${params.toString()}`)) || [];
    const branchMessages = updates
      .map((u) => u.channel_post || u.message)
      .filter(Boolean)
      .map((msg) => {
        const caption: string = msg.caption || "";
        const bm = caption.match(/#BRANCH:([^#\s]+)/);
        const nm = caption.match(/#NAME:([^#\s]+)/);
        if (!bm) return null;
        return {
          branchId: bm[1],
          branchName: nm ? safeDecode(nm[1]) : bm[1],
          messageId: msg.message_id,
          date: msg.date,
          fileId: msg.document?.file_id,
        };
      })
      .filter(Boolean) as any;
    return {
      ok: true,
      botName: me.username || me.first_name,
      updatesCount: updates.length,
      manifestMessageId: manifest.messageId,
      manifestBranches,
      branchMessages: manifestBranches.length > 0 ? manifestBranches : branchMessages,
    };
  } catch (e: any) {
    return { ok: false, updatesCount: 0, branchMessages: [], error: e.message || String(e) };
  }
}

// ─── Auto-sync scheduler (branch role) ───
let syncTimer: number | null = null;

export function startAutoSync(options: { immediate?: boolean } = {}) {
  stopAutoSync();
  const cfg = getTelegramConfig();
  if (!cfg || !isBranchSyncEnabled(cfg)) return;
  if (cfg.autoSyncMinutes <= 0) {
    cfg.autoSyncMinutes = 0.25;
    saveTelegramConfig(cfg);
  }
  installAutoUploadWatcher();
  if (options.immediate !== false) {
    syncBranchNow({ forceUpload: !cfg.lastSyncAt }).catch((err) =>
      console.error("auto-sync failed:", err),
    );
  }
  const intervalMs = Math.max(
    MIN_AUTO_SYNC_INTERVAL_MS,
    Math.min(cfg.autoSyncMinutes * 60 * 1000, FAST_BRANCH_PULL_INTERVAL_MS),
  );
  syncTimer = window.setInterval(
    () => {
      syncBranchNow().catch((err) => console.error("auto-sync failed:", err));
    },
    intervalMs + Math.floor(Math.random() * 1_500),
  );
}

export function stopAutoSync() {
  if (syncTimer !== null) {
    window.clearInterval(syncTimer);
    syncTimer = null;
  }
}

/** Manager: fully remove a branch from the channel manifest + local cache.
 *  Old document messages remain on Telegram (bots can't delete channel docs
 *  they didn't send within 48h), but the branch stops appearing in the
 *  manager and stops being downloaded on any device. */
export async function deleteBranchFromChannel(
  cfg: TelegramConfig,
  branchId: string,
): Promise<void> {
  if (!cfg.botToken || !cfg.chatId) throw new Error("الإعدادات ناقصة");
  const cachedName =
    getCachedBranches().find((b) => b.branchId === branchId)?.branchName || branchId;
  try {
    const manifest = await loadBranchManifest(cfg, { force: true });
    if (manifest.branches[branchId]) {
      delete manifest.branches[branchId];
      manifest.updatedAt = Date.now();
      await saveBranchManifest(cfg, manifest);
      invalidateManifestCache();
    }
  } catch (e) {
    console.warn("deleteBranchFromChannel manifest update failed:", e);
  }
  const cached = getCachedBranches().filter((b) => b.branchId !== branchId);
  saveCachedBranches(cached);
  import("./branchAudit")
    .then(({ logBranchAudit }) => {
      logBranchAudit({
        kind: "delete",
        actor: "manager",
        branchId,
        branchName: cachedName,
        ok: true,
      });
    })
    .catch(() => {});
}
