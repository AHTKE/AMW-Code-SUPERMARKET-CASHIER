export const CUSTOM_SHORTCUTS_KEY = 'pos_custom_shortcuts';

export interface CustomShortcut {
  id: string;
  key: string;
  action: string;
  label: string;
}

export function getShortcutsKey(cashierId?: string): string {
  return cashierId ? `pos_shortcuts_${cashierId}` : CUSTOM_SHORTCUTS_KEY;
}

export function getCustomShortcuts(cashierId?: string): CustomShortcut[] {
  try {
    if (cashierId) {
      const raw = localStorage.getItem(`pos_shortcuts_${cashierId}`);
      if (raw) return JSON.parse(raw);
    }
    const raw = localStorage.getItem(CUSTOM_SHORTCUTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomShortcuts(shortcuts: CustomShortcut[], cashierId?: string) {
  const key = getShortcutsKey(cashierId);
  localStorage.setItem(key, JSON.stringify(shortcuts));
}
