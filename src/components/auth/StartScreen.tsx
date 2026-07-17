import { useState } from 'react';
import { Lock, User, Radio } from 'lucide-react';
import { isAdminSetup } from '@/lib/store';
import { getStoreInfo } from '@/lib/settings';
import { getManagerTelegramConfig, getTelegramConfig, hasManagerTelegramConfigRaw } from '@/lib/telegramSync';
import scLogo from '@/assets/supermarket-cashier-logo-v2.jpeg';
import { normalizeSecret } from '@/lib/normalizeSecret';
import { HiddenActivationAdmin } from './ActivationGate';
import CompanyCredits from './CompanyCredits';

interface StartScreenProps {
  onAdminLogin: () => void;
  onCashierLogin: () => void;
  onBranchManagerLogin: () => void;
}

const StartScreen = ({ onAdminLogin, onCashierLogin, onBranchManagerLogin }: StartScreenProps) => {
  const adminSetup = isAdminSetup();
  const storeInfo = getStoreInfo();
  // Device role lock:
  //   - Manager device: an explicit manager telegram config was saved here.
  //     Hide cashier + single-branch admin entries.
  //   - Branch device: this device is bound to a Telegram channel as a
  //     regular branch (not the "manager" role). Hide the "مدير الفروع"
  //     entry so nobody can accidentally overwrite the manager channel from
  //     a cashier device. We check the RAW branch config only — the manager
  //     helper synthesises a fake manager cfg from a branch cfg, which used
  //     to leave both flags off and never hide the manager button.
  const managerCfg = getManagerTelegramConfig();
  const branchCfg = getTelegramConfig();
  const managerDeviceReal = hasManagerTelegramConfigRaw();
  const isManagerDevice = managerDeviceReal && !!managerCfg?.botToken;
  const isBranchDevice =
    !managerDeviceReal &&
    !!branchCfg?.botToken &&
    branchCfg.branchId !== 'manager';
  
  // Hidden activation admin: type AaAa2468AaAa in password field, click 3 times
  const [hiddenInput, setHiddenInput] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [showSecondGate, setShowSecondGate] = useState(false);
  const [secondPassword, setSecondPassword] = useState('');
  const [showHiddenAdmin, setShowHiddenAdmin] = useState(false);

  const handleHiddenClick = () => {
    if (normalizeSecret(hiddenInput) === 'AaAa2468AaAa') {
      const newCount = clickCount + 1;
      setClickCount(newCount);
      if (newCount >= 3) {
        setShowSecondGate(true);
        setClickCount(0);
        setHiddenInput('');
      }
    }
  };

  const handleSecondGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (normalizeSecret(secondPassword) === 'AMW2025@SECURE') {
      setShowHiddenAdmin(true);
      setShowSecondGate(false);
      setSecondPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 overflow-y-auto">
      <div className="w-full max-w-sm space-y-6 text-center py-6">
        {/* Logo */}
        <div className="space-y-3">
          <div className="w-28 h-28 mx-auto rounded-2xl overflow-hidden shadow-lg">
            <img src={scLogo} alt="SUPERMARKET CASHIER" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-cairo font-black text-2xl">{storeInfo.name || 'SUPERMARKET CASHIER'}</h1>
          {storeInfo.address && (
            <p className="font-cairo text-muted-foreground text-xs">{storeInfo.address}</p>
          )}
          <p className="font-cairo text-muted-foreground text-sm">نظام نقاط البيع المتكامل</p>
        </div>

        {/* Login options — device-role aware:
             - Manager device (server activated as مدير الفروع):
               show ONLY مدير الفروع.
             - Branch device (server activated as فرع/سوبرماركت):
               hide مدير الفروع, show المدير + الكاشير.
             - No server activated: show all three. */}
        <div className="space-y-3">
          {!isManagerDevice && (
            <button
              onClick={onAdminLogin}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-supermarket text-supermarket-foreground font-cairo font-bold text-lg hover:opacity-90 transition-opacity active:scale-[0.98]"
            >
              <Lock className="w-6 h-6" />
              دخول المدير
            </button>
          )}

          {!isManagerDevice && (
            <button
              onClick={onCashierLogin}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-cafe text-cafe-foreground font-cairo font-bold text-lg hover:opacity-90 transition-opacity active:scale-[0.98]"
            >
              <User className="w-6 h-6" />
              دخول الكاشير
            </button>
          )}

          {!isBranchDevice && (
            <button
              onClick={onBranchManagerLogin}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border-2 border-supermarket/40 bg-supermarket/10 text-supermarket font-cairo font-bold text-base hover:bg-supermarket/20 transition-colors active:scale-[0.98]"
            >
              <Radio className="w-5 h-5" />
              مدير الفروع
            </button>
          )}

          {isManagerDevice && (
            <p className="font-cairo text-[11px] text-muted-foreground leading-relaxed pt-1">
              هذا الجهاز مضبوط حالياً كـ<b> مدير فروع</b>.
            </p>
          )}
          {isBranchDevice && (
            <p className="font-cairo text-[11px] text-muted-foreground leading-relaxed pt-1">
              هذا الجهاز مربوط كـ<b> فرع</b> على قناة السيرفر.
            </p>
          )}
        </div>


        <p className="text-xs text-muted-foreground font-cairo">
          {adminSetup ? '✓ تم إعداد حساب المدير' : 'المدير: سيتم إنشاء الحساب عند أول دخول'}
        </p>

        {/* Hidden activation input - looks like a subtitle */}
        <div className="relative">
          <input
            type="password"
            value={hiddenInput}
            onChange={e => { setHiddenInput(e.target.value); setClickCount(0); }}
            onClick={handleHiddenClick}
            className="w-full text-center text-[10px] text-muted-foreground font-cairo bg-transparent border-none outline-none"
            placeholder="تحت رعاية أحمد محمد وهبة"
            autoComplete="off"
            inputMode="text"
          />
        </div>

        <CompanyCredits />
      </div>

      {/* Second gate modal */}
      {showSecondGate && (
        <div className="fixed inset-0 bg-background/90 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSecondGateSubmit} className="bg-card rounded-xl border border-border p-6 w-full max-w-xs space-y-4">
            <h3 className="font-cairo font-bold text-center">🔑 تأكيد الهوية</h3>
            <input
              type="password"
              value={secondPassword}
              onChange={e => setSecondPassword(e.target.value)}
              className="w-full h-10 px-3 bg-secondary rounded font-mono text-center focus:outline-none focus:ring-2 focus:ring-destructive"
              placeholder="كلمة المرور..."
              autoFocus
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowSecondGate(false); setSecondPassword(''); }}
                className="flex-1 py-2 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground">إلغاء</button>
              <button type="submit" className="flex-1 py-2 rounded font-cairo font-bold text-sm bg-destructive text-destructive-foreground">دخول</button>
            </div>
          </form>
        </div>
      )}

      {/* Hidden admin panel */}
      {showHiddenAdmin && (
        <HiddenActivationAdmin onClose={() => setShowHiddenAdmin(false)} />
      )}
    </div>
  );
};

export default StartScreen;
