// Font customization system
export interface FontConfig {
  fontFamily: string;
  fontWeight: 'normal' | 'bold' | 'bolder';
}

export const AVAILABLE_FONTS = [
  { id: 'cairo', name: 'Cairo', family: "'Cairo', sans-serif" },
  { id: 'tajawal', name: 'Tajawal', family: "'Tajawal', sans-serif" },
  { id: 'noto-kufi', name: 'Noto Kufi Arabic', family: "'Noto Kufi Arabic', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;700;900&display=swap' },
  { id: 'amiri', name: 'Amiri', family: "'Amiri', serif", url: 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap' },
  { id: 'readex', name: 'Readex Pro', family: "'Readex Pro', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;600;700&display=swap' },
  { id: 'ibm-plex', name: 'IBM Plex Sans Arabic', family: "'IBM Plex Sans Arabic', sans-serif", url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap' },
  { id: 'rubik', name: 'Rubik', family: "'Rubik', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Rubik:wght@400;600;700;900&display=swap' },
  { id: 'almarai', name: 'Almarai', family: "'Almarai', sans-serif", url: 'https://fonts.googleapis.com/css2?family=Almarai:wght@400;700;800&display=swap' },
];

const FONT_KEY = 'pos_font_config';
const FONT_PERMISSION_KEY = 'pos_font_permission_cashier';

const DEFAULT_CONFIG: FontConfig = {
  fontFamily: 'cairo',
  fontWeight: 'normal',
};

export function getFontConfig(): FontConfig {
  try {
    const raw = localStorage.getItem(FONT_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

export function saveFontConfig(config: FontConfig) {
  localStorage.setItem(FONT_KEY, JSON.stringify(config));
  applyFont(config);
}

export function isFontPermissionGranted(): boolean {
  return localStorage.getItem(FONT_PERMISSION_KEY) === 'true';
}

export function setFontPermission(granted: boolean) {
  localStorage.setItem(FONT_PERMISSION_KEY, granted ? 'true' : 'false');
}

export function applyFont(config: FontConfig) {
  const font = AVAILABLE_FONTS.find(f => f.id === config.fontFamily);
  if (!font) return;

  // Load font if needed
  if (font.url) {
    const existingLink = document.querySelector(`link[data-font-id="${font.id}"]`);
    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = font.url;
      link.setAttribute('data-font-id', font.id);
      document.head.appendChild(link);
    }
  }

  document.documentElement.style.setProperty('--app-font', font.family);
  document.body.style.fontFamily = font.family;
  document.body.style.fontWeight = config.fontWeight;
}

// Initialize on load
if (typeof window !== 'undefined') {
  const config = getFontConfig();
  if (config.fontFamily !== 'cairo' || config.fontWeight !== 'normal') {
    requestAnimationFrame(() => applyFont(config));
  }
}
