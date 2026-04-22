import { useState } from 'react';
import { Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { isAdminSetup, verifyAdmin, verifyMasterRecovery, setAdminCredentials } from '@/lib/store';
import CompanyCredits from './CompanyCredits';

interface AdminLoginProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const AdminLogin = ({ onSuccess, onCancel }: AdminLoginProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'setup' | 'recovery'>(!isAdminSetup() ? 'setup' : 'login');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = () => {
    if (!username.trim() || !password.trim()) {
      setError('أدخل الاسم وكلمة المرور');
      return;
    }
    if (verifyAdmin(username.trim(), password.trim())) {
      onSuccess();
    } else {
      setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  const handleSetup = () => {
    if (!username.trim() || !password.trim()) {
      setError('أدخل الاسم وكلمة المرور');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    if (password.length < 4) {
      setError('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
      return;
    }
    setAdminCredentials({ username: username.trim(), password: password.trim() });
    onSuccess();
  };

  const handleRecovery = () => {
    if (verifyMasterRecovery(username.trim(), password.trim())) {
      // Reset admin credentials - go to setup
      setMode('setup');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setError('');
    } else {
      setError('بيانات الاسترداد غير صحيحة');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') handleLogin();
    else if (mode === 'setup') handleSetup();
    else handleRecovery();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 overflow-y-auto">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-card rounded-xl border border-border p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-supermarket/20 flex items-center justify-center">
            <Lock className="w-8 h-8 text-supermarket" />
          </div>
          <h1 className="font-cairo font-black text-xl">
            {mode === 'setup' ? '🔐 إعداد حساب المدير' : mode === 'recovery' ? '🔑 استرداد كلمة المرور' : '🔐 دخول المدير'}
          </h1>
          {mode === 'recovery' && (
            <p className="text-xs text-muted-foreground font-cairo">أدخل بيانات الاسترداد الثابتة</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded text-destructive text-sm font-cairo">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="font-cairo text-sm text-muted-foreground block mb-1">اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              className="w-full h-12 px-4 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
              autoFocus
            />
          </div>
          <div>
            <label className="font-cairo text-sm text-muted-foreground block mb-1">كلمة المرور</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full h-12 px-4 pl-12 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {mode === 'setup' && (
            <div>
              <label className="font-cairo text-sm text-muted-foreground block mb-1">تأكيد كلمة المرور</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                className="w-full h-12 px-4 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            type="submit"
            className="w-full py-3 rounded font-cairo font-bold bg-supermarket text-supermarket-foreground hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            {mode === 'setup' ? 'إنشاء الحساب' : mode === 'recovery' ? 'استرداد' : 'دخول'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              إلغاء
            </button>
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setMode('recovery'); setUsername(''); setPassword(''); setError(''); }}
                className="flex-1 py-2 rounded font-cairo font-bold text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                نسيت كلمة المرور
              </button>
            )}
            {mode === 'recovery' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setUsername(''); setPassword(''); setError(''); }}
                className="flex-1 py-2 rounded font-cairo font-bold text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                العودة لتسجيل الدخول
              </button>
            )}
          </div>
        </div>
      </form>
      <p className="text-[10px] text-muted-foreground font-cairo mt-3 text-center">تحت رعاية أحمد محمد وهبة</p>
      <CompanyCredits />
    </div>
  );
};

export default AdminLogin;
