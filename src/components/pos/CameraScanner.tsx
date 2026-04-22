import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff } from 'lucide-react';

interface CameraScannerProps {
  onScan: (code: string) => void;
  active: boolean;
}

const CameraScanner = ({ onScan, active }: CameraScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');
  const lastScannedRef = useRef('');
  const lastScanTimeRef = useRef(0);

  useEffect(() => {
    if (!active) {
      stopScanner();
      return;
    }
    startScanner();
    return () => { stopScanner(); };
  }, [active]);

  const startScanner = async () => {
    try {
      setError('');
      const scanner = new Html5Qrcode('camera-scanner-region');
      scannerRef.current = scanner;
      
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.5,
        },
        (decodedText) => {
          const now = Date.now();
          // Debounce: same code within 2 seconds
          if (decodedText === lastScannedRef.current && now - lastScanTimeRef.current < 2000) {
            return;
          }
          lastScannedRef.current = decodedText;
          lastScanTimeRef.current = now;
          onScan(decodedText);
        },
        () => {} // ignore errors during scanning
      );
      setIsRunning(true);
    } catch (err: any) {
      setError('تعذر تشغيل الكاميرا. تأكد من السماح بالوصول.');
      setIsRunning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isRunning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      setIsRunning(false);
    }
  };

  if (!active) return null;

  return (
    <div className="relative rounded-lg overflow-hidden border-2 border-supermarket/50 bg-black">
      <div id="camera-scanner-region" className="w-full" style={{ minHeight: 200 }} />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90">
          <div className="text-center p-4">
            <CameraOff className="w-8 h-8 mx-auto mb-2 text-destructive" />
            <p className="font-cairo text-sm text-destructive">{error}</p>
            <button
              onClick={startScanner}
              className="mt-2 px-4 py-2 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}
      {isRunning && (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-success/80 px-2 py-1 rounded text-xs font-cairo font-bold text-success-foreground">
          <Camera className="w-3 h-3" />
          الكاميرا شغالة
        </div>
      )}
    </div>
  );
};

export default CameraScanner;
