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
      if (merge && Array.isArray(data[key])) {
        // Merge arrays by id, avoiding duplicates
        const existingRaw = localStorage.getItem(key);
        if (existingRaw) {
          try {
            const existing = JSON.parse(existingRaw);
            if (Array.isArray(existing)) {
              const existingIds = new Set(existing.map((item: any) => item.id).filter(Boolean));
              const newItems = data[key].filter((item: any) => !item.id || !existingIds.has(item.id));
              const merged = [...existing, ...newItems];
              localStorage.setItem(key, JSON.stringify(merged));
              continue;
            }
          } catch {}
        }
      }
      localStorage.setItem(key, JSON.stringify(data[key]));
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
