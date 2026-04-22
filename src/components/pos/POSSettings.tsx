import { useState } from 'react';
import { getSettings, saveSettings, POSSettings as POSSettingsType } from '@/lib/settings';
import { Settings, Printer, Camera, ScanBarcode, Save, CheckCircle, Plus, Trash2, RefreshCw } from 'lucide-react';

interface POSSettingsProps {
  onClose: () => void;
  cashierId?: string;
}

const CUSTOM_SHORTCUTS_KEY = 'pos_custom_shortcuts';

interface CustomShortcut {
  id: string;
  key: string;
  action: string;
  label: string;
}

const ALL_ACTIONS = [
  { value: 'toggle_mode', label: 'تبديل سوبرماركت / كافيه' },
  { value: 'open_settings', label: 'فتح الإعدادات' },
  { value: 'pay', label: 'دفع الفاتورة' },
  { value: 'clear_cart', label: 'مسح الفاتورة' },
  { value: 'admin_login', label: 'لوحة المدير' },
  { value: 'logout', label: 'تسجيل خروج / إغلاق شيفت' },
  { value: 'show_shortcuts', label: 'إظهار الاختصارات' },
  { value: 'toggle_manual_barcode', label: 'إظهار/إخفاء إدخال الباركود اليدوي' },
  { value: 'focus_search', label: 'التركيز على البحث' },
  { value: 'next_category', label: 'التصنيف التالي' },
  { value: 'prev_category', label: 'التصنيف السابق' },
  { value: 'next_page', label: 'الصفحة التالية' },
  { value: 'prev_page', label: 'الصفحة السابقة' },
  { value: 'increase_qty_last', label: 'زيادة كمية آخر منتج' },
  { value: 'decrease_qty_last', label: 'تقليل كمية آخر منتج' },
  { value: 'remove_last_item', label: 'حذف آخر منتج من الفاتورة' },
  { value: 'print_receipt', label: 'طباعة الفاتورة' },
  { value: 'toggle_fullscreen', label: 'ملء الشاشة (F11)' },
  { value: 'undo_last_action', label: 'تراجع (حذف آخر عنصر)' },
  { value: 'view_sales', label: 'عرض فواتيري' },
  { value: 'hold_invoice', label: 'تعليق الفاتورة' },
  { value: 'recall_invoice', label: 'استرجاع فاتورة معلقة' },
  { value: 'refresh_page', label: 'تحديث الصفحة' },
];

// Per-cashier shortcut storage
function getShortcutsKey(cashierId?: string): string {
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
  } catch { return []; }
}

function saveCustomShortcuts(shortcuts: CustomShortcut[], cashierId?: string) {
  const key = getShortcutsKey(cashierId);
  localStorage.setItem(key, JSON.stringify(shortcuts));
}

