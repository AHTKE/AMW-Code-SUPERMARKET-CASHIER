import { useEffect, useRef } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      // Allow F-keys even in inputs, block others in inputs
      const isFKey = e.key.startsWith('F') && e.key.length <= 3;
      if (!isFKey && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) return;

      let key = '';
      if (e.ctrlKey) key += 'Ctrl+';
      if (e.shiftKey) key += 'Shift+';
      if (e.altKey) key += 'Alt+';
      key += e.key;

      const action = shortcutsRef.current[key];
      if (action) {
        e.preventDefault();
        e.stopPropagation();
        action();
      }
    };

    // Use capture phase for fastest response
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);
}

// Default POS shortcuts
export const POS_SHORTCUT_LABELS: Record<string, string> = {
  'F1': 'إظهار الاختصارات',
  'F2': 'تبديل سوبرماركت / كافيه',
  'F4': 'فتح الإعدادات',
  'F8': 'دفع الفاتورة',
  'Escape': 'مسح الفاتورة',
  'F10': 'لوحة المدير',
  'F11': 'ملء الشاشة',
  'F12': 'تسجيل خروج',
};
