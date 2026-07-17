// Sync progress bus + retry helpers + versioning + backup/restore utilities
// used across the manager and branch dashboards. Kept in its own module so
// telegramSync.ts stays focused on Telegram transport concerns.

import LZString from 'lz-string';
import { SNAPSHOT_KEYS } from './telegramSync';

// ─── Progress bus ───
export interface SyncProgress {
  stage: 'idle' | 'uploading' | 'downloading' | 'applying' | 'retrying' | 'done' | 'error';
  current?: number;
  total?: number;
  branchName?: string;
  attempt?: number;
  message?: string;
}

const listeners = new Set<(p: SyncProgress) => void>();
let last: SyncProgress = { stage: 'idle' };

export function emitSyncProgress(p: SyncProgress) {
  last = p;
  listeners.forEach(l => { try { l(p); } catch { /* ignore */ } });
}

export function onSyncProgress(cb: (p: SyncProgress) => void): () => void {
  listeners.add(cb);
  cb(last);
  return () => listeners.delete(cb);
}

// ─── Retry with backoff ───
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: { retries?: number; baseMs?: number; onRetry?: (attempt: number, err: any) => void } = {}
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 800;
  let lastErr: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try { return await fn(attempt); }
    catch (e: any) {
      lastErr = e;
      const desc = String(e?.description || e?.message || '').toLowerCase();
      // Don't retry client-side/permanent failures
      if (desc.includes('unauthorized') || desc.includes('chat not found') ||
          desc.includes('bot was blocked') || desc.includes('forbidden')) throw e;
      if (attempt === retries) throw e;
      opts.onRetry?.(attempt, e);
      await new Promise(r => setTimeout(r, baseMs * Math.pow(2, attempt - 1)));
    }
  }
  throw lastErr;
}

// ─── Versioning / ETag ───
const VERSION_KEY = 'pos_branch_versions';

interface VersionMap { [branchId: string]: number }

function readVersionMap(): VersionMap {
  try {
    const raw = localStorage.getItem(VERSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function writeVersionMap(m: VersionMap) {
  try { localStorage.setItem(VERSION_KEY, JSON.stringify(m)); } catch { /* quota */ }
}

export function getKnownVersion(branchId: string): number {
  return readVersionMap()[branchId] || 0;
}

export function bumpAndGetVersion(branchId: string): number {
  const m = readVersionMap();
  m[branchId] = (m[branchId] || 0) + 1;
  writeVersionMap(m);
  return m[branchId];
}

export function rememberVersion(branchId: string, version: number) {
  const m = readVersionMap();
  if (!m[branchId] || version > m[branchId]) {
    m[branchId] = version;
    writeVersionMap(m);
  }
}

// ─── Delta metadata: per-key hashes ───
function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

export function computeKeyHashes(data: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of SNAPSHOT_KEYS) {
    if (!(k in data)) continue;
    try { out[k] = hashString(JSON.stringify(data[k])); }
    catch { out[k] = '0'; }
  }
  return out;
}

/** Given two snapshots' key-hash maps, list the keys that differ. */
export function diffKeyHashes(prev: Record<string, string> | undefined, next: Record<string, string>): string[] {
  const changed: string[] = [];
  const prevMap = prev || {};
  for (const k of Object.keys(next)) if (prevMap[k] !== next[k]) changed.push(k);
  for (const k of Object.keys(prevMap)) if (!(k in next)) changed.push(k);
  return changed;
}

// ─── Backup / Restore (branch snapshot as JSON file) ───
export interface BranchBackupFile {
  _fileType: 'pos-branch-backup';
  _version: number;
  branchId: string;
  branchName: string;
  timestamp: number;
  data: Record<string, any>;
}

export function serializeBranchBackup(branchId: string, branchName: string, data: Record<string, any>): string {
  const payload: BranchBackupFile = {
    _fileType: 'pos-branch-backup',
    _version: 1,
    branchId,
    branchName,
    timestamp: Date.now(),
    data,
  };
  return JSON.stringify(payload, null, 2);
}

/** Compressed variant for smaller downloads. */
export function serializeBranchBackupCompressed(branchId: string, branchName: string, data: Record<string, any>): string {
  return LZString.compressToBase64(serializeBranchBackup(branchId, branchName, data));
}

export function parseBranchBackup(raw: string): BranchBackupFile {
  let text = raw.trim();
  // Support both compressed and plain JSON files.
  if (!text.startsWith('{')) {
    const decompressed = LZString.decompressFromBase64(text);
    if (decompressed) text = decompressed;
  }
  const parsed = JSON.parse(text);
  if (parsed?._fileType !== 'pos-branch-backup' || !parsed.data) {
    throw new Error('ملف النسخة الاحتياطية غير صالح (النوع مش pos-branch-backup)');
  }
  return parsed as BranchBackupFile;
}

export function triggerFileDownload(filename: string, contents: string, mime = 'application/json') {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
