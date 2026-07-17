// QR-based sync helpers.
// - Compresses the JSON payload with lz-string (URI-safe alphabet).
// - Splits into chunks of ~800 chars so each chunk fits comfortably in a QR code
//   at error-correction level M without becoming unreadable on a phone screen.
// - Chunk format: LSYNC|v1|<idx>|<total>|<payload>
//   (idx is 1-based to be human friendly on the UI)

import LZString from 'lz-string';

export const CHUNK_HEADER = 'LSYNC';
export const CHUNK_VERSION = 'v1';
export const CHUNK_SIZE = 800;

export interface AssemblyState {
  total: number;
  received: Map<number, string>;
}

export function buildChunks(json: string): string[] {
  const compressed = LZString.compressToEncodedURIComponent(json);
  const chunks: string[] = [];
  for (let i = 0; i < compressed.length; i += CHUNK_SIZE) {
    chunks.push(compressed.slice(i, i + CHUNK_SIZE));
  }
  const total = chunks.length;
  return chunks.map((c, i) => `${CHUNK_HEADER}|${CHUNK_VERSION}|${i + 1}|${total}|${c}`);
}

export interface ParsedChunk {
  idx: number;
  total: number;
  payload: string;
}

export function parseChunk(raw: string): ParsedChunk | null {
  if (!raw || !raw.startsWith(CHUNK_HEADER + '|')) return null;
  const parts = raw.split('|');
  if (parts.length < 5) return null;
  const [, version, idxStr, totalStr, ...rest] = parts;
  if (version !== CHUNK_VERSION) return null;
  const idx = Number(idxStr);
  const total = Number(totalStr);
  if (!Number.isFinite(idx) || !Number.isFinite(total) || idx < 1 || total < 1 || idx > total) {
    return null;
  }
  return { idx, total, payload: rest.join('|') };
}

export function tryAssemble(state: AssemblyState): string | null {
  if (state.received.size !== state.total) return null;
  let combined = '';
  for (let i = 1; i <= state.total; i++) {
    const p = state.received.get(i);
    if (p === undefined) return null;
    combined += p;
  }
  const json = LZString.decompressFromEncodedURIComponent(combined);
  return json || null;
}
