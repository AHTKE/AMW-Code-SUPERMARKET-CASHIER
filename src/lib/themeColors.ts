// Theme color system - 20 color presets
export interface ThemeColor {
  id: string;
  name: string;
  hue: number;
  saturation: number;
  lightnessDark: number;
  lightnessLight: number;
}

export const THEME_COLORS: ThemeColor[] = [
  { id: 'teal', name: 'تيل', hue: 195, saturation: 16, lightnessDark: 20, lightnessLight: 97 },
  { id: 'blue', name: 'أزرق', hue: 220, saturation: 25, lightnessDark: 18, lightnessLight: 97 },
  { id: 'indigo', name: 'نيلي', hue: 240, saturation: 20, lightnessDark: 16, lightnessLight: 97 },
  { id: 'purple', name: 'بنفسجي', hue: 270, saturation: 20, lightnessDark: 16, lightnessLight: 97 },
  { id: 'pink', name: 'وردي', hue: 330, saturation: 18, lightnessDark: 16, lightnessLight: 97 },
  { id: 'red', name: 'أحمر', hue: 0, saturation: 18, lightnessDark: 16, lightnessLight: 97 },
  { id: 'orange', name: 'برتقالي', hue: 25, saturation: 20, lightnessDark: 16, lightnessLight: 97 },
  { id: 'amber', name: 'كهرماني', hue: 40, saturation: 22, lightnessDark: 16, lightnessLight: 97 },
  { id: 'yellow', name: 'أصفر', hue: 50, saturation: 20, lightnessDark: 16, lightnessLight: 97 },
  { id: 'lime', name: 'ليموني', hue: 80, saturation: 18, lightnessDark: 16, lightnessLight: 97 },
  { id: 'green', name: 'أخضر', hue: 145, saturation: 18, lightnessDark: 16, lightnessLight: 97 },
  { id: 'emerald', name: 'زمردي', hue: 160, saturation: 20, lightnessDark: 16, lightnessLight: 97 },
  { id: 'cyan', name: 'سماوي', hue: 185, saturation: 20, lightnessDark: 16, lightnessLight: 97 },
  { id: 'slate', name: 'رمادي', hue: 210, saturation: 10, lightnessDark: 16, lightnessLight: 97 },
  { id: 'zinc', name: 'زنك', hue: 220, saturation: 5, lightnessDark: 14, lightnessLight: 97 },
  { id: 'stone', name: 'حجري', hue: 30, saturation: 8, lightnessDark: 14, lightnessLight: 97 },
  { id: 'rose', name: 'وردي فاتح', hue: 350, saturation: 22, lightnessDark: 16, lightnessLight: 97 },
  { id: 'fuchsia', name: 'فوشيا', hue: 290, saturation: 22, lightnessDark: 16, lightnessLight: 97 },
  { id: 'sky', name: 'سماء', hue: 200, saturation: 25, lightnessDark: 18, lightnessLight: 97 },
  { id: 'violet', name: 'بنفسجي غامق', hue: 260, saturation: 22, lightnessDark: 16, lightnessLight: 97 },
];

const THEME_COLOR_KEY = 'pos_theme_color';

export function getActiveThemeColor(): string {
  return localStorage.getItem(THEME_COLOR_KEY) || 'teal';
}

export function setActiveThemeColor(colorId: string) {
  localStorage.setItem(THEME_COLOR_KEY, colorId);
  applyThemeColor(colorId);
}

export function resetThemeColor() {
  localStorage.removeItem(THEME_COLOR_KEY);
  clearThemeOverrides();
}

function clearThemeOverrides() {
  const root = document.documentElement;
  const props = [
    '--background', '--card', '--popover', '--secondary', '--muted',
    '--muted-foreground', '--accent', '--border', '--input',
    '--sidebar-background', '--sidebar-accent', '--sidebar-border',
    '--foreground', '--card-foreground', '--popover-foreground',
    '--primary', '--primary-foreground', '--secondary-foreground',
    '--accent-foreground', '--ring',
    '--sidebar-foreground', '--sidebar-primary', '--sidebar-primary-foreground',
    '--sidebar-accent-foreground', '--sidebar-ring',
  ];
  props.forEach(p => root.style.removeProperty(p));
}

