import { useState, useRef } from 'react';
import { exportData, importData } from '@/lib/dataTransfer';
import { Download, Upload, X, CheckCircle, AlertTriangle, RefreshCw, QrCode, Camera } from 'lucide-react';
import QRSyncTransfer from '@/components/shared/QRSyncTransfer';

interface Props {
  onClose: () => void;
}

const CashierDataSync = ({ onClose }: Props) => {
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [qrMode, setQrMode] = useState<'send' | 'receive' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashier-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ text: 'تم تحميل النسخة الاحتياطية. ابعتها للمدير.', type: 'success' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      // Cashier ALWAYS uses smart merge so his real sales/expenses stay safe
      const result = importData(ev.target?.result as string, true);
      setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
      if (result.success) setTimeout(() => window.location.reload(), 1500);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleQrReceive = (json: string) => {
    const result = importData(json, true);
    setMessage({ text: result.message, type: result.success ? 'success' : 'error' });
    setQrMode(null);
    if (result.success) setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl border border-border p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-cairo font-black text-lg flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-supermarket" />
            مزامنة البيانات مع المدير
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <p className="font-cairo text-xs text-muted-foreground leading-relaxed">
          <b>أسرع طريقة:</b> اضغط «استقبال بالكاميرا» وصوّر شاشة الـ QR من جهاز المدير — من غير أي ملفات.
          المبيعات والبيانات المحلية عندك هتفضل زي ما هي.
        </p>

        {message && (
          <div className={`flex items-center gap-2 p-3 rounded-lg font-cairo text-sm ${
            message.type === 'success' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        {/* Primary: QR flow */}
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => setQrMode('receive')}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90"
          >
            <Camera className="w-4 h-4" />
            استقبال التحديث من المدير بالكاميرا (QR)
          </button>
          <button
            onClick={() => setQrMode('send')}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-secondary border border-border rounded font-cairo font-bold text-sm hover:bg-muted"
          >
            <QrCode className="w-4 h-4" />
            إرسال بياناتي بالـ QR للمدير
          </button>
        </div>

        <div className="pt-3 border-t border-border space-y-2">
          <p className="font-cairo text-[11px] text-muted-foreground text-center">
            أو استخدم الملفات (للنقل عبر واتساب/ USB)
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-secondary/50 text-foreground rounded font-cairo text-xs hover:bg-muted border border-border"
            >
              <Download className="w-4 h-4" />
              تحميل نسخة احتياطية (JSON)
            </button>
            <input ref={fileRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-secondary/50 text-foreground rounded font-cairo text-xs hover:bg-muted border border-border"
            >
              <Upload className="w-4 h-4" />
              رفع الملف المحدّث من المدير
            </button>
          </div>
        </div>
      </div>

      {qrMode === 'send' && (
        <QRSyncTransfer
          mode="send"
          payload={exportData()}
          onClose={() => setQrMode(null)}
          title="إرسال بياناتي بالـ QR"
        />
      )}
      {qrMode === 'receive' && (
        <QRSyncTransfer
          mode="receive"
          onReceive={handleQrReceive}
          onClose={() => setQrMode(null)}
          title="استقبال التحديث بالكاميرا"
        />
      )}
    </div>
  );
};

export default CashierDataSync;
