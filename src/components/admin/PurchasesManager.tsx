import { useState, useMemo } from 'react';
import { Plus, Trash2, X, FileDown, Calendar, ShoppingCart } from 'lucide-react';
import { exportToPDF } from '@/lib/pdfExport';

interface Purchase {
  id: string;
  supplier: string;
  description: string;
  items: string;
  amount: number;
  date: string;
  time: string;
  timestamp: number;
}

const PURCHASES_KEY = 'pos_purchases';

function getPurchases(): Purchase[] {
  try {
    const raw = localStorage.getItem(PURCHASES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePurchases(purchases: Purchase[]) {
  localStorage.setItem(PURCHASES_KEY, JSON.stringify(purchases));
}

const PurchasesManager = () => {
  const [purchases, setPurchases] = useState<Purchase[]>(getPurchases());
  const [showForm, setShowForm] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [form, setForm] = useState({ supplier: '', description: '', items: '', amount: 0 });

  const filtered = useMemo(() => {
    if (!dateFrom && !dateTo) return purchases;
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const to = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity;
    return purchases.filter(p => p.timestamp >= from && p.timestamp <= to);
  }, [purchases, dateFrom, dateTo]);

  const total = filtered.reduce((s, p) => s + p.amount, 0);

  const handleAdd = () => {
    if (!form.supplier.trim() || !form.amount) return;
    const now = new Date();
    const purchase: Purchase = {
      id: crypto.randomUUID(),
      supplier: form.supplier.trim(),
      description: form.description.trim(),
      items: form.items.trim(),
      amount: form.amount,
      date: now.toLocaleDateString('ar-EG'),
      time: now.toLocaleTimeString('ar-EG'),
      timestamp: now.getTime(),
    };
    const updated = [...purchases, purchase];
    savePurchases(updated);
    setPurchases(updated);
    setForm({ supplier: '', description: '', items: '', amount: 0 });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    const updated = purchases.filter(p => p.id !== id);
    savePurchases(updated);
    setPurchases(updated);
  };

  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير المشتريات',
      dateRange: dateFrom && dateTo ? `${dateFrom} إلى ${dateTo}` : 'كل الفترات',
      summary: [
        { label: 'إجمالي المشتريات', value: `${total} ج.م` },
        { label: 'عدد العمليات', value: `${filtered.length}` },
      ],
      headers: ['#', 'المورد', 'الوصف', 'الأصناف', 'المبلغ', 'التاريخ'],
      rows: filtered.slice().reverse().map((p, i) => [
        String(i + 1), p.supplier, p.description, p.items, `${p.amount} ج.م`, p.date,
      ]),
    });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-cafe/10 rounded-lg border border-cafe/30">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-cafe" />
          <span className="font-cairo font-bold text-cafe">إجمالي المشتريات</span>
        </div>
        <div className="font-cairo font-black text-2xl text-cafe mt-1">{total} ج.م</div>
        <div className="text-xs text-muted-foreground">{filtered.length} عملية شراء</div>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-card p-3 rounded-lg border border-border">
        <Calendar className="w-5 h-5 text-muted-foreground" />
        <div className="flex items-center gap-2">
          <label className="font-cairo text-sm text-muted-foreground">من:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-9 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-cairo text-sm text-muted-foreground">إلى:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-9 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-destructive font-cairo hover:underline">مسح الفلتر</button>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90">
          <Plus className="w-4 h-4" /> إضافة عملية شراء
        </button>
        <button onClick={handleExportPDF} disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-cafe text-cafe-foreground rounded font-cairo font-bold text-sm hover:opacity-90 disabled:opacity-30">
          <FileDown className="w-4 h-4" /> تصدير PDF
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-cairo font-bold">إضافة عملية شراء</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                placeholder="اسم المورد..." className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket" />
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="وصف العملية..." className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket" />
              <input value={form.items} onChange={e => setForm({ ...form, items: e.target.value })}
                placeholder="الأصناف المشتراة..." className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket" />
              <input type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                placeholder="المبلغ" className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket" />
            </div>
            <button onClick={handleAdd}
              className="w-full py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90">
              إضافة
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.slice().reverse().map(p => (
          <div key={p.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
            <div>
              <div className="font-cairo font-bold text-sm">{p.supplier}</div>
              <div className="text-xs text-muted-foreground">{p.description} • {p.items}</div>
              <div className="text-xs text-muted-foreground">{p.date} {p.time}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-cairo font-black text-cafe">{p.amount} ج.م</span>
              <button onClick={() => handleDelete(p.id)} className="p-1 hover:bg-destructive/20 rounded">
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-8 font-cairo">لا توجد مشتريات</div>
        )}
      </div>
    </div>
  );
};

export default PurchasesManager;
