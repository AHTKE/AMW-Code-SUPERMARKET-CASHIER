import { useState } from 'react';
import { Coupon, ProductOffer, getCoupons, addCoupon, deleteCoupon, updateCoupon, getOffers, addOffer, deleteOffer } from '@/lib/coupons';
import { getProducts } from '@/lib/store';
import { Plus, Trash2, Tag, Percent, Gift, ToggleLeft, ToggleRight, KeyRound, Calendar } from 'lucide-react';

const CouponManager = () => {
  const [coupons, setCoupons] = useState<Coupon[]>(getCoupons());
  const [offers, setOffers] = useState<ProductOffer[]>(getOffers());
  const [tab, setTab] = useState<'coupons' | 'offers'>('coupons');
  const [showForm, setShowForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const products = getProducts();

  // Coupon form
  const [couponForm, setCouponForm] = useState({
    code: '',
    password: '',
    type: 'percent' as 'percent' | 'fixed',
    value: '',
    productId: '',
    maxUsage: '',
    expiresAt: '',
  });

  // Offer form
  const [offerForm, setOfferForm] = useState({ productId: '', discountType: 'percent' as 'percent' | 'fixed', discountValue: '', startDate: '', endDate: '' });

  const handleAddCoupon = () => {
    const val = parseFloat(couponForm.value);
    if (!couponForm.code.trim() || isNaN(val) || val <= 0) return;

    const product = couponForm.productId ? products.find(p => p.id === couponForm.productId) : null;
    const newCoupon: Coupon = {
      id: crypto.randomUUID(),
      code: couponForm.code.trim().toUpperCase(),
      password: couponForm.password.trim() || undefined,
      type: couponForm.type,
      value: val,
      productId: couponForm.productId || undefined,
      productName: product?.name,
      active: true,
      createdAt: Date.now(),
      usageCount: 0,
      maxUsage: couponForm.maxUsage ? parseInt(couponForm.maxUsage) : undefined,
      expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt + 'T23:59:59').getTime() : undefined,
    };

    setCoupons(addCoupon(newCoupon));
    setCouponForm({ code: '', password: '', type: 'percent', value: '', productId: '', maxUsage: '', expiresAt: '' });
    setShowForm(false);
  };

  const toggleCoupon = (c: Coupon) => {
    setCoupons(updateCoupon({ ...c, active: !c.active }));
  };

  const handleDeleteCoupon = (id: string) => {
    setCoupons(deleteCoupon(id));
  };

  const handleAddOffer = () => {
    const val = parseFloat(offerForm.discountValue);
    if (!offerForm.productId || isNaN(val) || val <= 0) return;
    const product = products.find(p => p.id === offerForm.productId);
    if (!product) return;

    const newOffer: ProductOffer = {
      id: crypto.randomUUID(),
      productId: offerForm.productId,
      productName: product.name,
      discountType: offerForm.discountType,
      discountValue: val,
      active: true,
      startDate: offerForm.startDate ? new Date(offerForm.startDate).getTime() : undefined,
      endDate: offerForm.endDate ? new Date(offerForm.endDate + 'T23:59:59').getTime() : undefined,
      createdAt: Date.now(),
    };

    setOffers(addOffer(newOffer));
    setOfferForm({ productId: '', discountType: 'percent', discountValue: '', startDate: '', endDate: '' });
    setShowOfferForm(false);
  };

  const handleDeleteOffer = (id: string) => {
    setOffers(deleteOffer(id));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setTab('coupons')}
          className={`flex items-center gap-2 px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${tab === 'coupons' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'}`}
        >
          <Tag className="w-4 h-4" /> الكوبونات ({coupons.length})
        </button>
        <button
          onClick={() => setTab('offers')}
          className={`flex items-center gap-2 px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${tab === 'offers' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'}`}
        >
          <Gift className="w-4 h-4" /> العروض ({offers.length})
        </button>
      </div>

      {tab === 'coupons' && (
        <div className="space-y-3">
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> إضافة كوبون
          </button>

          {coupons.map(c => (
            <div key={c.id} className={`p-4 rounded-lg border ${c.active ? 'bg-card border-border' : 'bg-muted/50 border-border opacity-60'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-cairo font-bold text-lg flex items-center gap-2">
                    <Tag className="w-4 h-4 text-supermarket" />
                    <span className="font-mono">{c.code}</span>
                    {c.password && <KeyRound className="w-4 h-4 text-cafe" />}
                  </div>
                  <div className="text-xs text-muted-foreground font-cairo mt-1">
                    {c.type === 'percent' ? `خصم ${c.value}%` : `خصم ${c.value} ج.م`}
                    {c.productName && ` • على: ${c.productName}`}
                    {c.password && ' • محمي بكلمة مرور'}
                    {c.maxUsage && ` • أقصى استخدام: ${c.maxUsage}`}
                    {` • استُخدم: ${c.usageCount} مرة`}
                    {c.expiresAt && ` • ينتهي: ${new Date(c.expiresAt).toLocaleDateString('ar-EG')}`}
                    {c.expiresAt && Date.now() > c.expiresAt && (
                      <span className="text-destructive font-bold mr-1">⚠️ منتهي الصلاحية</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleCoupon(c)} className="p-1 hover:bg-secondary rounded">
                    {c.active ? <ToggleRight className="w-5 h-5 text-success" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                  </button>
                  <button onClick={() => handleDeleteCoupon(c.id)} className="p-1 hover:bg-destructive/20 rounded">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {coupons.length === 0 && <div className="text-center text-muted-foreground py-8 font-cairo">لا توجد كوبونات</div>}
        </div>
      )}

      {tab === 'offers' && (
        <div className="space-y-3">
          <button
            onClick={() => setShowOfferForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> إضافة عرض على منتج
          </button>

          {offers.map(o => {
            const now = Date.now();
            const isExpired = o.endDate && now > o.endDate;
            const isNotStarted = o.startDate && now < o.startDate;
            return (
              <div key={o.id} className={`p-4 rounded-lg border ${isExpired ? 'bg-destructive/5 border-destructive/30 opacity-60' : 'bg-card border-border'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-cairo font-bold flex items-center gap-2">
                      <Gift className="w-4 h-4 text-success" />
                      {o.productName}
                      {isExpired && <span className="text-xs text-destructive font-bold">⚠️ منتهي</span>}
                      {isNotStarted && <span className="text-xs text-cafe font-bold">⏳ لم يبدأ بعد</span>}
                    </div>
                    <div className="text-xs text-muted-foreground font-cairo mt-1">
                      {o.discountType === 'percent' ? `خصم ${o.discountValue}%` : `خصم ${o.discountValue} ج.م`}
                      {o.startDate && ` • من: ${new Date(o.startDate).toLocaleDateString('ar-EG')}`}
                      {o.endDate && ` • إلى: ${new Date(o.endDate).toLocaleDateString('ar-EG')}`}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteOffer(o.id)} className="p-1 hover:bg-destructive/20 rounded">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            );
          })}

          {offers.length === 0 && <div className="text-center text-muted-foreground py-8 font-cairo">لا توجد عروض</div>}
        </div>
      )}

      {/* Coupon form */}
      {showForm && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-cairo font-bold text-lg">إضافة كوبون جديد</h3>
              <button onClick={() => setShowForm(false)} className="text-lg font-bold text-muted-foreground">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="font-cairo text-sm text-muted-foreground">كود الكوبون *</label>
                <input
                  value={couponForm.code}
                  onChange={e => setCouponForm({ ...couponForm, code: e.target.value })}
                  className="w-full h-10 px-3 bg-secondary rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                  placeholder="مثال: SAVE20"
                />
              </div>

              <div>
                <label className="font-cairo text-sm text-muted-foreground">كلمة مرور القسيمة (اختياري)</label>
                <input
                  type="password"
                  value={couponForm.password}
                  onChange={e => setCouponForm({ ...couponForm, password: e.target.value })}
                  className="w-full h-10 px-3 bg-secondary rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                  placeholder="مثال: 1234"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setCouponForm({ ...couponForm, type: 'percent' })}
                  className={`flex-1 py-2 rounded font-cairo font-bold text-sm flex items-center justify-center gap-1 ${couponForm.type === 'percent' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'}`}
                >
                  <Percent className="w-3 h-3" /> نسبة %
                </button>
                <button
                  onClick={() => setCouponForm({ ...couponForm, type: 'fixed' })}
                  className={`flex-1 py-2 rounded font-cairo font-bold text-sm flex items-center justify-center gap-1 ${couponForm.type === 'fixed' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'}`}
                >
                  مبلغ ثابت
                </button>
              </div>

              <div>
                <label className="font-cairo text-sm text-muted-foreground">{couponForm.type === 'percent' ? 'نسبة الخصم %' : 'مبلغ الخصم'} *</label>
                <input
                  type="number"
                  value={couponForm.value}
                  onChange={e => setCouponForm({ ...couponForm, value: e.target.value })}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                />
              </div>

              <div>
                <label className="font-cairo text-sm text-muted-foreground">منتج محدد (اختياري)</label>
                <select
                  value={couponForm.productId}
                  onChange={e => setCouponForm({ ...couponForm, productId: e.target.value })}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                >
                  <option value="">على كل المنتجات</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} - {p.price} ج.م</option>)}
                </select>
              </div>

              <div>
                <label className="font-cairo text-sm text-muted-foreground">حد أقصى للاستخدام (اختياري)</label>
                <input
                  type="number"
                  value={couponForm.maxUsage}
                  onChange={e => setCouponForm({ ...couponForm, maxUsage: e.target.value })}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                  placeholder="بدون حد"
                />
              </div>

              <div>
                <label className="font-cairo text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  تاريخ انتهاء الكوبون (اختياري)
                </label>
                <input
                  type="date"
                  value={couponForm.expiresAt}
                  onChange={e => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                />
              </div>
            </div>

            <button
              onClick={handleAddCoupon}
              className="w-full py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90"
            >
              إضافة الكوبون
            </button>
          </div>
        </div>
      )}

      {/* Offer form */}
      {showOfferForm && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-cairo font-bold text-lg">إضافة عرض على منتج</h3>
              <button onClick={() => setShowOfferForm(false)} className="text-lg font-bold text-muted-foreground">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="font-cairo text-sm text-muted-foreground">المنتج *</label>
                <select
                  value={offerForm.productId}
                  onChange={e => setOfferForm({ ...offerForm, productId: e.target.value })}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                >
                  <option value="">اختر منتج</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} - {p.price} ج.م</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOfferForm({ ...offerForm, discountType: 'percent' })}
                  className={`flex-1 py-2 rounded font-cairo font-bold text-sm ${offerForm.discountType === 'percent' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'}`}
                >
                  نسبة %
                </button>
                <button
                  onClick={() => setOfferForm({ ...offerForm, discountType: 'fixed' })}
                  className={`flex-1 py-2 rounded font-cairo font-bold text-sm ${offerForm.discountType === 'fixed' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'}`}
                >
                  مبلغ ثابت
                </button>
              </div>
              <div>
                <label className="font-cairo text-sm text-muted-foreground">قيمة الخصم *</label>
                <input
                  type="number"
                  value={offerForm.discountValue}
                  onChange={e => setOfferForm({ ...offerForm, discountValue: e.target.value })}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="font-cairo text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    تاريخ البداية (اختياري)
                  </label>
                  <input
                    type="date"
                    value={offerForm.startDate}
                    onChange={e => setOfferForm({ ...offerForm, startDate: e.target.value })}
                    className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                  />
                </div>
                <div className="flex-1">
                  <label className="font-cairo text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    تاريخ النهاية (اختياري)
                  </label>
                  <input
                    type="date"
                    value={offerForm.endDate}
                    onChange={e => setOfferForm({ ...offerForm, endDate: e.target.value })}
                    className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleAddOffer}
              className="w-full py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90"
            >
              إضافة العرض
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponManager;
