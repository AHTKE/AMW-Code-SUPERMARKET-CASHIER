import { useState } from 'react';
import { ArrowRight, BarChart3, Package, DollarSign, FileText, Settings, Users, Lock, Tag, ShoppingCart, RotateCcw, Shield, Database, Gift, ClipboardList } from 'lucide-react';
import SalesReport from './SalesReport';
import ProductManager from './ProductManager';
import FinanceTracker from './FinanceTracker';
import InventoryView from './InventoryView';
import CashierManager from './CashierManager';
import AdminSettings from './AdminSettings';
import CategoryManager from './CategoryManager';
import PurchasesManager from './PurchasesManager';
import SalesReturns from './SalesReturns';
import PermissionsManager from './PermissionsManager';
import DataTransferManager from './DataTransferManager';
import CouponManager from './CouponManager';
import AdminActivityLog from './AdminActivityLog';

interface AdminDashboardProps {
  onBack: () => void;
}

type AdminTab = 'overview' | 'sales' | 'returns' | 'products' | 'categories' | 'purchases' | 'finance' | 'inventory' | 'cashiers' | 'permissions' | 'coupons' | 'data' | 'settings' | 'activity-log';

const AdminDashboard = ({ onBack }: AdminDashboardProps) => {
  const [tab, setTab] = useState<AdminTab>('overview');

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'نظرة عامة', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'sales', label: 'المبيعات', icon: <FileText className="w-4 h-4" /> },
    { id: 'returns', label: 'المرتجعات', icon: <RotateCcw className="w-4 h-4" /> },
    { id: 'products', label: 'الأصناف', icon: <Package className="w-4 h-4" /> },
    { id: 'categories', label: 'التصنيفات', icon: <Tag className="w-4 h-4" /> },
    { id: 'coupons', label: 'الخصومات', icon: <Gift className="w-4 h-4" /> },
    { id: 'purchases', label: 'المشتريات', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'finance', label: 'الحسابات', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'inventory', label: 'المخازن', icon: <Settings className="w-4 h-4" /> },
    { id: 'cashiers', label: 'الموظفين', icon: <Users className="w-4 h-4" /> },
    { id: 'permissions', label: 'الصلاحيات', icon: <Shield className="w-4 h-4" /> },
    { id: 'data', label: 'نقل البيانات', icon: <Database className="w-4 h-4" /> },
    { id: 'activity-log', label: 'سجل النشاط', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'settings', label: 'الإعدادات', icon: <Lock className="w-4 h-4" /> },
  ];

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="h-14 flex items-center justify-between px-4 bg-card border-b border-border">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-cairo font-bold text-sm">
          <ArrowRight className="w-4 h-4" />
          العودة للكاشير
        </button>
        <span className="font-cairo text-[10px] text-muted-foreground">تحت رعاية أحمد محمد وهبة</span>
        <h1 className="font-cairo font-black text-lg">🔐 لوحة تحكم المدير</h1>
      </div>

      <div className="flex gap-1 p-2 bg-card border-b border-border overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded font-cairo font-bold text-sm whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-supermarket text-supermarket-foreground' : 'text-muted-foreground hover:bg-secondary'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'sales' && <SalesReport />}
        {tab === 'returns' && <SalesReturns />}
        {tab === 'products' && <ProductManager />}
        {tab === 'categories' && <CategoryManager />}
        {tab === 'coupons' && <CouponManager />}
        {tab === 'purchases' && <PurchasesManager />}
        {tab === 'finance' && <FinanceTracker />}
        {tab === 'inventory' && <InventoryView />}
        {tab === 'cashiers' && <CashierManager />}
        {tab === 'permissions' && <PermissionsManager />}
        {tab === 'data' && <DataTransferManager />}
        {tab === 'activity-log' && <AdminActivityLog />}
        {tab === 'settings' && <AdminSettings />}
      </div>
    </div>
  );
};

import { getSales, getExpenses, getIncomeList, getProducts } from '@/lib/store';
import { getReturns, getReturnedQtysForSale } from './SalesReturns';
import { getHeldInvoices } from '@/lib/holdInvoice';