export function applyThemeColor(colorId: string) {
  const color = THEME_COLORS.find(c => c.id === colorId);
  if (!color) return;
  
  const root = document.documentElement;
  const isLight = root.classList.contains('light');
  
  const h = color.hue;
  const s = color.saturation;
  
  if (isLight) {
    // Light mode
    root.style.setProperty('--background', `${h} ${s}% ${color.lightnessLight}%`);
    root.style.setProperty('--foreground', `${h} ${Math.max(s - 5, 5)}% 15%`);
    root.style.setProperty('--card', `0 0% 100%`);
    root.style.setProperty('--card-foreground', `${h} ${Math.max(s - 5, 5)}% 15%`);
    root.style.setProperty('--popover', `0 0% 100%`);
    root.style.setProperty('--popover-foreground', `${h} ${Math.max(s - 5, 5)}% 15%`);
    root.style.setProperty('--primary', `${h} ${Math.max(s - 5, 5)}% 15%`);
    root.style.setProperty('--primary-foreground', `0 0% 100%`);
    root.style.setProperty('--secondary', `${h} ${Math.max(s - 6, 3)}% 92%`);
    root.style.setProperty('--secondary-foreground', `${h} ${Math.max(s - 5, 5)}% 15%`);
    root.style.setProperty('--muted', `${h} ${Math.max(s - 6, 3)}% 90%`);
    root.style.setProperty('--muted-foreground', `${h} ${Math.max(s - 8, 2)}% 45%`);
    root.style.setProperty('--accent', `${h} ${Math.max(s - 6, 3)}% 92%`);
    root.style.setProperty('--accent-foreground', `${h} ${Math.max(s - 5, 5)}% 15%`);
    root.style.setProperty('--border', `${h} ${Math.max(s - 6, 3)}% 85%`);
    root.style.setProperty('--input', `${h} ${Math.max(s - 6, 3)}% 85%`);
    root.style.setProperty('--ring', `${h} ${Math.max(s - 5, 5)}% 15%`);
    root.style.setProperty('--sidebar-background', `${h} ${s}% 98%`);
    root.style.setProperty('--sidebar-foreground', `${h} ${Math.max(s - 5, 5)}% 20%`);
    root.style.setProperty('--sidebar-accent', `${h} ${Math.max(s - 6, 3)}% 94%`);
    root.style.setProperty('--sidebar-accent-foreground', `${h} ${Math.max(s - 5, 5)}% 20%`);
    root.style.setProperty('--sidebar-border', `${h} ${Math.max(s - 6, 3)}% 88%`);
  } else {
    // Dark mode
    root.style.setProperty('--background', `${h} ${s}% ${color.lightnessDark}%`);
    root.style.setProperty('--card', `${h} ${s + 2}% ${color.lightnessDark - 4}%`);
    root.style.setProperty('--popover', `${h} ${s + 2}% ${color.lightnessDark - 4}%`);
    root.style.setProperty('--secondary', `${h} ${s - 2}% ${color.lightnessDark + 8}%`);
    root.style.setProperty('--muted', `${h} ${s - 4}% ${color.lightnessDark + 5}%`);
    root.style.setProperty('--muted-foreground', `${h} ${s - 8}% 60%`);
    root.style.setProperty('--accent', `${h} ${s - 2}% ${color.lightnessDark + 8}%`);
    root.style.setProperty('--border', `${h} ${s - 4}% ${color.lightnessDark + 10}%`);
    root.style.setProperty('--input', `${h} ${s - 4}% ${color.lightnessDark + 10}%`);
    root.style.setProperty('--sidebar-background', `${h} ${s + 2}% ${color.lightnessDark - 6}%`);
    root.style.setProperty('--sidebar-accent', `${h} ${s - 2}% ${color.lightnessDark + 2}%`);
    root.style.setProperty('--sidebar-border', `${h} ${s - 4}% ${color.lightnessDark + 5}%`);
  }
}

// Initialize on load
if (typeof window !== 'undefined') {
  const saved = getActiveThemeColor();
  if (saved !== 'teal') {
    // Delay to allow CSS to load first
    requestAnimationFrame(() => applyThemeColor(saved));
  }
}
