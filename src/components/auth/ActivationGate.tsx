import { useState, useEffect } from 'react';
import { Lock, AlertTriangle, Send, Copy, CheckCircle, Eye, EyeOff } from 'lucide-react';
import {
  isDeviceActivated, activateDevice, verifyActivationCode,
  getCurrentPassword, getCurrentSmsCode, getDeviceId, generateActivationCode
} from '@/lib/activation';
import CompanyCredits from './CompanyCredits';

interface ActivationGateProps {
  children: React.ReactNode;
}

const HIDDEN_TRIGGER = 'AaAa2468AaAa';
const HIDDEN_PANEL_PASSWORD = 'AMW2025@SECURE';

const ActivationGate = ({ children }: ActivationGateProps) => {
  const [activated, setActivated] = useState(isDeviceActivated());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [smsSent, setSmsSent] = useState(false);

  // Hidden admin flow
  const [secretSubmitCount, setSecretSubmitCount] = useState(0);
  const [showSecondGate, setShowSecondGate] = useState(false);
  const [secondPassword, setSecondPassword] = useState('');
  const [showSecondPassword, setShowSecondPassword] = useState(false);
  const [secondGateError, setSecondGateError] = useState('');
  const [showHiddenAdmin, setShowHiddenAdmin] = useState(false);

  if (activated) return <>{children}</>;

  const deviceId = getDeviceId();

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = password.trim();

    // Hidden flow: enter special trigger and click متابعة 4 times
    if (entered === HIDDEN_TRIGGER) {
      const nextCount = secretSubmitCount + 1;
      if (nextCount >= 4) {
        setShowSecondGate(true);
        setSecretSubmitCount(0);
        setPassword('');
        setError('');
      } else {
        setSecretSubmitCount(nextCount);
        setError('');
      }
      return;
    }

    setSecretSubmitCount(0);

    const current = getCurrentPassword();
    if (entered === current) {
      setStep('code');
      setError('');
    } else {
      setError('كلمة المرور غير صحيحة');
    }
  };

  const handleSecondGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (secondPassword.trim() === HIDDEN_PANEL_PASSWORD) {
      setShowHiddenAdmin(true);
      setShowSecondGate(false);
      setSecondPassword('');
      setSecondGateError('');
      return;
    }
    setSecondGateError('كلمة مرور الصفحة المخفية غير صحيحة');
  };

  const handleSendSms = () => {
    setSmsSent(true);
    setTimeout(() => setSmsSent(false), 3000);
  };

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyActivationCode(activationCode)) {
      activateDevice();
      setActivated(true);
    } else {
      setError('كود التفعيل غير صحيح');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 overflow-y-auto">
      {step === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="w-full max-w-sm bg-card rounded-xl border border-border p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-supermarket/20 flex items-center justify-center">
              <Lock className="w-8 h-8 text-supermarket" />
            </div>
            <h1 className="font-cairo font-black text-xl">🔐 تفعيل الجهاز</h1>
            <p className="font-cairo text-sm text-muted-foreground">
              أدخل كلمة المرور لتفعيل هذا الجهاز
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded text-destructive text-sm font-cairo">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="font-cairo text-sm text-muted-foreground block mb-1">كلمة المرور</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full h-12 px-4 pl-10 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
                autoFocus
                placeholder="أدخل كلمة المرور..."
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded font-cairo font-bold bg-supermarket text-supermarket-foreground hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            متابعة
          </button>
        </form>
      ) : (
        <form onSubmit={handleActivate} className="w-full max-w-sm bg-card rounded-xl border border-border p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center">
              <Send className="w-8 h-8 text-success" />
            </div>
            <h1 className="font-cairo font-black text-xl">📱 تفعيل الجهاز</h1>
          </div>

          {/* Device Code */}
          <div className="p-4 bg-secondary rounded-lg space-y-2">
            <label className="font-cairo text-sm text-muted-foreground block">كود الجهاز الخاص بك:</label>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-2xl tracking-widest text-foreground flex-1 text-center">{deviceId}</span>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(deviceId)}
                className="p-2 rounded hover:bg-muted transition-colors"
                title="نسخ"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="font-cairo text-xs text-muted-foreground text-center">
              أعطِ هذا الكود للمصمم Ahmed
            </p>
          </div>

          {/* Send SMS button */}
          <button
            type="button"
            onClick={handleSendSms}
            className="w-full flex items-center justify-center gap-2 py-3 rounded font-cairo font-bold bg-success/20 text-success hover:bg-success/30 transition-colors"
          >
            {smsSent ? (
              <>
                <CheckCircle className="w-5 h-5" />
                تم إرسال الرمز إلى Ahmed ✓
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                إرسال رمز سري SMS إلى المصمم Ahmed
              </>
            )}
          </button>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded text-destructive text-sm font-cairo">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="font-cairo text-sm text-muted-foreground block mb-1">كود التفعيل</label>
            <input
              type="text"
              value={activationCode}
              onChange={e => { setActivationCode(e.target.value); setError(''); }}
              className="w-full h-12 px-4 bg-secondary rounded font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-supermarket"
              placeholder="أدخل كود التفعيل..."
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded font-cairo font-bold bg-supermarket text-supermarket-foreground hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            تفعيل الجهاز
          </button>

          <button
            type="button"
            onClick={() => { setStep('password'); setError(''); }}
            className="w-full py-2 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground hover:text-foreground"
          >
            رجوع
          </button>
        </form>
      )}

      {/* Second gate modal for hidden panel */}
      {showSecondGate && (
        <div className="fixed inset-0 bg-background/90 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSecondGateSubmit} className="bg-card rounded-xl border border-border p-6 w-full max-w-xs space-y-4">
            <h3 className="font-cairo font-bold text-center">🔑 الصفحة المخفية</h3>
            <div className="relative">
              <input
                type={showSecondPassword ? 'text' : 'password'}
                value={secondPassword}
                onChange={e => { setSecondPassword(e.target.value); setSecondGateError(''); }}
                className="w-full h-10 px-3 pl-10 bg-secondary rounded font-mono text-center focus:outline-none focus:ring-2 focus:ring-destructive"
                placeholder="كلمة المرور..."
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowSecondPassword(!showSecondPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showSecondPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
            {secondGateError && (
              <div className="flex items-center gap-1 text-destructive text-xs font-cairo">
                <AlertTriangle className="w-3 h-3" /> {secondGateError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowSecondGate(false);
                  setSecondPassword('');
                  setSecondGateError('');
                }}
                className="flex-1 py-2 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground"
              >
                إلغاء
              </button>
              <button type="submit" className="flex-1 py-2 rounded font-cairo font-bold text-sm bg-destructive text-destructive-foreground">
                دخول
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hidden admin panel */}
      {showHiddenAdmin && (
        <HiddenActivationAdmin onClose={() => setShowHiddenAdmin(false)} />
      )}

      <CompanyCredits />
    </div>
  );
};

// Hidden admin page for generating activation codes
export const HiddenActivationAdmin = ({ onClose }: { onClose: () => void }) => {
  const [deviceCodeInput, setDeviceCodeInput] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentPass, setCurrentPass] = useState(getCurrentPassword());
  const [currentSms, setCurrentSms] = useState(getCurrentSmsCode());

  // Refresh every 10 seconds to show latest
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPass(getCurrentPassword());
      setCurrentSms(getCurrentSmsCode());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerate = () => {
    if (deviceCodeInput.trim().length >= 6) {
      const code = generateActivationCode(deviceCodeInput.trim());
      setGeneratedCode(code);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center z-[100] p-4">
      <div className="bg-card rounded-xl border border-border p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-cairo font-black text-lg text-destructive">🔒 لوحة التفعيل السرية</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl font-bold">✕</button>
        </div>

        {/* Current rotating password */}
        <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30 space-y-2">
          <label className="font-cairo text-sm text-muted-foreground block">كلمة المرور الحالية (تتغير كل 5 دقائق):</label>
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-xl tracking-widest text-destructive flex-1">{currentPass}</span>
            <button onClick={() => handleCopy(currentPass)} className="p-2 rounded hover:bg-secondary">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Current SMS code */}
        <div className="p-4 bg-success/10 rounded-lg border border-success/30 space-y-2">
          <label className="font-cairo text-sm text-muted-foreground block">رمز SMS الحالي (يتغير كل 5 دقائق):</label>
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-xl tracking-widest text-success flex-1">{currentSms}</span>
            <button onClick={() => handleCopy(currentSms)} className="p-2 rounded hover:bg-secondary">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Generate activation code for device */}
        <div className="p-4 bg-supermarket/10 rounded-lg border border-supermarket/30 space-y-3">
          <label className="font-cairo text-sm font-bold block">إنشاء كود تفعيل لجهاز:</label>
          <input
            value={deviceCodeInput}
            onChange={e => { setDeviceCodeInput(e.target.value); setGeneratedCode(''); }}
            placeholder="أدخل كود الجهاز (8 أرقام)..."
            className="w-full h-10 px-3 bg-secondary rounded font-mono text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-supermarket"
          />
          <button
            onClick={handleGenerate}
            disabled={deviceCodeInput.trim().length < 6}
            className="w-full py-2 rounded font-cairo font-bold text-sm bg-supermarket text-supermarket-foreground hover:opacity-90 disabled:opacity-30"
          >
            إنشاء كود التفعيل
          </button>

          {generatedCode && (
            <div className="flex items-center gap-2 p-3 bg-success/20 rounded-lg">
              <span className="font-mono font-black text-xl tracking-widest text-success flex-1 text-center">{generatedCode}</span>
              <button onClick={() => handleCopy(generatedCode)} className="p-2 rounded hover:bg-secondary">
                {copied ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivationGate;
