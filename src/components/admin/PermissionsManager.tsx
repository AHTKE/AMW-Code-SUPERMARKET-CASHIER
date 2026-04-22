import { useState } from 'react';
import { getCashiers } from '@/lib/store';
import {
  getGlobalPermissions, saveGlobalPermissions,
  getCashierPermissions, saveCashierPermissions,
  hasCashierCustomPermissions, clearCashierPermissions,
  CashierPermissions
} from '@/lib/permissions';
import { Shield, Users, Save, CheckCircle, User } from 'lucide-react';

const PermissionsManager = () => {
  const cashiers = getCashiers();
  const [globalPerms, setGlobalPerms] = useState<CashierPermissions>(getGlobalPermissions());
  const [selectedCashier, setSelectedCashier] = useState<string | null>(null);
  const [cashierPerms, setCashierPerms] = useState<CashierPermissions | null>(null);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<'global' | 'individual'>('global');

  const handleSaveGlobal = () => {
    saveGlobalPermissions(globalPerms);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSelectCashier = (id: string) => {
    setSelectedCashier(id);
    setCashierPerms(getCashierPermissions(id));
  };

  const handleSaveCashier = () => {
    if (!selectedCashier || !cashierPerms) return;
    saveCashierPermissions(selectedCashier, cashierPerms);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetCashier = () => {
    if (!selectedCashier) return;
    clearCashierPermissions(selectedCashier);
    setCashierPerms(getGlobalPermissions());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const PermCheckboxes = ({ perms, onChange }: { perms: CashierPermissions; onChange: (p: CashierPermissions) => void }) => (
    <div className="space-y-3">
      {[
        { key: 'canReturn' as const, label: 'السماح بعمل مرتجعات', desc: 'الكاشير يقدر يعمل مرتجع لفاتورة' },
        { key: 'canDiscount' as const, label: 'السماح بالخصومات', desc: 'الكاشير يقدر يعمل خصم على الفاتورة' },
        { key: 'canHold' as const, label: 'السماح بتعليق الفواتير', desc: 'الكاشير يقدر يعلق فاتورة ويرجعها بعدين' },
        { key: 'canViewSales' as const, label: 'عرض الفواتير السابقة', desc: 'الكاشير يشوف فواتيره السابقة' },
        { key: 'showReturns' as const, label: 'إظهار سجل المرتجعات', desc: 'الكاشير يشوف المرتجعات السابقة' },
        { key: 'showSalesCount' as const, label: 'إظهار عدد الفواتير', desc: 'يظهر للكاشير عدد فواتير الشيفت' },
        { key: 'showSalesTotal' as const, label: 'إظهار إجمالي المبيعات', desc: 'يظهر للكاشير مجموع مبيعات الشيفت' },
      ].map(item => (
        <label key={item.key} className="flex items-start gap-3 cursor-pointer p-3 bg-secondary rounded-lg hover:bg-muted transition-colors">
          <input
            type="checkbox"
            checked={perms[item.key]}
            onChange={e => onChange({ ...perms, [item.key]: e.target.checked })}
            className="w-5 h-5 mt-0.5 accent-supermarket"
          />
          <div>
            <span className="font-cairo font-bold text-sm block">{item.label}</span>
            <span className="font-cairo text-xs text-muted-foreground">{item.desc}</span>
          </div>
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="font-cairo font-black text-xl flex items-center gap-2">
        <Shield className="w-5 h-5" />
        صلاحيات الكاشيرات
      </h2>

      <div className="flex gap-2">
        <button
          onClick={() => setMode('global')}
          className={`flex items-center gap-2 px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${
            mode === 'global' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          <Users className="w-4 h-4" />
          للجميع
        </button>
        <button
          onClick={() => setMode('individual')}
          className={`flex items-center gap-2 px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${
            mode === 'individual' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          <User className="w-4 h-4" />
          لكل كاشير
        </button>
      </div>

      {mode === 'global' && (
        <div className="bg-card p-5 rounded-lg border border-border space-y-4">
          <p className="font-cairo text-xs text-muted-foreground">
            هذه الصلاحيات تُطبق على كل الكاشيرات اللي مالهمش صلاحيات خاصة
          </p>
          <PermCheckboxes perms={globalPerms} onChange={setGlobalPerms} />
          <button onClick={handleSaveGlobal} className="flex items-center gap-2 px-6 py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90">
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'تم الحفظ ✓' : 'حفظ الصلاحيات'}
          </button>
        </div>
      )}

      {mode === 'individual' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {cashiers.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelectCashier(c.id)}
                className={`px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${
                  selectedCashier === c.id ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'
                }`}
              >
                {c.name}
                {hasCashierCustomPermissions(c.id) && ' ⚡'}
              </button>
            ))}
            {cashiers.length === 0 && (
              <div className="text-muted-foreground font-cairo text-sm py-4">لا يوجد كاشيرات</div>
            )}
          </div>

          {selectedCashier && cashierPerms && (
            <div className="bg-card p-5 rounded-lg border border-border space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-cairo font-bold text-sm">
                  صلاحيات: {cashiers.find(c => c.id === selectedCashier)?.name}
                </span>
                {hasCashierCustomPermissions(selectedCashier) && (
                  <button onClick={handleResetCashier} className="text-xs font-cairo text-destructive hover:underline">
                    إعادة للإعدادات العامة
                  </button>
                )}
              </div>
              <PermCheckboxes perms={cashierPerms} onChange={setCashierPerms} />
              <button onClick={handleSaveCashier} className="flex items-center gap-2 px-6 py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90">
                {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'تم الحفظ ✓' : 'حفظ صلاحيات هذا الكاشير'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PermissionsManager;
