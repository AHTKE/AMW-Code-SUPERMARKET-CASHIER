import { useState, useEffect, useRef } from 'react';
import { POSMode } from '@/types/pos';
import { ShoppingCart, Coffee, Lock, LogOut, Settings, Keyboard, Sun, Moon, Palette, RotateCcw } from 'lucide-react';
import { THEME_COLORS, getActiveThemeColor, setActiveThemeColor, resetThemeColor, applyThemeColor } from '@/lib/themeColors';

interface TopBarProps {
  mode: POSMode;
  onToggleMode: () => void;
  cashierName: string;
  onOpenAdmin?: () => void;
  onLogout?: () => void;
  onOpenSettings?: () => void;
  onShowShortcuts?: () => void;
  extraButtons?: React.ReactNode;
}

const THEME_KEY = 'pos_theme';

export function getTheme(): 'dark' | 'light' {
  return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark';
}

export function setTheme(theme: 'dark' | 'light') {
  localStorage.setItem(THEME_KEY, theme);
  if (theme === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
  // Re-apply color theme after mode switch
  const colorId = getActiveThemeColor();
  if (colorId !== 'teal') {
    setTimeout(() => applyThemeColor(colorId), 50);
  }
}

// Initialize theme on load
if (typeof window !== 'undefined') {
  const saved = getTheme();
  if (saved === 'light') {
    document.documentElement.classList.add('light');
  }
}

const TopBar = ({ mode, onToggleMode, cashierName, onOpenAdmin, onLogout, onOpenSettings, onShowShortcuts, extraButtons }: TopBarProps) => {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [theme, setThemeState] = useState(getTheme());
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activeColor, setActiveColor] = useState(getActiveThemeColor());
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString('ar-EG'));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    if (showColorPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    setThemeState(newTheme);
  };

  const handleColorSelect = (colorId: string) => {
    setActiveThemeColor(colorId);
    setActiveColor(colorId);
    setShowColorPicker(false);
  };

  const handleColorReset = () => {
    resetThemeColor();
    setActiveColor('teal');
    setShowColorPicker(false);
  };

  const isSupermarket = mode === 'supermarket';

  return (
    <div
      className={`h-14 flex items-center justify-between px-3 transition-colors duration-200 ${
        isSupermarket ? 'bg-supermarket' : 'bg-cafe'
      }`}
    >
      <div className="flex items-center gap-2 font-cairo text-xs font-bold text-supermarket-foreground">
        <span>👤 {cashierName}</span>
        <span className="opacity-70 hidden sm:inline">|</span>
        <span className="opacity-70 hidden sm:inline">{dateStr}</span>
        <span className="opacity-70 hidden sm:inline">{timeStr}</span>
      </div>

      <button
        onClick={onToggleMode}
        className="flex items-center gap-2 bg-background/30 hover:bg-background/50 px-4 py-2 rounded font-cairo font-bold text-xs text-foreground transition-colors duration-100 active:scale-95 select-none"
        title="F2"
      >
        {isSupermarket ? (
          <>
            <Coffee className="w-4 h-4" />
            <span className="hidden sm:inline">تحويل للكافيه</span>
          </>
        ) : (
          <>
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">تحويل للسوبرماركت</span>
          </>
        )}
      </button>

      <div className="flex items-center gap-1">
        {extraButtons}

        {/* Color picker */}
        <div className="relative" ref={colorPickerRef}>
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="flex items-center gap-1 bg-background/30 hover:bg-background/50 px-2 py-2 rounded text-foreground transition-colors"
            title="تغيير لون التصميم"
          >
            <Palette className="w-4 h-4" />
          </button>
          {showColorPicker && (
            <div className="absolute left-0 top-full mt-1 bg-card border border-border rounded-lg p-3 shadow-lg z-50 w-[220px]">
              <p className="font-cairo text-xs text-muted-foreground mb-2">اختر لون التصميم</p>
              <div className="grid grid-cols-5 gap-1.5">
                {THEME_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => handleColorSelect(color.id)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      activeColor === color.id ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: `hsl(${color.hue}, ${color.saturation + 30}%, 45%)` }}
                    title={color.name}
                  />
                ))}
              </div>
              <button
                onClick={handleColorReset}
                className="w-full flex items-center justify-center gap-1 mt-2 py-1.5 rounded font-cairo font-bold text-[10px] bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                إرجاع للوضع الأصلي
              </button>
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          className="flex items-center gap-1 bg-background/30 hover:bg-background/50 px-2 py-2 rounded text-foreground transition-colors"
          title="الوضع الليلي/النهاري"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {onShowShortcuts && (
          <button
            onClick={onShowShortcuts}
            className="flex items-center gap-1 bg-background/30 hover:bg-background/50 px-2 py-2 rounded font-cairo font-bold text-xs text-foreground transition-colors"
            title="F1 - اختصارات"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1 bg-background/30 hover:bg-background/50 px-2 py-2 rounded font-cairo font-bold text-xs text-foreground transition-colors"
            title="F4"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1 bg-destructive/30 hover:bg-destructive/50 px-2 py-2 rounded font-cairo font-bold text-xs text-foreground transition-colors"
            title="F12"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1 bg-background/30 hover:bg-background/50 px-2 py-2 rounded font-cairo font-bold text-xs text-foreground transition-colors"
            title="F10"
          >
            <Lock className="w-4 h-4" />
          </button>
        )}
        <div className="font-cairo font-black text-sm text-supermarket-foreground mr-1">
          {isSupermarket ? '🛒' : '☕'}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