const POSSettings = ({ onClose, cashierId }: POSSettingsProps) => {
  const [settings, setSettings] = useState<POSSettingsType>(getSettings());
  const [saved, setSaved] = useState(false);
  const [customShortcuts, setCustomShortcuts] = useState<CustomShortcut[]>(getCustomShortcuts(cashierId));
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'shortcuts'>('general');

  const handleSave = () => {
    saveSettings(settings);
    saveCustomShortcuts(customShortcuts, cashierId);
    setSaved(true);
    // Dispatch event so POS page re-reads settings immediately
    window.dispatchEvent(new Event('pos-settings-changed'));
    setTimeout(() => setSaved(false), 2000);
  };

  const addShortcut = () => {
    const newShortcut: CustomShortcut = {
      id: crypto.randomUUID(),
      key: '',
      action: ALL_ACTIONS[0].value,
      label: ALL_ACTIONS[0].label,
    };
    setCustomShortcuts([...customShortcuts, newShortcut]);
  };

  const removeShortcut = (id: string) => {
    setCustomShortcuts(customShortcuts.filter(s => s.id !== id));
  };

  const updateShortcut = (id: string, field: Partial<CustomShortcut>) => {
    setCustomShortcuts(customShortcuts.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, ...field };
      if (field.action) {
        updated.label = ALL_ACTIONS.find(a => a.value === field.action)?.label || '';
      }
      return updated;
    }));
  };

  const handleKeyRecord = (id: string, e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let key = '';
    if (e.ctrlKey) key += 'Ctrl+';
    if (e.shiftKey) key += 'Shift+';
    if (e.altKey) key += 'Alt+';
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      key += e.key;
    } else {
      return;
    }
    updateShortcut(id, { key });
    setRecordingId(null);
  };

  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-cairo font-black text-xl flex items-center gap-2">
            <Settings className="w-5 h-5" />
            إعدادات نقطة البيع
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl font-bold">✕</button>
        </div>

        {cashierId && (
          <div className="text-xs text-muted-foreground font-cairo bg-secondary rounded p-2 text-center">
            ⌨️ الاختصارات خاصة بك وحدك - كل كاشير له اختصاراته
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-2 rounded font-cairo font-bold text-sm transition-colors ${
              activeTab === 'general' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >
            ⚙️ عام
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`flex-1 py-2 rounded font-cairo font-bold text-sm transition-colors ${
              activeTab === 'shortcuts' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'
            }`}
          >
            ⌨️ اختصارات
          </button>
        </div>

        {activeTab === 'general' && (
          <div className="space-y-4">
            <div className="bg-secondary rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-supermarket" />
                  <span className="font-cairo font-bold text-sm">طباعة الفاتورة تلقائياً</span>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, printEnabled: !settings.printEnabled })}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    settings.printEnabled ? 'bg-success' : 'bg-muted'
                  }`}
                >
                  <div className={`w-5 h-5 bg-foreground rounded-full absolute top-1 transition-all ${
                    settings.printEnabled ? 'left-1' : 'left-6'
                  }`} />
                </button>
              </div>
            </div>

            <div className="bg-secondary rounded-lg p-4 space-y-3">
              <span className="font-cairo font-bold text-sm">📄 حجم الورق</span>
              <div className="flex gap-3">
                {(['58mm', '80mm'] as const).map(size => (
                  <button
                    key={size}
                    onClick={() => setSettings({ ...settings, paperSize: size })}
                    className={`flex-1 py-2 rounded-lg font-cairo font-bold text-sm transition-colors ${
                      settings.paperSize === size
                        ? 'bg-supermarket text-supermarket-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-secondary rounded-lg p-4 space-y-3">
              <span className="font-cairo font-bold text-sm">🔍 طريقة قراءة الباركود</span>
              <div className="flex flex-col gap-2">
                {([
                  { id: 'scanner' as const, label: 'جهاز Scanner فقط', icon: <ScanBarcode className="w-4 h-4" /> },
                  { id: 'camera' as const, label: 'كاميرا فقط', icon: <Camera className="w-4 h-4" /> },
                  { id: 'both' as const, label: 'الاثنين معاً', icon: <Settings className="w-4 h-4" /> },
                ]).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setSettings({ ...settings, scanMode: opt.id })}
                    className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors text-right ${
                      settings.scanMode === opt.id
                        ? 'bg-supermarket text-supermarket-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {opt.icon}
                    <span className="font-cairo font-bold text-sm">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="space-y-3">
            <p className="font-cairo text-xs text-muted-foreground">
              أضف اختصارات مخصصة. اضغط على "تسجيل" ثم اضغط المفتاح المطلوب.
            </p>

            {customShortcuts.map(shortcut => (
              <div key={shortcut.id} className="bg-secondary rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    {recordingId === shortcut.id ? (
                      <input
                        autoFocus
                        onKeyDown={e => handleKeyRecord(shortcut.id, e)}
                        onBlur={() => setRecordingId(null)}
                        className="w-full h-8 px-2 bg-destructive/20 border border-destructive rounded font-mono text-xs text-center animate-pulse focus:outline-none"
                        placeholder="اضغط المفتاح..."
                        readOnly
                      />
                    ) : (
                      <button
                        onClick={() => setRecordingId(shortcut.id)}
                        className="w-full h-8 px-2 bg-muted rounded font-mono text-xs text-center hover:bg-accent transition-colors"
                      >
                        {shortcut.key || 'اضغط لتسجيل المفتاح'}
                      </button>
                    )}
                  </div>
                  <select
                    value={shortcut.action}
                    onChange={e => updateShortcut(shortcut.id, { action: e.target.value })}
                    className="h-8 px-2 bg-muted rounded font-cairo text-xs focus:outline-none flex-1"
                  >
                    {ALL_ACTIONS.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeShortcut(shortcut.id)}
                    className="p-1 hover:bg-destructive/20 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={addShortcut}
              className="w-full flex items-center justify-center gap-2 py-2 bg-secondary hover:bg-muted rounded font-cairo font-bold text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              إضافة اختصار جديد
            </button>

            {customShortcuts.length === 0 && (
              <div className="text-center text-muted-foreground py-4 font-cairo text-sm">
                لا توجد اختصارات مخصصة. اضغط "إضافة" لإنشاء اختصار.
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-3 bg-supermarket text-supermarket-foreground rounded-lg font-cairo font-bold hover:opacity-90 transition-opacity"
        >
          {saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saved ? 'تم الحفظ ✓' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  );
};

export default POSSettings;
