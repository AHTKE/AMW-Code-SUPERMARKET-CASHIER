import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, QrCode, Camera, ChevronRight, ChevronLeft, Pause, Play, CheckCircle, AlertTriangle } from 'lucide-react';
import CameraScanner from '@/components/pos/CameraScanner';
import { buildChunks, parseChunk, tryAssemble, AssemblyState } from '@/lib/qrSync';

type Mode = 'send' | 'receive';

interface Props {
  mode: Mode;
  /** Send mode: raw JSON string to transmit. */
  payload?: string;
  /** Receive mode: called with the full JSON once assembled. */
  onReceive?: (json: string) => void;
  onClose: () => void;
  title?: string;
}

const CYCLE_MS = 1400;

const QRSyncTransfer = ({ mode, payload, onReceive, onClose, title }: Props) => {
  // --- SEND ---
  const chunks = useMemo(() => (mode === 'send' && payload ? buildChunks(payload) : []), [mode, payload]);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (mode !== 'send' || chunks.length === 0) return;
    let cancelled = false;
    QRCode.toDataURL(chunks[current], { errorCorrectionLevel: 'M', margin: 1, scale: 6, width: 320 })
      .then(url => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(''); });
    return () => { cancelled = true; };
  }, [current, chunks, mode]);

  useEffect(() => {
    if (mode !== 'send' || !playing || chunks.length <= 1) return;
    const t = setInterval(() => setCurrent(c => (c + 1) % chunks.length), CYCLE_MS);
    return () => clearInterval(t);
  }, [playing, chunks.length, mode]);

  // --- RECEIVE ---
  const [asm, setAsm] = useState<AssemblyState>({ total: 0, received: new Map() });
  const [err, setErr] = useState('');
  const doneRef = useRef(false);

  const handleScan = (code: string) => {
    if (doneRef.current) return;
    const parsed = parseChunk(code);
    if (!parsed) {
      setErr('كود غير معروف. تأكد إنك بتصور شاشة المزامنة من جهاز المدير.');
      return;
    }
    setErr('');
    setAsm(prev => {
      const nextTotal = prev.total || parsed.total;
      if (parsed.total !== nextTotal) return prev;
      if (prev.received.has(parsed.idx)) return prev;
      const received = new Map(prev.received);
      received.set(parsed.idx, parsed.payload);
      const next = { total: nextTotal, received };
      if (received.size === nextTotal) {
        const json = tryAssemble(next);
        if (json) {
          doneRef.current = true;
          setTimeout(() => onReceive?.(json), 300);
        } else {
          setErr('فشل فك ضغط البيانات. حاول تاني.');
        }
      }
      return next;
    });
  };

  const missing = useMemo(() => {
    if (mode !== 'receive' || asm.total === 0) return [] as number[];
    const arr: number[] = [];
    for (let i = 1; i <= asm.total; i++) if (!asm.received.has(i)) arr.push(i);
    return arr;
  }, [asm, mode]);

  return (
    <div className="fixed inset-0 bg-background/90 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl border border-border p-6 w-full max-w-md space-y-4 max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-cairo font-black text-lg flex items-center gap-2">
            {mode === 'send' ? <QrCode className="w-5 h-5 text-supermarket" /> : <Camera className="w-5 h-5 text-supermarket" />}
            {title || (mode === 'send' ? 'إرسال بالـ QR' : 'استقبال بالكاميرا')}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {mode === 'send' && (
          <div className="space-y-3">
            <p className="font-cairo text-xs text-muted-foreground leading-relaxed">
              خلي الطرف التاني يفتح <b>«استقبال بالكاميرا»</b> ويصوّر الشاشة دي.
              الأكواد بتتبدل لوحدها، سيبها ماشية لحد ما يقولك «تم».
            </p>

            <div className="bg-white rounded-lg p-3 flex items-center justify-center min-h-[320px]">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`QR ${current + 1}/${chunks.length}`} className="w-full max-w-[320px]" />
              ) : (
                <span className="font-cairo text-muted-foreground text-sm">جاري التحضير…</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setCurrent(c => (c - 1 + chunks.length) % chunks.length)}
                className="p-2 rounded bg-secondary hover:bg-muted"
                disabled={chunks.length <= 1}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="text-center font-cairo font-bold text-sm">
                كود {current + 1} من {chunks.length}
              </div>
              <button
                onClick={() => setCurrent(c => (c + 1) % chunks.length)}
                className="p-2 rounded bg-secondary hover:bg-muted"
                disabled={chunks.length <= 1}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>

            {chunks.length > 1 && (
              <button
                onClick={() => setPlaying(p => !p)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-secondary rounded font-cairo font-bold text-sm hover:bg-muted"
              >
                {playing ? <><Pause className="w-4 h-4" /> إيقاف التبديل التلقائي</> : <><Play className="w-4 h-4" /> تشغيل التبديل التلقائي</>}
              </button>
            )}
          </div>
        )}

        {mode === 'receive' && (
          <div className="space-y-3">
            <p className="font-cairo text-xs text-muted-foreground leading-relaxed">
              وجّه الكاميرا لشاشة الـ QR اللي عند المدير. مش لازم ترتيب —
              هيلم كل الأكواد لوحده ويقولك لما يخلص.
            </p>
            <CameraScanner onScan={handleScan} active={true} />

            {asm.total > 0 && (
              <div className="p-3 bg-secondary rounded-lg space-y-1">
                <div className="flex items-center justify-between font-cairo text-sm">
                  <span className="font-bold">التقدم</span>
                  <span className="text-supermarket font-bold">{asm.received.size} / {asm.total}</span>
                </div>
                <div className="w-full h-2 bg-background rounded overflow-hidden">
                  <div
                    className="h-full bg-supermarket transition-all"
                    style={{ width: `${(asm.received.size / asm.total) * 100}%` }}
                  />
                </div>
                {missing.length > 0 && missing.length <= 15 && (
                  <div className="font-cairo text-[11px] text-muted-foreground">
                    ناقص: {missing.join('، ')}
                  </div>
                )}
                {asm.received.size === asm.total && (
                  <div className="flex items-center gap-1 text-success font-cairo text-sm">
                    <CheckCircle className="w-4 h-4" /> تم الاستقبال بنجاح
                  </div>
                )}
              </div>
            )}

            {err && (
              <div className="flex items-center gap-2 p-2 bg-destructive/20 text-destructive rounded font-cairo text-xs">
                <AlertTriangle className="w-4 h-4" /> {err}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QRSyncTransfer;
