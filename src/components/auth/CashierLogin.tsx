import { useState } from 'react';
import { User, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { getCashiers, startCashierSession } from '@/lib/store';
import { Cashier, CashierSession } from '@/types/pos';
import CompanyCredits from './CompanyCredits';

interface CashierLoginProps {
  onSuccess: (cashier: Cashier, session: CashierSession) => void;
  onCancel: () => void;
}

const CashierLogin = ({ onSuccess, onCancel }: CashierLoginProps) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password.trim()) {
      setError('أدخل الاسم وكلمة المرور');
      return;
    }

    const cashiers = getCashiers();
    
    if (cashiers.length === 0) {
      setError('لا يوجد كاشيرات مسجلين. اطلب من المدير إضافة كاشير.');
      return;
    }

    // Find cashier by name only (not code)
    const cashier = cashiers.find(c => {
      const nameMatch = c.name.trim() === name.trim();
      const passMatch = c.password.trim() === password.trim();
      return nameMatch && passMatch && c.active;
    });

    if (cashier) {
      const session = startCashierSession(cashier);
      onSuccess(cashier, session);
    } else {
      const byName = cashiers.find(c => c.name.trim() === name.trim());
      if (!byName) {
        setError('الاسم غير موجود');
      } else if (!byName.active) {
        setError('هذا الحساب معطل. تواصل مع المدير.');
      } else {
        setError('كلمة المرور غير صحيحة');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 overflow-y-auto">
      <form onSubmit={handleLogin} className="w-full max-w-sm bg-card rounded-xl border border-border p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-full bg-cafe/20 flex items-center justify-center">
            <User className="w-8 h-8 text-cafe" />
          </div>
          <h1 className="font-cairo font-black text-xl">👤 دخول الكاشير</h1>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded text-destructive text-sm font-cairo">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="font-cairo text-sm text-muted-foreground block mb-1">اسم الكاشير</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              className="w-full h-12 px-4 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-cafe"
              autoFocus
              placeholder="أدخل اسمك..."
            />
          </div>
          <div>
            <label className="font-cairo text-sm text-muted-foreground block mb-1">كلمة المرور</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full h-12 px-4 pl-12 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-cafe"
                placeholder="كلمة المرور..."
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
        </div>

        <div className="space-y-3">
          <button
            type="submit"
            className="w-full py-3 rounded font-cairo font-bold bg-cafe text-cafe-foreground hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            دخول
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            رجوع
          </button>
        </div>
      </form>
      <p className="text-[10px] text-muted-foreground font-cairo mt-3 text-center">تحت رعاية أحمد محمد وهبة</p>
      <CompanyCredits />
    </div>
  );
};

export default CashierLogin;