const OverviewTab = () => {
  const sales = getSales();
  const expenses = getExpenses();
  const income = getIncomeList();
  const products = getProducts();
  const returns = getReturns();
  const heldInvoices = getHeldInvoices();

  const today = new Date().toLocaleDateString('ar-EG');
  const todaySales = sales.filter(s => s.date === today);
  const todayTotalGross = todaySales.reduce((s, sale) => s + sale.total, 0);
  const totalSalesGross = sales.reduce((s, sale) => s + sale.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const totalReturns = returns.reduce((s, r) => s + r.total, 0);
  const todayReturns = returns.filter(r => {
    const rDate = new Date(r.timestamp).toLocaleDateString('ar-EG');
    return rDate === today;
  });
  const todayReturnsTotal = todayReturns.reduce((s, r) => s + r.total, 0);
  const todayTotalNet = todayTotalGross - todayReturnsTotal;
  const totalSalesNet = totalSalesGross - totalReturns;
  const lowStock = products.filter(p => p.stock < 10 && p.type === 'supermarket');

  const cards = [
    { label: 'مبيعات اليوم (قبل المرتجع)', value: `${todayTotalGross} ج.م`, sub: `${todaySales.length} فاتورة`, color: 'bg-supermarket/20 text-supermarket' },
    { label: 'مرتجعات اليوم', value: `${todayReturnsTotal} ج.م`, sub: `${todayReturns.length} عملية`, color: 'bg-destructive/20 text-destructive' },
    { label: '💰 صافي مبيعات اليوم', value: `${todayTotalNet} ج.م`, sub: 'بعد خصم المرتجعات', color: 'bg-success/20 text-success' },
    { label: 'إجمالي المبيعات (قبل المرتجع)', value: `${totalSalesGross} ج.م`, sub: `${sales.length} فاتورة`, color: 'bg-supermarket/20 text-supermarket' },
    { label: 'إجمالي المرتجعات', value: `${totalReturns} ج.م`, sub: `${returns.length} عملية`, color: 'bg-destructive/20 text-destructive' },
    { label: '💰 صافي المبيعات', value: `${totalSalesNet} ج.م`, sub: 'بعد خصم المرتجعات', color: 'bg-success/20 text-success' },
    { label: 'المصروفات', value: `${totalExpenses} ج.م`, sub: `${expenses.length} عملية`, color: 'bg-destructive/20 text-destructive' },
    { label: 'الدخل الإضافي', value: `${totalIncome} ج.م`, sub: `${income.length} عملية`, color: 'bg-cafe/20 text-cafe' },
    { label: '📊 صافي الأرباح', value: `${totalSalesNet + totalIncome - totalExpenses} ج.م`, sub: 'صافي المبيعات + الدخل - المصروفات', color: 'bg-foreground/10 text-foreground' },
    { label: 'نقص المخزون', value: `${lowStock.length} منتج`, sub: 'أقل من 10 وحدات', color: lowStock.length > 0 ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success' },
    { label: 'فواتير معلقة', value: `${heldInvoices.length}`, sub: 'في الانتظار', color: heldInvoices.length > 0 ? 'bg-cafe/20 text-cafe' : 'bg-muted text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <div key={i} className={`p-4 rounded-lg ${c.color}`}>
            <div className="font-cairo font-bold text-sm opacity-80">{c.label}</div>
            <div className="font-cairo font-black text-2xl mt-1">{c.value}</div>
            <div className="text-xs opacity-60 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-cairo font-bold text-lg mb-3">آخر المبيعات</h3>
        <div className="space-y-2">
          {sales.slice(-10).reverse().map(sale => {
            const returnedQtys = getReturnedQtysForSale(sale.id);
            const hasReturn = Object.values(returnedQtys).some(q => q > 0);
            const returnedTotal = sale.items.reduce((sum, item) => {
              const rQty = returnedQtys[item.product.id] || 0;
              return sum + rQty * item.product.price;
            }, 0);
            const netTotal = sale.total - returnedTotal;
            const allReturned = sale.items.every(item => (returnedQtys[item.product.id] || 0) >= item.qty);

            return (
              <div key={sale.id} className={`flex items-center justify-between p-3 rounded-lg border ${allReturned ? 'bg-destructive/5 border-destructive/30' : hasReturn ? 'bg-cafe/5 border-cafe/30' : 'bg-card border-border'}`}>
                <div>
                  <span className="font-cairo font-bold text-sm">{sale.mode === 'supermarket' ? '🛒' : '☕'} فاتورة #{sale.invoiceNumber || sale.id.slice(0, 6)}</span>
                  <span className="text-xs text-muted-foreground mr-3">{sale.items.length} منتج • {sale.cashier}</span>
                  {hasReturn && (
                    <div className="text-xs font-cairo mt-1">
                      <span className="text-muted-foreground">أصل الفاتورة: <span className="line-through">{sale.total} ج.م</span></span>
                      <span className="text-destructive mr-2">مرتجع: {returnedTotal} ج.م</span>
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <div className={`font-cairo font-black ${allReturned ? 'text-destructive' : 'text-supermarket'}`}>{netTotal} ج.م</div>
                  <div className="text-xs text-muted-foreground">{sale.time} - {sale.date}</div>
                </div>
              </div>
            );
          })}
          {sales.length === 0 && (
            <div className="text-center text-muted-foreground py-8 font-cairo">لا توجد مبيعات بعد</div>
          )}
        </div>
      </div>

      {lowStock.length > 0 && (
        <div>
          <h3 className="font-cairo font-bold text-lg mb-3 text-destructive">⚠️ تنبيه نقص المخزون</h3>
          <div className="space-y-2">
            {lowStock.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                <span className="font-cairo font-bold text-sm">{p.name}</span>
                <span className="font-cairo font-black text-destructive">{p.stock} وحدة فقط</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
