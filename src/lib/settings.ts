export interface POSSettings {
  printEnabled: boolean;
  paperSize: '58mm' | '80mm';
  scanMode: 'scanner' | 'camera' | 'both';
  showShiftSalesCount: boolean;
  showShiftSalesTotal: boolean;
}

export interface StoreInfo {
  name: string;
  address: string;
  phone: string;
  extra1Label: string;
  extra1Value: string;
  extra2Label: string;
  extra2Value: string;
}

const SETTINGS_KEY = 'pos_settings';
const STORE_INFO_KEY = 'pos_store_info';
const CATEGORIES_KEY = 'pos_categories';

const DEFAULT_SETTINGS: POSSettings = {
  printEnabled: true,
  paperSize: '80mm',
  scanMode: 'scanner',
  showShiftSalesCount: false,
  showShiftSalesTotal: false,
};

const DEFAULT_STORE_INFO: StoreInfo = {
  name: 'سوبرماركت',
  address: '',
  phone: '',
  extra1Label: '',
  extra1Value: '',
  extra2Label: '',
  extra2Value: '',
};

const DEFAULT_SUPERMARKET_CATEGORIES = ['سناكس', 'مشروبات', 'ألبان', 'مخبوزات', 'بقالة'];
const DEFAULT_CAFE_CATEGORIES = ['مشروبات ساخنة', 'مشروبات باردة', 'حلويات'];

export function getSettings(): POSSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: POSSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getStoreInfo(): StoreInfo {
  try {
    const raw = localStorage.getItem(STORE_INFO_KEY);
    return raw ? { ...DEFAULT_STORE_INFO, ...JSON.parse(raw) } : DEFAULT_STORE_INFO;
  } catch {
    return DEFAULT_STORE_INFO;
  }
}

export function saveStoreInfo(info: StoreInfo) {
  localStorage.setItem(STORE_INFO_KEY, JSON.stringify(info));
}

export function getCategories(type: 'supermarket' | 'cafe'): string[] {
  try {
    const raw = localStorage.getItem(`${CATEGORIES_KEY}_${type}`);
    if (raw) return JSON.parse(raw);
    return type === 'supermarket' ? DEFAULT_SUPERMARKET_CATEGORIES : DEFAULT_CAFE_CATEGORIES;
  } catch {
    return type === 'supermarket' ? DEFAULT_SUPERMARKET_CATEGORIES : DEFAULT_CAFE_CATEGORIES;
  }
}

export function saveCategories(type: 'supermarket' | 'cafe', categories: string[]) {
  localStorage.setItem(`${CATEGORIES_KEY}_${type}`, JSON.stringify(categories));
}
