// Data export/import/merge/factory reset utilities

const ALL_KEYS = [
  'pos_products',
  'pos_sales',
  'pos_expenses',
  'pos_income',
  'pos_admin_credentials',
  'pos_cashiers',
  'pos_cashier_sessions',
  'pos_returns',
  'pos_settings',
  'pos_store_info',
  'pos_categories_supermarket',
  'pos_categories_cafe',
  'pos_held_invoices',
  'pos_global_cashier_permissions',
  'pos_coupons',
  'pos_product_offers',
];

const FACTORY_RESET_PROTECTED_KEYS = new Set([
  'pos_device_activated',
  'pos_device_id',
]);

export type DataCategory = 'products' | 'sales' | 'expenses' | 'income' | 'cashiers' | 'sessions' | 'returns' | 'settings' | 'held';

const CATEGORY_KEYS: Record<DataCategory, string[]> = {
  products: ['pos_products', 'pos_categories_supermarket', 'pos_categories_cafe'],
  sales: ['pos_sales'],
  expenses: ['pos_expenses'],
  income: ['pos_income'],
  cashiers: ['pos_cashiers'],
  sessions: ['pos_cashier_sessions'],
  returns: ['pos_returns'],
  settings: ['pos_settings', 'pos_store_info', 'pos_admin_credentials', 'pos_global_cashier_permissions', 'pos_coupons', 'pos_product_offers'],
  held: ['pos_held_invoices'],
};

export function exportData(categories?: DataCategory[]): string {
  const data: Record<string, any> = {};
  const keys = categories
    ? categories.flatMap(c => CATEGORY_KEYS[c])
    : ALL_KEYS;

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
    }
  }

  data._exportDate = new Date().toISOString();
  data._version = '1.0';
  return JSON.stringify(data, null, 2);
}

export function importData(jsonStr: string, merge: boolean = false): { success: boolean; message: string } {
  try {
    const data = JSON.parse(jsonStr);
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'ملف غير صالح' };
    }

    const keys = Object.keys(data).filter(k => !k.startsWith('_'));

    for (const key of keys) {
      const incoming = data[key];

      if (merge) {
        // SMART MERGE:
        // - Arrays: upsert by id (new/edited items replace existing with same id, others kept).
        //   Empty incoming arrays are IGNORED so an admin's empty sales/expenses list
        //   doesn't wipe the cashier's real data.
        // - Objects / scalars: only overwrite if incoming has content (non-empty).
        if (Array.isArray(incoming)) {
          if (incoming.length === 0) {
            // preserve existing data
            continue;
          }
          const existingRaw = localStorage.getItem(key);
          let existing: any[] = [];
          if (existingRaw) {
            try {
              const parsed = JSON.parse(existingRaw);
              if (Array.isArray(parsed)) existing = parsed;
            } catch {}
          }
          const incomingIds = new Set(
            incoming.map((it: any) => it?.id).filter((v: any) => v !== undefined && v !== null)
          );
          // Keep existing items that are NOT being updated by incoming
          const kept = existing.filter((it: any) => !it?.id || !incomingIds.has(it.id));
          // Incoming items overwrite / add
          const merged = [...kept, ...incoming];
          localStorage.setItem(key, JSON.stringify(merged));
          continue;
        }

        if (incoming && typeof incoming === 'object') {
          if (Object.keys(incoming).length === 0) continue;
          const existingRaw = localStorage.getItem(key);
          let existing: any = {};
          if (existingRaw) {
            try { existing = JSON.parse(existingRaw) || {}; } catch {}
          }
          localStorage.setItem(key, JSON.stringify({ ...existing, ...incoming }));
          continue;
        }

        // primitive
        if (incoming === null || incoming === undefined || incoming === '') continue;
        localStorage.setItem(key, JSON.stringify(incoming));
      } else {
        // REPLACE: raw overwrite (old behavior)
        localStorage.setItem(key, JSON.stringify(incoming));
      }
    }

    return { success: true, message: `تم ${merge ? 'دمج' : 'استيراد'} ${keys.length} فئة بنجاح` };
  } catch {
    return { success: false, message: 'خطأ في قراءة الملف' };
  }
}

export function factoryReset() {
  // Remove all POS-related keys except device activation keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('pos_') && !FACTORY_RESET_PROTECTED_KEYS.has(key)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

export const CATEGORY_LABELS: Record<DataCategory, string> = {
  products: 'المنتجات والتصنيفات',
  sales: 'المبيعات',
  expenses: 'المصروفات',
  income: 'الدخل',
  cashiers: 'الكاشيرات',
  sessions: 'سجل الحضور',
  returns: 'المرتجعات',
  settings: 'الإعدادات',
  held: 'الفواتير المعلقة',
};
