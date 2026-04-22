import { useState } from 'react';
import { getProducts } from '@/lib/store';
import { AlertTriangle, CheckCircle, Search, FileDown } from 'lucide-react';
import { exportToPDF } from '@/lib/pdfExport';

const InventoryView = () => {
  const products = getProducts();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'stock-asc' | 'stock-desc' | 'name'>('stock-asc');

  const filtered = products
    .filter(p => !search || p.name.includes(search) || p.barcode?.includes(search))
    .sort((a, b) => {
      if (sortBy === 'stock-asc') return a.stock - b.stock;
      if (sortBy === 'stock-desc') return b.stock - a.stock;
      return a.name.localeCompare(b.name, 'ar');
    });

  const totalValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const totalCostValue = products.reduce((s, p) => s + (p.costPrice || 0) * p.stock, 0);
  const lowStock = products.filter(p => p.stock < 10);
  const outOfStock = products.filter(p => p.stock === 0);

  const handleExportPDF = () => {
    exportToPDF({
      title: 'تقرير المخزون',
      subtitle: `${products.length} منتج`,
      summary: [
        { label: 'إجمالي المنتجات', value: `${products.length}` },
        { label: 'قيمة المخزون (بيع)', value: `${totalValue} ج.م` },
        { label: 'قيمة المخزون (تكلفة)', value: `${totalCostValue} ج.م` },
        { label: 'نقص مخزون', value: `${lowStock.length}` },
        { label: 'نفد', value: `${outOfStock.length}` },
      ],
      headers: ['#', 'المنتج', 'الباركود', 'النوع', 'التصنيف', 'سعر البيع', 'سعر التكلفة', 'المخزون', 'الحالة'],
      rows: filtered.map((p, i) => [
        String(i + 1),
        p.name,
        p.barcode || '-',
        p.type === 'supermarket' ? 'سوبرماركت' : 'كافيه',
        p.category,
        `${p.price} ج.م`,
        p.costPrice ? `${p.costPrice} ج.م` : '-',
        String(p.stock),
        p.stock === 0 ? '⛔ نفد' : p.stock < 10 ? '⚠️ نقص' : '✅ متوفر',
      ]),
    });
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-card rounded-lg border border-border">
          <div className="font-cairo text-sm text-muted-foreground">إجمالي المنتجات</div>
          <div className="font-cairo font-black text-xl">{products.length}</div>
        </div>
        <div className="p-4 bg-card rounded-lg border border-border">
          <div className="font-cairo text-sm text-muted-foreground">قيمة المخزون (بيع)</div>
          <div className="font-cairo font-black text-xl text-supermarket">{totalValue} ج.م</div>
        </div>
        <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30">
          <div className="font-cairo text-sm text-destructive">نقص مخزون</div>
          <div className="font-cairo font-black text-xl text-destructive">{lowStock.length}</div>
        </div>
        <div className="p-4 bg-destructive/20 rounded-lg border border-destructive/30">
          <div className="font-cairo text-sm text-destructive">نفد من المخزن</div>
          <div className="font-cairo font-black text-xl text-destructive">{outOfStock.length}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث..."
            className="w-full h-10 pr-10 pl-4 bg-secondary rounded font-tajawal text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-supermarket"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none"
        >
          <option value="stock-asc">المخزون (أقل أولاً)</option>
          <option value="stock-desc">المخزون (أكثر أولاً)</option>
          <option value="name">الاسم</option>
        </select>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-4 py-2 bg-cafe text-cafe-foreground rounded font-cairo font-bold text-sm hover:opacity-90"
        >
          <FileDown className="w-4 h-4" />
          تصدير PDF
        </button>
      </div>

      {/* Inventory list */}
      <div className="space-y-1">
        {filtered.map(p => (
          <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border ${
            p.stock === 0 ? 'bg-destructive/10 border-destructive/30' :
            p.stock < 10 ? 'bg-supermarket/10 border-supermarket/30' :
            'bg-card border-border'
          }`}>
            <div className="flex items-center gap-3">
              {p.stock === 0 ? <AlertTriangle className="w-4 h-4 text-destructive" /> :
               p.stock < 10 ? <AlertTriangle className="w-4 h-4 text-supermarket" /> :
               <CheckCircle className="w-4 h-4 text-success" />}
              <div>
                <div className="font-cairo font-bold text-sm">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.category} • {p.type === 'supermarket' ? '🛒' : '☕'}
                  {p.barcode && <span className="font-mono mr-2">{p.barcode}</span>}
                </div>
              </div>
            </div>
            <div className="text-left">
              <div className={`font-cairo font-black ${
                p.stock === 0 ? 'text-destructive' : p.stock < 10 ? 'text-supermarket' : 'text-success'
              }`}>{p.stock} وحدة</div>
              <div className="text-xs text-muted-foreground">{p.price} ج.م</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InventoryView;
