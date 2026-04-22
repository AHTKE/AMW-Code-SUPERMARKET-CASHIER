import { useState } from 'react';
import { CartItem } from '@/types/pos';
import { Trash2, Plus, Minus, AlertTriangle, Percent, DollarSign, Pause, Play, TicketPercent, KeyRound } from 'lucide-react';
import { holdInvoice, getHeldInvoices, recallInvoice, HeldInvoice } from '@/lib/holdInvoice';
import { resolveCouponDiscount, getOfferForProduct } from '@/lib/coupons';
import { DiscountInfo, calculateDiscountAmount, getDiscountBaseSubtotal } from '@/lib/discounts';

interface InvoicePanelProps {
  items: CartItem[];
  onUpdateQty: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClear: () => void;
  onPay: (discount?: DiscountInfo) => void;
  cashierId?: string;
  cashierName?: string;
  onRecallInvoice?: (items: CartItem[], discount?: DiscountInfo) => void;
  canReturn?: boolean;
  canDiscount?: boolean;
  canHold?: boolean;
}

const InvoicePanel = ({ items, onUpdateQty, onRemoveItem, onClear, onPay, cashierId, cashierName, onRecallInvoice, canReturn, canDiscount, canHold }: InvoicePanelProps) => {
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [discount, setDiscount] = useState<DiscountInfo | null>(null);
  const [showDiscountDialog, setShowDiscountDialog] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponPassword, setCouponPassword] = useState('');
  const [couponError, setCouponError] = useState('');
  const [showHeldList, setShowHeldList] = useState(false);
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>(getHeldInvoices());
  const [holdNote, setHoldNote] = useState('');
  const [showHoldDialog, setShowHoldDialog] = useState(false);

  const discountAmount = calculateDiscountAmount(items, discount || undefined);
  const discountBaseSubtotal = getDiscountBaseSubtotal(items, discount || undefined);
  const total = Math.max(0, subtotal - discountAmount);

  const handleClearClick = () => {
    if (items.length === 0) return;
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    onClear();
    setDiscount(null);
    setShowClearConfirm(false);
  };

  const applyDiscount = () => {
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) return;
    if (discountType === 'percent' && val > 100) return;

    setDiscount({ type: discountType, value: val, source: 'manual' });
    setShowDiscountDialog(false);
    setDiscountValue('');
  };

  const applyCoupon = () => {
    const result = resolveCouponDiscount(couponCode, couponPassword, items);
    if (!result.success || !result.discount) {
      setCouponError(result.message);
      return;
    }

    setDiscount(result.discount);
    setShowCouponDialog(false);
    setCouponCode('');
    setCouponPassword('');
    setCouponError('');
  };

  const handleHold = () => {
    if (items.length === 0) return;
    const invoice: HeldInvoice = {
      id: crypto.randomUUID(),
      items: [...items],
      cashierId,
      cashierName,
      heldAt: Date.now(),
      note: holdNote || undefined,
      discount: discount || undefined,
    };
    const updated = holdInvoice(invoice);
    setHeldInvoices(updated);
    onClear();
    setDiscount(null);
    setHoldNote('');
    setShowHoldDialog(false);
  };

  const handleRecall = (id: string) => {
    const invoice = recallInvoice(id);
    if (invoice && onRecallInvoice) {
      onRecallInvoice(invoice.items, invoice.discount || undefined);
      if (invoice.discount) setDiscount(invoice.discount);
    }
    setHeldInvoices(getHeldInvoices());
    setShowHeldList(false);
  };

  const handlePay = () => {
    onPay(discount || undefined);
    setDiscount(null);
  };

  const showQuickActions = canDiscount || canHold;

  return (
    <div className="flex flex-col h-full bg-card border-r border-border relative">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <h2 className="font-cairo font-bold text-lg">الفاتورة</h2>
        {canHold && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setHeldInvoices(getHeldInvoices()); setShowHeldList(true); }}
              className="relative p-1.5 rounded hover:bg-secondary transition-colors"
              title="الفواتير المعلقة"
            >
              <Pause className="w-4 h-4 text-muted-foreground" />
              {heldInvoices.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[10px] flex items-center justify-center font-bold">
                  {heldInvoices.length}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.length === 0 && (
          <div className="text-muted-foreground text-center py-8 text-sm">
            لا توجد منتجات
          </div>
        )}
        {items.map((item, index) => {
          const offer = getOfferForProduct(item.product.id);
          // item.product.price is ALREADY the discounted price (set in addToCart)
          // Calculate original price by reversing the discount
          const originalPrice = offer
            ? offer.discountType === 'percent'
              ? Math.round(item.product.price / (1 - offer.discountValue / 100))
              : item.product.price + offer.discountValue
            : null;
          return (
            <div key={item.product.id} className={`rounded p-2 text-sm ${offer ? 'bg-success/10 border border-success/20' : 'bg-secondary'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-muted-foreground text-xs">{index + 1}</span>
                  <span className="font-cairo font-semibold truncate">{item.product.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => onUpdateQty(item.product.id, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-muted hover:bg-destructive hover:text-destructive-foreground transition-colors">
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center font-cairo font-bold">{item.qty}</span>
                  <button onClick={() => onUpdateQty(item.product.id, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-muted hover:bg-success hover:text-success-foreground transition-colors">
                    <Plus className="w-3 h-3" />
                  </button>
                  <span className="w-16 text-left font-cairo font-bold text-sm">
                    {item.product.price * item.qty} ج.م
                  </span>
                  <button onClick={() => onRemoveItem(item.product.id)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive hover:text-destructive-foreground transition-colors text-muted-foreground">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {offer && originalPrice !== null && (
                <div className="flex items-center gap-2 pr-6 mt-1 font-cairo text-[11px]">
                  <span className="text-success font-bold">🎁 عرض!</span>
                  <span className="text-muted-foreground">بدلاً من</span>
                  <span className="line-through text-muted-foreground">{originalPrice} ج.م</span>
                  <span className="text-success font-black">{item.product.price} ج.م</span>
                  <span className="text-muted-foreground">
                    ({offer.discountType === 'percent' ? `خصم ${offer.discountValue}%` : `خصم ${offer.discountValue} ج.م`})
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-2">
        {/* Discount display */}
        {discount && (
          <div className="space-y-1">
            <div className="flex items-center justify-between bg-success/10 rounded p-2 text-sm">
              <div className="flex items-center gap-2">
                <Percent className="w-3.5 h-3.5 text-success" />
                <span className="font-cairo font-bold text-success text-xs">
                  {discount.source === 'coupon'
                    ? `قسيمة ${discount.couponCode || ''}`
                    : `خصم ${discount.type === 'percent' ? `${discount.value}%` : `${discount.value} ج.م`}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-cairo font-bold text-success text-xs">-{discountAmount} ج.م</span>
                <button onClick={() => setDiscount(null)} className="text-destructive hover:bg-destructive/20 rounded p-0.5">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            {discount.appliesToProductId && (
              <div className="font-cairo text-[10px] text-muted-foreground px-1">
                الخصم مطبق على منتج محدد في الفاتورة
              </div>
            )}
          </div>
        )}

        {/* Subtotal + Total */}
        {discount && (
          <div className="space-y-1">
            <div className="flex items-center justify-between font-cairo text-xs text-muted-foreground">
              <span>المجموع قبل الخصم</span>
              <span>{subtotal} ج.م</span>
            </div>
            {discountBaseSubtotal > 0 && discountBaseSubtotal !== subtotal && (
              <div className="flex items-center justify-between font-cairo text-xs text-muted-foreground">
                <span>المبلغ المؤهل للخصم</span>
                <span>{discountBaseSubtotal} ج.م</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between font-cairo">
          <span className="text-lg font-bold">الإجمالي</span>
          <span className="text-2xl font-black">{total} ج.م</span>
        </div>

        {/* Quick actions row - only show if permissions allow */}
        {showQuickActions && (
          <div className="flex flex-wrap gap-1">
            {canDiscount && (
              <>
                <button
                  onClick={() => setShowDiscountDialog(true)}
                  disabled={items.length === 0}
                  className="flex-1 min-w-[30%] py-1.5 rounded font-cairo font-bold text-xs bg-success/20 text-success hover:bg-success/30 disabled:opacity-30 transition-colors flex items-center justify-center gap-1"
                >
                  <Percent className="w-3 h-3" />
                  خصم
                </button>
                <button
                  onClick={() => {
                    setCouponCode('');
                    setCouponPassword('');
                    setCouponError('');
                    setShowCouponDialog(true);
                  }}
                  disabled={items.length === 0}
                  className="flex-1 min-w-[30%] py-1.5 rounded font-cairo font-bold text-xs bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-30 transition-colors flex items-center justify-center gap-1"
                >
                  <TicketPercent className="w-3 h-3" />
                  قسيمة
                </button>
              </>
            )}
            {canHold && (
              <>
                <button
                  onClick={() => { setHoldNote(''); setShowHoldDialog(true); }}
                  disabled={items.length === 0}
                  className="flex-1 min-w-[30%] py-1.5 rounded font-cairo font-bold text-xs bg-cafe/20 text-cafe hover:bg-cafe/30 disabled:opacity-30 transition-colors flex items-center justify-center gap-1"
                >
                  <Pause className="w-3 h-3" />
                  تعليق
                </button>
                <button
                  onClick={() => { setHeldInvoices(getHeldInvoices()); setShowHeldList(true); }}
                  className="flex-1 min-w-[30%] py-1.5 rounded font-cairo font-bold text-xs bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center justify-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  استرجاع
                  {heldInvoices.length > 0 && <span className="bg-destructive text-destructive-foreground rounded-full px-1.5 text-[10px]">{heldInvoices.length}</span>}
                </button>
              </>
            )}
          </div>
        )}

        {/* Main actions */}
        <div className="flex gap-2">
          <button
            onClick={handlePay}
            disabled={items.length === 0}
            className="flex-1 py-3 rounded font-cairo font-bold text-lg bg-success text-success-foreground hover:opacity-90 disabled:opacity-30 transition-opacity active:scale-[0.98]"
          >
            💳 دفع
          </button>
          <button
            onClick={handleClearClick}
            disabled={items.length === 0}
            className="px-4 py-3 rounded font-cairo font-bold bg-destructive text-destructive-foreground hover:opacity-90 disabled:opacity-30 transition-opacity active:scale-[0.98]"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Clear confirmation */}
      {showClearConfirm && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 p-4">
          <div className="bg-card rounded-xl border border-border p-5 w-full max-w-xs space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-cairo font-black text-base">مسح الفاتورة؟</h3>
              <p className="font-cairo text-xs text-muted-foreground">سيتم حذف جميع المنتجات ({items.length} منتج)</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2.5 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground hover:text-foreground transition-colors">إلغاء</button>
              <button onClick={confirmClear} className="flex-1 py-2.5 rounded font-cairo font-bold text-sm bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity">تأكيد المسح</button>
            </div>
          </div>
        </div>
      )}

      {/* Discount dialog */}
      {showDiscountDialog && canDiscount && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 p-4">
          <div className="bg-card rounded-xl border border-border p-5 w-full max-w-xs space-y-4">
            <h3 className="font-cairo font-black text-base text-center">إضافة خصم</h3>
            <div className="flex gap-2">
              <button onClick={() => setDiscountType('percent')} className={`flex-1 py-2 rounded font-cairo font-bold text-sm flex items-center justify-center gap-1 ${discountType === 'percent' ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'}`}>
                <Percent className="w-3 h-3" /> نسبة %
              </button>
              <button onClick={() => setDiscountType('fixed')} className={`flex-1 py-2 rounded font-cairo font-bold text-sm flex items-center justify-center gap-1 ${discountType === 'fixed' ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'}`}>
                <DollarSign className="w-3 h-3" /> مبلغ ثابت
              </button>
            </div>
            <input
              type="number"
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percent' ? 'مثال: 10' : 'مثال: 50'}
              className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm text-center focus:outline-none focus:ring-2 focus:ring-success"
              autoFocus
              min="0"
              max={discountType === 'percent' ? '100' : undefined}
            />
            {discountValue && !isNaN(parseFloat(discountValue)) && parseFloat(discountValue) > 0 && (
              <div className="text-center font-cairo text-sm text-success">
                سيتم خصم: {discountType === 'percent' ? Math.round(subtotal * parseFloat(discountValue) / 100) : Math.min(parseFloat(discountValue), subtotal)} ج.م
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowDiscountDialog(false)} className="flex-1 py-2.5 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground">إلغاء</button>
              <button onClick={applyDiscount} className="flex-1 py-2.5 rounded font-cairo font-bold text-sm bg-success text-success-foreground hover:opacity-90">تطبيق الخصم</button>
            </div>
          </div>
        </div>
      )}

      {/* Coupon dialog */}
      {showCouponDialog && canDiscount && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 p-4">
          <div className="bg-card rounded-xl border border-border p-5 w-full max-w-xs space-y-4">
            <h3 className="font-cairo font-black text-base text-center">تطبيق قسيمة</h3>
            <div>
              <label className="font-cairo text-xs text-muted-foreground block mb-1">كود القسيمة</label>
              <input
                value={couponCode}
                onChange={e => { setCouponCode(e.target.value); setCouponError(''); }}
                className="w-full h-10 px-3 bg-secondary rounded font-mono text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="مثال: SAVE20"
                autoFocus
              />
            </div>
            <div>
              <label className="font-cairo text-xs text-muted-foreground block mb-1 flex items-center gap-1">
                <KeyRound className="w-3 h-3" />
                كلمة مرور القسيمة
              </label>
              <input
                type="password"
                value={couponPassword}
                onChange={e => { setCouponPassword(e.target.value); setCouponError(''); }}
                className="w-full h-10 px-3 bg-secondary rounded font-mono text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="إن وجدت"
              />
            </div>

            {couponError && (
              <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 border border-destructive/30 text-destructive text-xs font-cairo">
                <AlertTriangle className="w-3 h-3" />
                {couponError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowCouponDialog(false)}
                className="flex-1 py-2.5 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground"
              >
                إلغاء
              </button>
              <button
                onClick={applyCoupon}
                className="flex-1 py-2.5 rounded font-cairo font-bold text-sm bg-primary text-primary-foreground hover:opacity-90"
              >
                تطبيق القسيمة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hold dialog */}
      {showHoldDialog && canHold && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 p-4">
          <div className="bg-card rounded-xl border border-border p-5 w-full max-w-xs space-y-4">
            <h3 className="font-cairo font-black text-base text-center">تعليق الفاتورة</h3>
            <p className="font-cairo text-xs text-muted-foreground text-center">سيتم حفظ الفاتورة ({items.length} منتج - {total} ج.م) ويمكنك استرجاعها لاحقاً</p>
            <input
              value={holdNote}
              onChange={e => setHoldNote(e.target.value)}
              placeholder="ملاحظة (اختياري) مثل: اسم العميل"
              className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-cafe"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowHoldDialog(false)} className="flex-1 py-2.5 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground">إلغاء</button>
              <button onClick={handleHold} className="flex-1 py-2.5 rounded font-cairo font-bold text-sm bg-cafe text-cafe-foreground hover:opacity-90">تعليق</button>
            </div>
          </div>
        </div>
      )}

      {/* Held invoices list */}
      {showHeldList && canHold && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 p-4">
          <div className="bg-card rounded-xl border border-border p-5 w-full max-w-sm space-y-3 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-cairo font-black text-base">الفواتير المعلقة ({heldInvoices.length})</h3>
              <button onClick={() => setShowHeldList(false)} className="text-muted-foreground hover:text-foreground text-lg font-bold">✕</button>
            </div>
            {heldInvoices.length === 0 && (
              <div className="text-center text-muted-foreground py-6 font-cairo text-sm">لا توجد فواتير معلقة</div>
            )}
            {heldInvoices.map(inv => (
              <div key={inv.id} className="p-3 bg-secondary rounded-lg space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-cairo font-bold text-sm">{inv.items.length} منتج</div>
                    {inv.note && <div className="font-cairo text-xs text-muted-foreground">📝 {inv.note}</div>}
                    <div className="font-cairo text-xs text-muted-foreground">
                      {new Date(inv.heldAt).toLocaleString('ar-EG')}
                    </div>
                  </div>
                  <span className="font-cairo font-black text-sm">
                    {inv.items.reduce((s, i) => s + i.product.price * i.qty, 0)} ج.م
                  </span>
                </div>
                <button
                  onClick={() => handleRecall(inv.id)}
                  className="w-full py-2 rounded font-cairo font-bold text-xs bg-supermarket text-supermarket-foreground hover:opacity-90 flex items-center justify-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  استرجاع الفاتورة
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicePanel;
