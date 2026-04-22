import { useState, useMemo } from 'react';
import { getSales } from '@/lib/store';
import { ChevronDown, ChevronUp, FileDown, Calendar, RotateCcw } from 'lucide-react';
import { exportToPDF } from '@/lib/pdfExport';
import { Sale, SaleReturn, CartItem } from '@/types/pos';
import { addReturn, getReturns, getReturnedQtysForSale, ReturnDialog } from './SalesReturns';

const SalesReport = () => {
  const sales = getSales();
  const returns = getReturns();
  const [filter, setFilter] = useState<'today' | 'week' | 'month' | 'custom' | 'all'>('today');
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  const filtered = useMemo(() => {
    // If searching by invoice number, bypass date filter
    if (invoiceSearch.trim()) {
      const q = invoiceSearch.trim();
      return sales.filter(s => (s.invoiceNumber || s.id.slice(0, 7)).includes(q));
    }
    const now = Date.now();
    const day = 86400000;
    switch (filter) {
      case 'today': {
        const today = new Date().toLocaleDateString('ar-EG');
        return sales.filter(s => s.date === today);
      }
      case 'week':
        return sales.filter(s => s.timestamp && s.timestamp > now - 7 * day);
      case 'month':
        return sales.filter(s => s.timestamp && s.timestamp > now - 30 * day);
      case 'custom': {
        const from = dateFrom ? new Date(dateFrom).getTime() : 0;
        const to = dateTo ? new Date(dateTo).getTime() + day : Infinity;
        return sales.filter(s => s.timestamp >= from && s.timestamp <= to);
      }
      default:
        return sales;
    }
  }, [sales, filter, dateFrom, dateTo, invoiceSearch]);

  // Calculate returns for filtered sales
  const filteredReturnsTotal = useMemo(() => {
    return filtered.reduce((sum, sale) => {
      const returnedQtys = getReturnedQtysForSale(sale.id);
      return sum + sale.items.reduce((s, item) => {
        const rQty = returnedQtys[item.product.id] || 0;
        return s + rQty * item.product.price;
      }, 0);
    }, 0);
  }, [filtered]);

  const total = filtered.reduce((s, sale) => s + sale.total, 0);
  const totalNet = total - filteredReturnsTotal;
  const totalDiscount = filtered.reduce((s, sale) => s + (sale.discount?.amount || 0), 0);
  const supermarketTotal = filtered.filter(s => s.mode === 'supermarket').reduce((s, sale) => s + sale.total, 0);
  const cafeTotal = filtered.filter(s => s.mode === 'cafe').reduce((s, sale) => s + sale.total, 0);

  const productCounts: Record<string, { name: string; count: number; revenue: number }> = {};
  filtered.forEach(sale => {
    sale.items.forEach(item => {
      if (!productCounts[item.product.id]) {
        productCounts[item.product.id] = { name: item.product.name, count: 0, revenue: 0 };
      }
      productCounts[item.product.id].count += item.qty;
      productCounts[item.product.id].revenue += item.qty * item.product.price;
    });
  });
  const bestSelling = Object.values(productCounts).sort((a, b) => b.count - a.count).slice(0, 10);

  const filters: { id: typeof filter; label: string }[] = [
    { id: 'today', label: 'اليوم' },
    { id: 'week', label: 'الأسبوع' },
    { id: 'month', label: 'الشهر' },
    { id: 'custom', label: 'فترة مخصصة' },
    { id: 'all', label: 'الكل' },
  ];

  const handleExportPDF = () => {
    const dateRange = filter === 'custom' && dateFrom && dateTo
      ? `${dateFrom} إلى ${dateTo}`
      : filters.find(f => f.id === filter)?.label || '';

    exportToPDF({
      title: 'تقرير المبيعات',
      subtitle: `${filtered.length} فاتورة`,
      dateRange,
      summary: [
        { label: 'إجمالي المبيعات', value: `${total} ج.م` },
        { label: 'سوبرماركت', value: `${supermarketTotal} ج.م` },
        { label: 'كافيه', value: `${cafeTotal} ج.م` },
        { label: 'عدد الفواتير', value: `${filtered.length}` },
        ...(totalDiscount > 0 ? [{ label: 'إجمالي الخصومات', value: `${totalDiscount} ج.م` }] : []),
      ],
      headers: ['#', 'رقم الفاتورة', 'النوع', 'الكاشير', 'المنتجات', 'خصم', 'الإجمالي', 'التاريخ', 'الوقت'],
      rows: filtered.slice().reverse().map((sale, i) => [
        String(i + 1),
        `#${sale.invoiceNumber || sale.id.slice(0, 7)}`,
        sale.mode === 'supermarket' ? 'سوبرماركت' : 'كافيه',
        sale.cashier,
        sale.items.map(it => `${it.product.name} (${it.qty})`).join(', '),
        sale.discount ? `${sale.discount.type === 'percent' ? sale.discount.value + '%' : sale.discount.amount + ' ج.م'}` : '-',
        `${sale.total} ج.م`,
        sale.date,
        sale.time,
      ]),
    });
  };

  const handleReturn = (ret: SaleReturn) => {
    addReturn(ret);
    setReturnSale(null);
  };

  return (
    <div className="space-y-4">
      {/* Invoice search */}
      <div className="relative">
        <input
          value={invoiceSearch}
          onChange={e => setInvoiceSearch(e.target.value)}
          placeholder="🔍 بحث برقم الفاتورة..."
          className="w-full h-10 px-4 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setInvoiceSearch(''); }}
            className={`px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${
              filter === f.id && !invoiceSearch ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={handleExportPDF}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-cafe text-cafe-foreground rounded font-cairo font-bold text-sm hover:opacity-90 disabled:opacity-30 transition-opacity mr-auto"
        >
          <FileDown className="w-4 h-4" />
          تصدير PDF
        </button>
      </div>

      {/* Custom date range */}
      {filter === 'custom' && (
        <div className="flex gap-3 items-center bg-card p-3 rounded-lg border border-border">
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
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-card rounded-lg border border-border">
          <div className="font-cairo text-sm text-muted-foreground">إجمالي (قبل المرتجع)</div>
          <div className="font-cairo font-black text-xl text-foreground">{total} ج.م</div>
          <div className="text-xs text-muted-foreground">{filtered.length} فاتورة</div>
        </div>
        {filteredReturnsTotal > 0 && (
          <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30">
            <div className="font-cairo text-sm text-destructive">🔄 المرتجعات</div>
            <div className="font-cairo font-black text-xl text-destructive">-{filteredReturnsTotal} ج.م</div>
          </div>
        )}
        <div className="p-4 bg-success/10 rounded-lg border border-success/30">
          <div className="font-cairo text-sm text-success">💰 صافي المبيعات</div>
          <div className="font-cairo font-black text-xl text-success">{totalNet} ج.م</div>
          <div className="text-xs text-muted-foreground">بعد خصم المرتجعات</div>
        </div>
        <div className="p-4 bg-supermarket/10 rounded-lg border border-supermarket/30">
          <div className="font-cairo text-sm text-supermarket">🛒 سوبرماركت</div>
          <div className="font-cairo font-black text-xl text-supermarket">{supermarketTotal} ج.م</div>
        </div>
        <div className="p-4 bg-cafe/10 rounded-lg border border-cafe/30">
          <div className="font-cairo text-sm text-cafe">☕ كافيه</div>
          <div className="font-cairo font-black text-xl text-cafe">{cafeTotal} ج.م</div>
        </div>
        {totalDiscount > 0 && (
          <div className="p-4 bg-success/10 rounded-lg border border-success/30">
            <div className="font-cairo text-sm text-success">💰 إجمالي الخصومات</div>
            <div className="font-cairo font-black text-xl text-success">{totalDiscount} ج.م</div>
          </div>
        )}
      </div>

      {/* Best selling */}
      {bestSelling.length > 0 && (
        <div>
          <h3 className="font-cairo font-bold mb-2">🏆 الأكثر مبيعاً</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {bestSelling.map((p, i) => (
              <div key={i} className="p-3 bg-card rounded border border-border text-center">
                <div className="font-cairo font-bold text-sm">{p.name}</div>
                <div className="font-cairo font-black text-supermarket">{p.count} وحدة</div>
                <div className="text-xs text-muted-foreground">{p.revenue} ج.م</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales list */}
      <div>
        <h3 className="font-cairo font-bold mb-2">الفواتير</h3>
        <div className="space-y-2">
          {filtered.slice().reverse().map(sale => {
            const returnedQtys = getReturnedQtysForSale(sale.id);
            const allReturned = sale.items.every(item => (returnedQtys[item.product.id] || 0) >= item.qty);
            const hasPartialReturn = Object.values(returnedQtys).some(q => q > 0);

            return (
              <div key={sale.id} className={`rounded-lg border overflow-hidden ${allReturned ? 'bg-destructive/5 border-destructive/30' : hasPartialReturn ? 'bg-cafe/5 border-cafe/30' : 'bg-card border-border'}`}>
                <button
                  onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span>{sale.mode === 'supermarket' ? '🛒' : '☕'}</span>
                    <span className="font-cairo font-bold text-sm">#{sale.invoiceNumber || sale.id.slice(0, 6)}</span>
                    <span className="text-xs text-muted-foreground">{sale.cashier}</span>
                    {allReturned && <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded font-cairo font-bold">مُرتجع بالكامل ✓</span>}
                    {hasPartialReturn && !allReturned && <span className="text-xs bg-cafe/20 text-cafe px-1.5 py-0.5 rounded font-cairo font-bold">مرتجع جزئي</span>}
                    {sale.discount && (
                      <span className="text-xs bg-success/20 text-success px-1.5 py-0.5 rounded font-cairo font-bold">
                        خصم {sale.discount.type === 'percent' ? `${sale.discount.value}%` : `${sale.discount.amount} ج.م`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      {hasPartialReturn && !allReturned ? (
                        <>
                          <div className="font-cairo text-xs text-muted-foreground line-through">{sale.total} ج.م</div>
                          <div className="font-cairo font-black text-supermarket">
                            {sale.total - sale.items.reduce((s, item) => s + (returnedQtys[item.product.id] || 0) * item.product.price, 0)} ج.م
                          </div>
                        </>
                      ) : allReturned ? (
                        <div className="font-cairo font-black text-destructive line-through">{sale.total} ج.م</div>
                      ) : (
                        <div className="font-cairo font-black text-supermarket">{sale.total} ج.م</div>
                      )}
                      <div className="text-xs text-muted-foreground">{sale.time}</div>
                    </div>
                    {expandedSale === sale.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {expandedSale === sale.id && (
                  <div className="border-t border-border p-3 bg-secondary/30">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-right font-cairo py-1">المنتج</th>
                          <th className="text-center font-cairo py-1">العدد</th>
                          <th className="text-center font-cairo py-1">السعر</th>
                          <th className="text-center font-cairo py-1">مُرتجع</th>
                          <th className="text-left font-cairo py-1">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.items.map((item, idx) => {
                          const returnedQty = returnedQtys[item.product.id] || 0;
                          return (
                            <tr key={idx} className={`border-t border-border/50 ${returnedQty >= item.qty ? 'text-destructive line-through opacity-60' : ''}`}>
                              <td className="py-1 font-cairo">{item.product.name}</td>
                              <td className="py-1 text-center">{item.qty}</td>
                              <td className="py-1 text-center">{item.product.price} ج.م</td>
                              <td className="py-1 text-center">
                                {returnedQty > 0 ? (
                                  <span className="text-destructive font-bold">{returnedQty}</span>
                                ) : '-'}
                              </td>
                              <td className="py-1 text-left font-bold">{(item.qty - returnedQty) * item.product.price} ج.م</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {/* Return summary */}
                    {hasPartialReturn && (
                      <div className="mt-2 p-2 bg-destructive/10 rounded text-sm font-cairo space-y-1">
                        <div className="text-muted-foreground">أصل الفاتورة: <span className="font-bold">{sale.total} ج.م</span></div>
                        <div className="text-destructive font-bold">المرتجع: -{sale.items.reduce((s, item) => s + (returnedQtys[item.product.id] || 0) * item.product.price, 0)} ج.م</div>
                        <div className="text-success font-black">الناتج النهائي: {sale.total - sale.items.reduce((s, item) => s + (returnedQtys[item.product.id] || 0) * item.product.price, 0)} ج.م</div>
                      </div>
                    )}
                    {sale.discount && (
                      <div className="mt-2 p-2 bg-success/10 rounded text-sm font-cairo text-success font-bold">
                        خصم: {sale.discount.type === 'percent' ? `${sale.discount.value}%` : `${sale.discount.amount} ج.م`} (-{sale.discount.amount} ج.م)
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      {!allReturned && (
                        <button
                          onClick={() => setReturnSale(sale)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-destructive text-destructive-foreground rounded font-cairo font-bold text-xs hover:opacity-90"
                        >
                          <RotateCcw className="w-3 h-3" />
                          مرتجع
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground py-8 font-cairo">لا توجد مبيعات في هذه الفترة</div>
          )}
        </div>
      </div>

      {/* Return dialog */}
      {returnSale && (
        <ReturnDialog
          sale={returnSale}
          onClose={() => setReturnSale(null)}
          onReturn={handleReturn}
        />
      )}
    </div>
  );
};

export default SalesReport;
