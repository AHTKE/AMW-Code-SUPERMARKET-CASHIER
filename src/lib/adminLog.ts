// Admin Activity Log System
export interface AdminLogEntry {
  id: string;
  timestamp: number;
  action: string;
  details: string;
  user: string;
}

const LOG_KEY = 'pos_admin_activity_log';

export function getAdminLog(): AdminLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLog(log: AdminLogEntry[]) {
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

export function addLogEntry(action: string, details: string, user: string = 'المدير') {
  const log = getAdminLog();
  log.push({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    action,
    details,
    user,
  });
  saveLog(log);
}

export function deleteLogEntries(ids: string[]) {
  const log = getAdminLog().filter(e => !ids.includes(e.id));
  saveLog(log);
}

export function clearAllLogs() {
  saveLog([]);
}
