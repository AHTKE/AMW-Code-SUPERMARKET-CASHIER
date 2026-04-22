import { useState, useMemo } from 'react';
import { Sale, SaleReturn, CartItem } from '@/types/pos';
import { getSales } from '@/lib/store';
import { Search, RotateCcw, Check, X, ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';

const RETURNS_KEY = 'pos_returns';

export function getReturns(): SaleReturn[] {
  try {
    const raw = localStorage.getItem(RETURNS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// Get already-returned quantities for a specific sale
export function getReturnedQtysForSale(saleId: string): Record<string, number> {
  const returns = getReturns().filter(r => r.originalSaleId === saleId);
  const map: Record<string, number> = {};
  returns.forEach(ret => {
    ret.items.forEach(item => {
      map[item.product.id] = (map[item.product.id] || 0) + item.qty;
    });
  });
  return map;
}

export function addReturn(ret: SaleReturn) {
  const returns = getReturns();
  returns.push(ret);
  localStorage.setItem(RETURNS_KEY, JSON.stringify(returns));
  
  // Restore stock
  const products = JSON.parse(localStorage.getItem('pos_products') || '[]');
  ret.items.forEach(item => {
    const p = products.find((pr: any) => pr.id === item.product.id);
    if (p) p.stock += item.qty;
  });
  localStorage.setItem('pos_products', JSON.stringify(products));
  
  return returns;
}

interface ReturnDialogProps {
  sale: Sale;
  onClose: () => void;
  onReturn: (ret: SaleReturn) => void;
  cashierName?: string;
  cashierId?: string;
}

export const ReturnDialog = ({ sale, onClose, onReturn, cashierName, cashierId }: ReturnDialogProps) => {
  const alreadyReturned = useMemo(() => getReturnedQtysForSale(sale.id), [sale.id]);
  
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    sale.items.forEach(item => { map[item.product.id] = 0; });
    return map;
  });
  const [reason, setReason] = useState('');
  const [returnAll, setReturnAll] = useState(false);

  // Calculate remaining returnable qty for each product
  const getMaxReturnable = (productId: string, originalQty: number) => {
    return Math.max(0, originalQty - (alreadyReturned[productId] || 0));
  };

  const allFullyReturned = sale.items.every(item => getMaxReturnable(item.product.id, item.qty) === 0);

  const handleReturnAll = (checked: boolean) => {
    setReturnAll(checked);
    const map: Record<string, number> = {};
    sale.items.forEach(item => {
      map[item.product.id] = checked ? getMaxReturnable(item.product.id, item.qty) : 0;
    });
    setReturnQtys(map);
  };

  const updateReturnQty = (productId: string, delta: number, originalQty: number) => {
    const maxReturnable = getMaxReturnable(productId, originalQty);
    setReturnQtys(prev => ({
      ...prev,
      [productId]: Math.max(0, Math.min(maxReturnable, (prev[productId] || 0) + delta))
    }));
    setReturnAll(false);
  };

  const returnItems: CartItem[] = sale.items
    .filter(item => (returnQtys[item.product.id] || 0) > 0)
    .map(item => ({ product: item.product, qty: returnQtys[item.product.id] }));

  const returnTotal = returnItems.reduce((sum, item) => sum + item.product.price * item.qty, 0);

  const handleSubmit = () => {
    if (returnItems.length === 0) return;
    const now = new Date();
    const ret: SaleReturn = {
      id: crypto.randomUUID(),
      originalSaleId: sale.id,
      date: now.toLocaleDateString('ar-EG'),
      time: now.toLocaleTimeString('ar-EG'),
      total: returnTotal,
      cashier: cashierName || 'المدير',
      cashierId,
      items: returnItems,
      reason: reason || 'بدون سبب',
      timestamp: now.getTime(),
    };
    onReturn(ret);
  };

  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-cairo font-black text-lg flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-destructive" />
            مرتجع فاتورة #{sale.invoiceNumber || sale.id.slice(0, 6)}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl font-bold">✕</button>
        </div>

        {allFullyReturned ? (
          <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30 text-center space-y-2">
            <div className="text-destructive font-cairo font-black text-lg">✅ تم ترجيع كل المنتجات</div>
            <p className="font-cairo text-sm text-muted-foreground">هذه الفاتورة تم إرجاع جميع منتجاتها بالكامل</p>
            <button onClick={onClose} className="mt-2 px-6 py-2 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground hover:text-foreground">إغلاق</button>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 p-2 bg-secondary rounded cursor-pointer">
              <input type="checkbox" checked={returnAll} onChange={e => handleReturnAll(e.target.checked)} className="w-4 h-4 accent-destructive" />
              <span className="font-cairo font-bold text-sm">إرجاع كل المتبقي</span>
            </label>

            <div className="space-y-2">
              {sale.items.map(item => {
                const maxReturnable = getMaxReturnable(item.product.id, item.qty);
                const alreadyReturnedQty = alreadyReturned[item.product.id] || 0;
                const fullyReturned = maxReturnable === 0;

                return (
                  <div key={item.product.id} className={`flex items-center justify-between p-3 rounded-lg ${fullyReturned ? 'bg-destructive/10 border border-destructive/20' : 'bg-secondary'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-cairo font-bold text-sm truncate flex items-center gap-2">
                        {item.product.name}
                        {fullyReturned && <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded font-cairo">تم الإرجاع ✓</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        الكمية الأصلية: {item.qty} • السعر: {item.product.price} ج.م
                        {alreadyReturnedQty > 0 && !fullyReturned && (
                          <span className="text-destructive mr-1">• مُرتجع سابقاً: {alreadyReturnedQty}</span>
                        )}
                      </div>
                    </div>
                    {!fullyReturned && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateReturnQty(item.product.id, -1, item.qty)} className="w-7 h-7 flex items-center justify-center rounded bg-muted hover:bg-accent"><Minus className="w-3 h-3" /></button>
                        <span className={`w-10 text-center font-cairo font-bold text-sm ${(returnQtys[item.product.id] || 0) > 0 ? 'text-destructive' : ''}`}>{returnQtys[item.product.id] || 0}</span>
                        <button onClick={() => updateReturnQty(item.product.id, 1, item.qty)} className="w-7 h-7 flex items-center justify-center rounded bg-muted hover:bg-accent"><Plus className="w-3 h-3" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الإرجاع..." className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-destructive" />
            
            {returnItems.length > 0 && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                <div className="flex justify-between font-cairo font-bold">
                  <span>مبلغ الإرجاع:</span>
                  <span className="text-destructive text-lg">{returnTotal} ج.م</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{returnItems.length} منتج سيتم إرجاعه</div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground hover:text-foreground transition-colors">إلغاء</button>
              <button onClick={handleSubmit} disabled={returnItems.length === 0} className="flex-1 flex items-center justify-center gap-2 py-3 rounded font-cairo font-bold text-sm bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-30 transition-opacity">
                <Check className="w-4 h-4" />تأكيد الإرجاع
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SalesReturns = () => {
  const [returns, setReturns] = useState<SaleReturn[]>(getReturns());
  const [sales] = useState<Sale[]>(getSales());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [expandedReturn, setExpandedReturn] = useState<string | null>(null);
  const [tab, setTab] = useState<'new' | 'history'>('new');

  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales.slice().reverse().slice(0, 20);
    const q = searchQuery.trim().toLowerCase();
    return sales.filter(s =>
      s.id.includes(q) ||
      s.cashier.includes(q) ||
      s.items.some(item => item.product.name.includes(q))
    ).reverse();
  }, [sales, searchQuery]);

  const handleReturn = (ret: SaleReturn) => {
    const updated = addReturn(ret);
    setReturns(updated);
    setSelectedSale(null);
  };

  const totalReturns = returns.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setTab('new')}
          className={`flex items-center gap-2 px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${
            tab === 'new' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          عمل مرتجع
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${
            tab === 'history' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          سجل المرتجعات ({returns.length})
        </button>
      </div>

      {tab === 'new' && (
        <div className="space-y-3">
          <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
            <div className="font-cairo font-bold text-sm text-destructive">إجمالي المرتجعات: {totalReturns} ج.م</div>
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الفاتورة أو اسم المنتج..."
              className="w-full h-10 pr-10 pl-4 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
            />
          </div>

          <div className="space-y-2">
            {filteredSales.map(sale => {
              const returnedQtys = getReturnedQtysForSale(sale.id);
              const allReturned = sale.items.every(item => (returnedQtys[item.product.id] || 0) >= item.qty);
              const hasPartialReturn = Object.values(returnedQtys).some(q => q > 0);

              return (
                <div key={sale.id} className={`flex items-center justify-between p-3 rounded-lg border ${allReturned ? 'bg-destructive/5 border-destructive/30' : hasPartialReturn ? 'bg-cafe/5 border-cafe/30' : 'bg-card border-border'}`}>
                  <div>
                    <span className="font-cairo font-bold text-sm">
                      {sale.mode === 'supermarket' ? '🛒' : '☕'} #{sale.invoiceNumber || sale.id.slice(0, 6)}
                      {allReturned && <span className="text-destructive text-xs mr-2">✅ مُرتجع بالكامل</span>}
                      {hasPartialReturn && !allReturned && <span className="text-cafe text-xs mr-2">⚠️ مرتجع جزئي</span>}
                    </span>
                    <span className="text-xs text-muted-foreground mr-2">{sale.items.length} منتج • {sale.cashier}</span>
                    <div className="text-xs text-muted-foreground">{sale.date} {sale.time}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-cairo font-black text-supermarket">{sale.total} ج.م</span>
                    {!allReturned && (
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-destructive text-destructive-foreground rounded font-cairo font-bold text-xs hover:opacity-90"
                      >
                        <RotateCcw className="w-3 h-3" />
                        مرتجع
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredSales.length === 0 && (
              <div className="text-center text-muted-foreground py-8 font-cairo">لا توجد فواتير</div>
            )}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          {returns.slice().reverse().map(ret => (
            <div key={ret.id} className="bg-card rounded-lg border border-destructive/30 overflow-hidden">
              <button
                onClick={() => setExpandedReturn(expandedReturn === ret.id ? null : ret.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors"
              >
                <div className="text-right">
                  <span className="font-cairo font-bold text-sm text-destructive">مرتجع #{ret.id.slice(0, 6)}</span>
                  <div className="text-xs text-muted-foreground">فاتورة أصلية: #{ret.originalSaleId.slice(0, 6)} • {ret.reason}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-left">
                    <div className="font-cairo font-black text-destructive">-{ret.total} ج.م</div>
                    <div className="text-xs text-muted-foreground">{ret.date} {ret.time}</div>
                  </div>
                  {expandedReturn === ret.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              {expandedReturn === ret.id && (
                <div className="border-t border-border p-3 bg-secondary/30">
                  {ret.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between font-cairo text-sm py-1">
                      <span>{item.product.name} × {item.qty}</span>
                      <span className="text-destructive">-{item.product.price * item.qty} ج.م</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {returns.length === 0 && (
            <div className="text-center text-muted-foreground py-8 font-cairo">لا توجد مرتجعات</div>
          )}
        </div>
      )}

      {selectedSale && (
        <ReturnDialog
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onReturn={handleReturn}
        />
      )}
    </div>
  );
};

export default SalesReturns;
