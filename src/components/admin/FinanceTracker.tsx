import { useState, useMemo } from 'react';
import { Expense, Income } from '@/types/pos';
import { getExpenses, addExpense, deleteExpense, getIncomeList, addIncome, deleteIncome } from '@/lib/store';
import { Plus, Trash2, X, TrendingDown, TrendingUp, FileDown, Calendar } from 'lucide-react';
import { exportToPDF } from '@/lib/pdfExport';

const FinanceTracker = () => {
  const [expenses, setExpenses] = useState<Expense[]>(getExpenses());
  const [incomeList, setIncomeList] = useState<Income[]>(getIncomeList());
  const [tab, setTab] = useState<'expenses' | 'income'>('expenses');
  const [showForm, setShowForm] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [form, setForm] = useState({ description: '', amount: 0, category: '' });

  const expenseCategories = ['إيجار', 'كهرباء', 'رواتب', 'بضاعة', 'صيانة', 'نقل', 'أخرى'];
  const incomeCategories = ['إيراد إضافي', 'تحصيل ديون', 'استثمار', 'أخرى'];

  const filteredExpenses = useMemo(() => {
    if (!dateFrom && !dateTo) return expenses;
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const to = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity;
    return expenses.filter(e => e.timestamp >= from && e.timestamp <= to);
  }, [expenses, dateFrom, dateTo]);

  const filteredIncome = useMemo(() => {
    if (!dateFrom && !dateTo) return incomeList;
    const from = dateFrom ? new Date(dateFrom).getTime() : 0;
    const to = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity;
    return incomeList.filter(i => i.timestamp >= from && i.timestamp <= to);
  }, [incomeList, dateFrom, dateTo]);

  const handleAdd = () => {
    if (!form.description || !form.amount) return;
    const now = new Date();
    if (tab === 'expenses') {
      const expense: Expense = {
        id: crypto.randomUUID(),
        description: form.description,
        amount: form.amount,
        category: form.category || 'أخرى',
        date: now.toLocaleDateString('ar-EG'),
        time: now.toLocaleTimeString('ar-EG'),
        timestamp: now.getTime(),
      };
      setExpenses(addExpense(expense));
    } else {
      const income: Income = {
        id: crypto.randomUUID(),
        description: form.description,
        amount: form.amount,
        category: form.category || 'أخرى',
        date: now.toLocaleDateString('ar-EG'),
        time: now.toLocaleTimeString('ar-EG'),
        timestamp: now.getTime(),
      };
      setIncomeList(addIncome(income));
    }
    setForm({ description: '', amount: 0, category: '' });
    setShowForm(false);
  };

  const handleDeleteExpense = (id: string) => setExpenses(deleteExpense(id));
  const handleDeleteIncome = (id: string) => setIncomeList(deleteIncome(id));

  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = filteredIncome.reduce((s, i) => s + i.amount, 0);

  const items = tab === 'expenses' ? filteredExpenses : filteredIncome;
  const categories = tab === 'expenses' ? expenseCategories : incomeCategories;

  const handleExportPDF = () => {
    const dateRange = dateFrom && dateTo ? `${dateFrom} إلى ${dateTo}` : 'كل الفترات';
    const title = tab === 'expenses' ? 'تقرير المصروفات' : 'تقرير الدخل';
    
    exportToPDF({
      title,
      dateRange,
      summary: [
        { label: 'إجمالي المصروفات', value: `${totalExpenses} ج.م` },
        { label: 'إجمالي الدخل', value: `${totalIncome} ج.م` },
        { label: 'الصافي', value: `${totalIncome - totalExpenses} ج.م` },
      ],
      headers: ['#', 'الوصف', 'التصنيف', 'المبلغ', 'التاريخ', 'الوقت'],
      rows: items.slice().reverse().map((item, i) => [
        String(i + 1),
        item.description,
        item.category,
        `${item.amount} ج.م`,
        item.date,
        item.time,
      ]),
    });
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-destructive" />
            <span className="font-cairo font-bold text-destructive">المصروفات</span>
          </div>
          <div className="font-cairo font-black text-2xl text-destructive mt-1">{totalExpenses} ج.م</div>
        </div>
        <div className="p-4 bg-success/10 rounded-lg border border-success/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            <span className="font-cairo font-bold text-success">الدخل</span>
          </div>
          <div className="font-cairo font-black text-2xl text-success mt-1">{totalIncome} ج.م</div>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 items-center bg-card p-3 rounded-lg border border-border">
        <Calendar className="w-5 h-5 text-muted-foreground" />
        <div className="flex items-center gap-2">
          <label className="font-cairo text-sm text-muted-foreground">من:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="h-9 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-cairo text-sm text-muted-foreground">إلى:</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="h-9 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-destructive font-cairo hover:underline"
          >
            مسح الفلتر
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('expenses')}
          className={`flex-1 py-2 rounded font-cairo font-bold text-sm transition-colors ${
            tab === 'expenses' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          المصروفات ({filteredExpenses.length})
        </button>
        <button
          onClick={() => setTab('income')}
          className={`flex-1 py-2 rounded font-cairo font-bold text-sm transition-colors ${
            tab === 'income' ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          الدخل ({filteredIncome.length})
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowForm(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded font-cairo font-bold text-sm ${
            tab === 'expenses' ? 'bg-destructive text-destructive-foreground' : 'bg-success text-success-foreground'
          }`}
        >
          <Plus className="w-4 h-4" />
          إضافة {tab === 'expenses' ? 'مصروف' : 'دخل'}
        </button>
        <button
          onClick={handleExportPDF}
          disabled={items.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-cafe text-cafe-foreground rounded font-cairo font-bold text-sm hover:opacity-90 disabled:opacity-30"
        >
          <FileDown className="w-4 h-4" />
          تصدير PDF
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-cairo font-bold">{tab === 'expenses' ? 'إضافة مصروف' : 'إضافة دخل'}</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="الوصف..."
                className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
              />
              <input
                type="number"
                value={form.amount || ''}
                onChange={e => setForm({ ...form, amount: Number(e.target.value) })}
                placeholder="المبلغ"
                className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
              />
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none"
              >
                <option value="">اختر التصنيف</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              onClick={handleAdd}
              className={`w-full py-3 rounded font-cairo font-bold text-sm ${
                tab === 'expenses' ? 'bg-destructive text-destructive-foreground' : 'bg-success text-success-foreground'
              }`}
            >
              إضافة
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {items.slice().reverse().map(item => (
          <div key={item.id} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
            <div>
              <div className="font-cairo font-bold text-sm">{item.description}</div>
              <div className="text-xs text-muted-foreground">{item.category} • {item.date} {item.time}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-cairo font-black ${tab === 'expenses' ? 'text-destructive' : 'text-success'}`}>
                {item.amount} ج.م
              </span>
              <button
                onClick={() => tab === 'expenses' ? handleDeleteExpense(item.id) : handleDeleteIncome(item.id)}
                className="p-1 hover:bg-destructive/20 rounded"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center text-muted-foreground py-8 font-cairo">لا توجد بيانات</div>
        )}
      </div>
    </div>
  );
};

export default FinanceTracker;
