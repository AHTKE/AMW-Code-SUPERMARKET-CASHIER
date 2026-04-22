import { useState } from 'react';
import { Cashier, CashierSession } from '@/types/pos';
import { getCashiers, addCashier, updateCashier, deleteCashier, getCashierSessions, getSales } from '@/lib/store';
import { Plus, Pencil, Trash2, X, Eye, EyeOff, Clock, Users } from 'lucide-react';

const CashierManager = () => {
  const [cashiers, setCashiers] = useState<Cashier[]>(getCashiers());
  const [sessions] = useState<CashierSession[]>(getCashierSessions());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cashier | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<'cashiers' | 'sessions'>('cashiers');

  const [form, setForm] = useState({ name: '', password: '', code: '' });

  const sales = getSales();

  const openNew = () => {
    setForm({ name: '', password: '', code: '' });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (c: Cashier) => {
    setForm({ name: c.name, password: c.password, code: c.code });
    setEditing(c);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.password.trim() || !form.code.trim()) return;
    if (editing) {
      const updated: Cashier = { ...editing, name: form.name.trim(), password: form.password.trim(), code: form.code.trim() };
      setCashiers(updateCashier(updated));
    } else {
      const newCashier: Cashier = {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        password: form.password.trim(),
        code: form.code.trim(),
        active: true,
        createdAt: Date.now(),
      };
      setCashiers(addCashier(newCashier));
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setCashiers(deleteCashier(id));
  };

  const toggleActive = (c: Cashier) => {
    setCashiers(updateCashier({ ...c, active: !c.active }));
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
  };

  const getDuration = (login: number, logout?: number) => {
    const end = logout || Date.now();
    const mins = Math.round((end - login) / 60000);
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return hrs > 0 ? `${hrs} ساعة ${remainMins} دقيقة` : `${remainMins} دقيقة`;
  };

  const getCashierSalesCount = (cashierId: string) => {
    return sales.filter(s => s.cashierId === cashierId).length;
  };

  const getCashierSalesTotal = (cashierId: string) => {
    return sales.filter(s => s.cashierId === cashierId).reduce((sum, s) => sum + s.total, 0);
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('cashiers')}
          className={`flex items-center gap-2 px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${
            tab === 'cashiers' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          <Users className="w-4 h-4" />
          الكاشيرات ({cashiers.length})
        </button>
        <button
          onClick={() => setTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${
            tab === 'sessions' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          <Clock className="w-4 h-4" />
          سجل الحضور ({sessions.length})
        </button>
      </div>

      {tab === 'cashiers' && (
        <>
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            إضافة كاشير
          </button>

          <div className="space-y-2">
            {cashiers.map(c => (
              <div key={c.id} className={`p-4 rounded-lg border ${c.active ? 'bg-card border-border' : 'bg-muted/50 border-border opacity-60'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-cairo font-bold text-lg">{c.name}</div>
                    <div className="text-xs text-muted-foreground font-cairo">
                      كود: <span className="font-mono">{c.code}</span>
                      {' • '}
                      كلمة المرور: 
                      <button
                        onClick={() => setShowPasswords({ ...showPasswords, [c.id]: !showPasswords[c.id] })}
                        className="inline-flex items-center gap-1 mr-1"
                      >
                        {showPasswords[c.id] ? (
                          <>
                            <span className="font-mono">{c.password}</span>
                            <EyeOff className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            <span>••••</span>
                            <Eye className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      المبيعات: {getCashierSalesCount(c.id)} فاتورة ({getCashierSalesTotal(c.id)} ج.م)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(c)}
                      className={`px-3 py-1 rounded text-xs font-cairo font-bold ${
                        c.active ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'
                      }`}
                    >
                      {c.active ? 'نشط' : 'معطل'}
                    </button>
                    <button onClick={() => openEdit(c)} className="p-1 hover:bg-secondary rounded">
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="p-1 hover:bg-destructive/20 rounded">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {cashiers.length === 0 && (
              <div className="text-center text-muted-foreground py-8 font-cairo">لا يوجد كاشيرات. أضف كاشير جديد.</div>
            )}
          </div>
        </>
      )}

      {tab === 'sessions' && (
        <div className="space-y-2">
          {sessions.slice().reverse().map(s => (
            <div key={s.id} className="p-4 bg-card rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-cairo font-bold">{s.cashierName}</div>
                  <div className="text-xs text-muted-foreground">
                    دخول: {formatTime(s.loginTime)}
                    {s.logoutTime && ` • خروج: ${formatTime(s.logoutTime)}`}
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-cairo font-black text-supermarket">{s.salesTotal} ج.م</div>
                  <div className="text-xs text-muted-foreground">{s.salesCount} فاتورة • {getDuration(s.loginTime, s.logoutTime)}</div>
                </div>
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center text-muted-foreground py-8 font-cairo">لا يوجد سجل حضور</div>
          )}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-cairo font-bold text-lg">{editing ? 'تعديل كاشير' : 'إضافة كاشير جديد'}</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="font-cairo text-sm text-muted-foreground">اسم الكاشير *</label>
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                  placeholder="مثال: أحمد محمد"
                />
              </div>
              <div>
                <label className="font-cairo text-sm text-muted-foreground">كود الدخول *</label>
                <input
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value })}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                  placeholder="مثال: 001"
                />
              </div>
              <div>
                <label className="font-cairo text-sm text-muted-foreground">كلمة المرور *</label>
                <input
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                  placeholder="كلمة مرور الكاشير"
                />
              </div>
            </div>
            <button
              onClick={handleSave}
              className="w-full py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90"
            >
              {editing ? 'حفظ التعديلات' : 'إضافة الكاشير'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierManager;
