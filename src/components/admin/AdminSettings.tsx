import { useState } from 'react';
import { getAdminCredentials, setAdminCredentials } from '@/lib/store';
import { getStoreInfo, saveStoreInfo, getSettings, saveSettings } from '@/lib/settings';
import { Save, Eye, EyeOff, CheckCircle, Store, ShieldCheck, Type, Palette, RotateCcw, Phone, MapPin, Plus, Trash2 } from 'lucide-react';
import { addLogEntry } from '@/lib/adminLog';
import { AVAILABLE_FONTS, getFontConfig, saveFontConfig, isFontPermissionGranted, setFontPermission, FontConfig } from '@/lib/fontSettings';
import { THEME_COLORS, getActiveThemeColor, setActiveThemeColor, resetThemeColor } from '@/lib/themeColors';

const AdminSettings = () => {
  const current = getAdminCredentials();
  const storeInfo = getStoreInfo();
  const posSettings = getSettings();
  const [username, setUsername] = useState(current?.username || '');
  const [password, setPassword] = useState(current?.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  const [storeName, setStoreName] = useState(storeInfo.name);
  const [storeAddress, setStoreAddress] = useState(storeInfo.address);
  const [storePhone, setStorePhone] = useState(storeInfo.phone || '');
  const [extra1Label, setExtra1Label] = useState(storeInfo.extra1Label || '');
  const [extra1Value, setExtra1Value] = useState(storeInfo.extra1Value || '');
  const [extra2Label, setExtra2Label] = useState(storeInfo.extra2Label || '');
  const [extra2Value, setExtra2Value] = useState(storeInfo.extra2Value || '');
  const [storeSaved, setStoreSaved] = useState(false);

  const [showShiftSalesCount, setShowShiftSalesCount] = useState(posSettings.showShiftSalesCount);
  const [showShiftSalesTotal, setShowShiftSalesTotal] = useState(posSettings.showShiftSalesTotal);
  const [shiftSaved, setShiftSaved] = useState(false);

  // Font settings
  const fontConfig = getFontConfig();
  const [selectedFont, setSelectedFont] = useState(fontConfig.fontFamily);
  const [fontWeight, setFontWeight] = useState<FontConfig['fontWeight']>(fontConfig.fontWeight);
  const [fontSaved, setFontSaved] = useState(false);
  const [allowCashierFont, setAllowCashierFont] = useState(isFontPermissionGranted());

  // Color theme
  const [activeColor, setActiveColor] = useState(getActiveThemeColor());
  const [colorSaved, setColorSaved] = useState(false);

  const handleSave = () => {
    if (!username.trim() || !password.trim()) return;
    if (password.length < 4) return;
    setAdminCredentials({ username: username.trim(), password: password.trim() });
    addLogEntry('تغيير بيانات الدخول', `تم تغيير اسم المستخدم وكلمة المرور`);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleStoreSave = () => {
    if (!storeName.trim()) return;
    saveStoreInfo({
      name: storeName.trim(),
      address: storeAddress.trim(),
      phone: storePhone.trim(),
      extra1Label: extra1Label.trim(),
      extra1Value: extra1Value.trim(),
      extra2Label: extra2Label.trim(),
      extra2Value: extra2Value.trim(),
    });
    addLogEntry('تعديل بيانات المتجر', `الاسم: ${storeName.trim()}`);
    setStoreSaved(true);
    setTimeout(() => setStoreSaved(false), 2000);
  };

  const handleShiftSave = () => {
    const settings = getSettings();
    saveSettings({ ...settings, showShiftSalesCount, showShiftSalesTotal });
    addLogEntry('تعديل إعدادات الشيفت', `عدد الفواتير: ${showShiftSalesCount ? 'مفعل' : 'معطل'}, إجمالي المبيعات: ${showShiftSalesTotal ? 'مفعل' : 'معطل'}`);
    setShiftSaved(true);
    setTimeout(() => setShiftSaved(false), 2000);
  };

  const handleFontSave = () => {
    saveFontConfig({ fontFamily: selectedFont, fontWeight });
    setFontPermission(allowCashierFont);
    addLogEntry('تعديل إعدادات الخط', `الخط: ${selectedFont}, الوزن: ${fontWeight}, السماح للكاشير: ${allowCashierFont ? 'نعم' : 'لا'}`);
    setFontSaved(true);
    setTimeout(() => setFontSaved(false), 2000);
  };

  const handleColorSave = (colorId: string) => {
    setActiveThemeColor(colorId);
    setActiveColor(colorId);
    addLogEntry('تغيير لون التصميم', `اللون: ${THEME_COLORS.find(c => c.id === colorId)?.name || colorId}`);
    setColorSaved(true);
    setTimeout(() => setColorSaved(false), 2000);
  };

  const handleColorReset = () => {
    resetThemeColor();
    setActiveColor('teal');
    addLogEntry('إعادة تعيين لون التصميم', 'تم إرجاع الألوان للوضع الأصلي');
    setColorSaved(true);
    setTimeout(() => setColorSaved(false), 2000);
  };

  return (
    <div className="max-w-md space-y-6">
      <h2 className="font-cairo font-black text-xl">⚙️ إعدادات المدير</h2>

      {/* Store info */}
      <div className="space-y-4 bg-card p-6 rounded-lg border border-border">
        <h3 className="font-cairo font-bold text-lg flex items-center gap-2">
          <Store className="w-5 h-5" />
          بيانات المتجر
        </h3>
        <div>
          <label className="font-cairo text-sm text-muted-foreground block mb-1">اسم المتجر</label>
          <input
            type="text"
            value={storeName}
            onChange={e => setStoreName(e.target.value)}
            className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
            placeholder="مثال: سوبرماركت الأمل"
          />
        </div>
        <div>
          <label className="font-cairo text-sm text-muted-foreground block mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> العنوان
          </label>
          <input
            type="text"
            value={storeAddress}
            onChange={e => setStoreAddress(e.target.value)}
            className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
            placeholder="مثال: شارع التحرير - القاهرة"
          />
        </div>
        <div>
          <label className="font-cairo text-sm text-muted-foreground block mb-1 flex items-center gap-1">
            <Phone className="w-3 h-3" /> رقم التواصل
          </label>
          <input
            type="text"
            value={storePhone}
            onChange={e => setStorePhone(e.target.value)}
            className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
            placeholder="مثال: 01012345678"
          />
        </div>
        
        {/* Extra field 1 */}
        <div className="border-t border-border pt-3">
          <p className="font-cairo text-xs text-muted-foreground mb-2">حقول إضافية (اختياري - تظهر في الفاتورة)</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={extra1Label}
              onChange={e => setExtra1Label(e.target.value)}
              className="w-1/3 h-9 px-2 bg-secondary rounded font-cairo text-xs focus:outline-none focus:ring-2 focus:ring-supermarket"
              placeholder="العنوان (مثل: الرقم الضريبي)"
            />
            <input
              type="text"
              value={extra1Value}
              onChange={e => setExtra1Value(e.target.value)}
              className="flex-1 h-9 px-2 bg-secondary rounded font-cairo text-xs focus:outline-none focus:ring-2 focus:ring-supermarket"
              placeholder="القيمة"
            />
          </div>
        </div>
        
        {/* Extra field 2 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={extra2Label}
            onChange={e => setExtra2Label(e.target.value)}
            className="w-1/3 h-9 px-2 bg-secondary rounded font-cairo text-xs focus:outline-none focus:ring-2 focus:ring-supermarket"
            placeholder="العنوان"
          />
          <input
            type="text"
            value={extra2Value}
            onChange={e => setExtra2Value(e.target.value)}
            className="flex-1 h-9 px-2 bg-secondary rounded font-cairo text-xs focus:outline-none focus:ring-2 focus:ring-supermarket"
            placeholder="القيمة"
          />
        </div>

        <button
          onClick={handleStoreSave}
          disabled={!storeName.trim()}
          className="flex items-center gap-2 px-6 py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          {storeSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {storeSaved ? 'تم الحفظ ✓' : 'حفظ بيانات المتجر'}
        </button>
      </div>

      {/* Font settings */}
      <div className="space-y-4 bg-card p-6 rounded-lg border border-border">
        <h3 className="font-cairo font-bold text-lg flex items-center gap-2">
          <Type className="w-5 h-5" />
          إعدادات الخط
        </h3>
        <div>
          <label className="font-cairo text-sm text-muted-foreground block mb-1">نوع الخط</label>
          <select
            value={selectedFont}
            onChange={e => setSelectedFont(e.target.value)}
            className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
          >
            {AVAILABLE_FONTS.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-cairo text-sm text-muted-foreground block mb-1">وزن الخط</label>
          <select
            value={fontWeight}
            onChange={e => setFontWeight(e.target.value as FontConfig['fontWeight'])}
            className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
          >
            <option value="normal">عادي</option>
            <option value="bold">بارز (Bold)</option>
            <option value="bolder">بارز جداً (Bolder)</option>
          </select>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={allowCashierFont}
            onChange={e => setAllowCashierFont(e.target.checked)}
            className="w-5 h-5 rounded accent-supermarket"
          />
          <span className="font-cairo text-sm">السماح للكاشير بتغيير الخط</span>
        </label>
        <button
          onClick={handleFontSave}
          className="flex items-center gap-2 px-6 py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90 transition-opacity"
        >
          {fontSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {fontSaved ? 'تم الحفظ ✓' : 'حفظ إعدادات الخط'}
        </button>
      </div>

      {/* Color theme */}
      <div className="space-y-4 bg-card p-6 rounded-lg border border-border">
        <h3 className="font-cairo font-bold text-lg flex items-center gap-2">
          <Palette className="w-5 h-5" />
          ألوان التصميم
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {THEME_COLORS.map(color => (
            <button
              key={color.id}
              onClick={() => handleColorSave(color.id)}
              className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                activeColor === color.id ? 'border-foreground scale-110 ring-2 ring-foreground/30' : 'border-transparent'
              }`}
              style={{ backgroundColor: `hsl(${color.hue}, ${color.saturation + 30}%, 45%)` }}
              title={color.name}
            />
          ))}
        </div>
        <button
          onClick={handleColorReset}
          className="w-full flex items-center justify-center gap-2 py-2 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          إرجاع الألوان للوضع الأصلي
        </button>
        {colorSaved && (
          <p className="text-xs text-success font-cairo flex items-center gap-1"><CheckCircle className="w-3 h-3" /> تم تغيير اللون ✓</p>
        )}
      </div>

      {/* Shift visibility settings */}
      <div className="space-y-4 bg-card p-6 rounded-lg border border-border">
        <h3 className="font-cairo font-bold text-lg flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          إعدادات إغلاق الشيفت
        </h3>
        <p className="text-xs text-muted-foreground font-cairo">تحكم في ما يراه الكاشير عند إغلاق الشيفت</p>
        
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={showShiftSalesCount}
            onChange={e => setShowShiftSalesCount(e.target.checked)}
            className="w-5 h-5 rounded accent-supermarket"
          />
          <span className="font-cairo text-sm">إظهار عدد الفواتير للكاشير</span>
        </label>
        
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={showShiftSalesTotal}
            onChange={e => setShowShiftSalesTotal(e.target.checked)}
            className="w-5 h-5 rounded accent-supermarket"
          />
          <span className="font-cairo text-sm">إظهار إجمالي المبيعات للكاشير</span>
        </label>

        <button
          onClick={handleShiftSave}
          className="flex items-center gap-2 px-6 py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90 transition-opacity"
        >
          {shiftSaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {shiftSaved ? 'تم الحفظ ✓' : 'حفظ الإعدادات'}
        </button>
      </div>

      {/* Admin credentials */}
      <div className="space-y-4 bg-card p-6 rounded-lg border border-border">
        <h3 className="font-cairo font-bold text-lg">🔐 تغيير بيانات الدخول</h3>
        <div>
          <label className="font-cairo text-sm text-muted-foreground block mb-1">اسم المستخدم</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
          />
        </div>
        <div>
          <label className="font-cairo text-sm text-muted-foreground block mb-1">كلمة المرور</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-10 px-3 pl-10 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">4 أحرف على الأقل</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!username.trim() || !password.trim() || password.length < 4}
          className="flex items-center gap-2 px-6 py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90 disabled:opacity-30 transition-opacity"
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'تم الحفظ ✓' : 'حفظ التغييرات'}
        </button>
      </div>

      <div className="bg-card p-6 rounded-lg border border-border">
        <h3 className="font-cairo font-bold text-lg mb-2">🔑 استرداد كلمة المرور</h3>
        <p className="text-sm text-muted-foreground font-cairo">
          في حالة نسيان كلمة المرور، اضغط "نسيت كلمة المرور" في صفحة الدخول واستخدم بيانات الاسترداد الثابتة.
        </p>
      </div>
    </div>
  );
};

export default AdminSettings;
