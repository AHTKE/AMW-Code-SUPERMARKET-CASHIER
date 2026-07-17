import { useState, useRef } from 'react';
import { exportData, importData, factoryReset, DataCategory, CATEGORY_LABELS } from '@/lib/dataTransfer';
import { verifyAdmin } from '@/lib/store';
import { Download, Upload, Trash2, AlertTriangle, CheckCircle, FileDown, FileUp, QrCode, Camera } from 'lucide-react';
import QRSyncTransfer from '@/components/shared/QRSyncTransfer';

const ALL_CATEGORIES: DataCategory[] = ['products', 'sales', 'expenses', 'income', 'cashiers', 'sessions', 'returns', 'settings', 'held'];

const DataTransferManager = () => {
  const [tab, setTab] = useState<'export' | 'import' | 'reset'>('export');
  const [selectedCats, setSelectedCats] = useState<DataCategory[]>([]);
  const [exportAll, setExportAll] = useState(true);
  const [mergeMode, setMergeMode] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [qrMode, setQrMode] = useState<'send' | 'receive' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Factory reset state
  const [resetStep, setResetStep] = useState(0);
  const [resetUser, setResetUser] = useState('');
  const [resetPass, setResetPass] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetError, setResetError] = useState('');

  const toggleCat = (cat: DataCategory) => {
    setSelectedCats(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleExport = () => {
    const data = exportAll ? exportData() : exportData(selectedCats.length > 0 ? selectedCats : undefined);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supermarket-cashier-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ text: 'تم تصدير البيانات بنجاح', type: 'success' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = importData(ev.target?.result as string, mergeMode);
      setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
      if (result.success) {
        setTimeout(() => window.location.reload(), 1500);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleFactoryReset = () => {
    if (!verifyAdmin(resetUser, resetPass)) {
      setResetError('بيانات الدخول غير صحيحة');
      return;
    }
    if (!resetConfirm) {
      setResetError('يجب التأكيد على أنك تعلم ما تفعله');
      return;
    }
    factoryReset();
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="font-cairo font-black text-xl">📦 نقل البيانات</h2>

      <div className="flex gap-2">
        {[
          { id: 'export' as const, label: 'تصدير', icon: <Download className="w-4 h-4" /> },
          { id: 'import' as const, label: 'استيراد / دمج', icon: <Upload className="w-4 h-4" /> },
          { id: 'reset' as const, label: 'ضبط مصنع', icon: <Trash2 className="w-4 h-4" /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setMessage(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${
              tab === t.id
                ? t.id === 'reset' ? 'bg-destructive text-destructive-foreground' : 'bg-supermarket text-supermarket-foreground'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg font-cairo text-sm ${
          message.type === 'success' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {tab === 'export' && (
        <div className="space-y-4 bg-card p-5 rounded-lg border border-border">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={exportAll} onChange={e => setExportAll(e.target.checked)} className="w-5 h-5 accent-supermarket" />
            <span className="font-cairo font-bold text-sm">تصدير كل البيانات</span>
          </label>

          {!exportAll && (
            <div className="space-y-2 pr-4">
              {ALL_CATEGORIES.map(cat => (
                <label key={cat} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={selectedCats.includes(cat)} onChange={() => toggleCat(cat)} className="w-4 h-4 accent-supermarket" />
                  <span className="font-cairo text-sm">{CATEGORY_LABELS[cat]}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={handleExport} className="flex items-center gap-2 px-6 py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90">
              <FileDown className="w-4 h-4" />
              تحميل ملف النسخة الاحتياطية
            </button>
            <button
              onClick={() => setQrMode('send')}
              className="flex items-center gap-2 px-6 py-3 bg-secondary border border-border rounded font-cairo font-bold text-sm hover:bg-muted"
              title="مزامنة سريعة بدون ملفات ولا واتساب"
            >
              <QrCode className="w-4 h-4" />
              إرسال بالـ QR للكاشير
            </button>
          </div>
          <p className="font-cairo text-[11px] text-muted-foreground leading-relaxed">
            💡 <b>الـ QR أسهل للكاشير:</b> اضغط «إرسال بالـ QR»، ويطلب من الكاشير من شاشة المزامنة عنده يختار «استقبال بالكاميرا»
            ويصوّر شاشتك. مفيش رفع ولا تنزيل ولا واتساب.
          </p>
        </div>
      )}

      {tab === 'import' && (
        <div className="space-y-4 bg-card p-5 rounded-lg border border-border">
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-secondary rounded-lg">
              <input type="radio" checked={!mergeMode} onChange={() => setMergeMode(false)} className="accent-supermarket" />
              <div>
                <span className="font-cairo font-bold text-sm block">استبدال (استيراد)</span>
                <span className="font-cairo text-xs text-muted-foreground">يستبدل البيانات الحالية بالملف المرفوع</span>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-secondary rounded-lg">
              <input type="radio" checked={mergeMode} onChange={() => setMergeMode(true)} className="accent-supermarket" />
              <div>
                <span className="font-cairo font-bold text-sm block">دمج ذكي (تحديث)</span>
                <span className="font-cairo text-xs text-muted-foreground">
                  يحدّث المنتجات والإعدادات الموجودة في الملف، ويضيف الجديد فقط، ويحافظ على المبيعات والبيانات المحلية زي ما هي.
                </span>
              </div>
            </label>
          </div>

          <input ref={fileRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-6 py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90">
              <FileUp className="w-4 h-4" />
              اختر ملف النسخة الاحتياطية
            </button>
            <button
              onClick={() => setQrMode('receive')}
              className="flex items-center gap-2 px-6 py-3 bg-secondary border border-border rounded font-cairo font-bold text-sm hover:bg-muted"
            >
              <Camera className="w-4 h-4" />
              استقبال بالكاميرا (QR)
            </button>
          </div>
        </div>
      )}

      {tab === 'reset' && (
        <div className="space-y-4 bg-destructive/5 p-5 rounded-lg border border-destructive/30">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-6 h-6" />
            <span className="font-cairo font-black text-lg">تحذير: ضبط المصنع</span>
          </div>
          <p className="font-cairo text-sm text-muted-foreground">
            سيتم حذف جميع البيانات نهائياً: المنتجات، المبيعات، الكاشيرات، الإعدادات، وكل شيء آخر. لا يمكن التراجع عن هذا الإجراء. (تفعيل الجهاز يظل محفوظاً)
          </p>

          {resetStep === 0 && (
            <button onClick={() => setResetStep(1)} className="px-6 py-3 bg-destructive text-destructive-foreground rounded font-cairo font-bold text-sm hover:opacity-90">
              أريد ضبط المصنع
            </button>
          )}

          {resetStep === 1 && (
            <div className="space-y-3">
              <div>
                <label className="font-cairo text-sm text-muted-foreground">اسم المستخدم (المدير)</label>
                <input value={resetUser} onChange={e => { setResetUser(e.target.value); setResetError(''); }}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-destructive mt-1" />
              </div>
              <div>
                <label className="font-cairo text-sm text-muted-foreground">كلمة المرور</label>
                <input type="password" value={resetPass} onChange={e => { setResetPass(e.target.value); setResetError(''); }}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-destructive mt-1" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={resetConfirm} onChange={e => setResetConfirm(e.target.checked)} className="w-5 h-5 accent-destructive" />
                <span className="font-cairo font-bold text-sm text-destructive">أعلم أن هذا سيحذف جميع البيانات نهائياً</span>
              </label>

              {resetError && (
                <div className="flex items-center gap-1 text-destructive text-xs font-cairo">
                  <AlertTriangle className="w-3 h-3" />{resetError}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setResetStep(0)} className="flex-1 py-3 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground">إلغاء</button>
                <button onClick={handleFactoryReset} className="flex-1 py-3 rounded font-cairo font-bold text-sm bg-destructive text-destructive-foreground hover:opacity-90">
                  تأكيد ضبط المصنع
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {qrMode === 'send' && (
        <QRSyncTransfer
          mode="send"
          payload={exportAll ? exportData() : exportData(selectedCats.length > 0 ? selectedCats : undefined)}
          onClose={() => setQrMode(null)}
          title="إرسال البيانات بالـ QR"
        />
      )}
      {qrMode === 'receive' && (
        <QRSyncTransfer
          mode="receive"
          onReceive={(json) => {
            const result = importData(json, mergeMode);
            setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
            setQrMode(null);
            if (result.success) setTimeout(() => window.location.reload(), 1500);
          }}
          onClose={() => setQrMode(null)}
          title="استقبال بالكاميرا (QR)"
        />
      )}
    </div>
  );
};

export default DataTransferManager;
