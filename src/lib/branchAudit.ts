// Local audit log for branch sync operations.
// Records every upload / download / apply / conflict / delete with actor,
// timestamp, target branch and outcome so managers can review activity
// without depending on the remote channel.

export type BranchAuditKind =
  | 'upload'
  | 'download'
  | 'apply'
  | 'conflict'
  | 'delete'
  | 'restore'
  | 'backup';

export interface BranchAuditEntry {
  id: string;
  timestamp: number;
  kind: BranchAuditKind;
  actor: string;            // e.g. "manager", "branch:فرع 1"
  branchId: string;
  branchName: string;
  ok: boolean;
  message?: string;
  bytes?: number;
  version?: number;
  parentVersion?: number;
}

const KEY = 'pos_branch_sync_audit';
const MAX_ENTRIES = 500;

function read(): BranchAuditEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function write(list: BranchAuditEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ENTRIES))); } catch { /* quota */ }
}

export function logBranchAudit(entry: Omit<BranchAuditEntry, 'id' | 'timestamp'>) {
  const list = read();
  list.push({
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  });
  write(list);
  try { window.dispatchEvent(new Event('pos-branch-audit-changed')); } catch { /* SSR */ }
}

export function getBranchAudit(): BranchAuditEntry[] {
  return read().slice().reverse();
}

export function clearBranchAudit() {
  write([]);
  try { window.dispatchEvent(new Event('pos-branch-audit-changed')); } catch { /* SSR */ }
}
