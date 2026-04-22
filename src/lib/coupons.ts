import { CartItem } from '@/types/pos';
import { DiscountInfo, calculateDiscountAmount } from '@/lib/discounts';

// Admin coupon/discount/offer system

export interface CouponUsageRecord {
  date: number;
  cashierId?: string;
  cashierName?: string;
}

export interface Coupon {
  id: string;
  code: string;
  password?: string;
  type: 'percent' | 'fixed';
  value: number;
  productId?: string;
  productName?: string;
  active: boolean;
  expiresAt?: number;
  createdAt: number;
  usageCount: number;
  maxUsage?: number;
  usageHistory?: CouponUsageRecord[];
}

export interface ProductOffer {
  id: string;
  productId: string;
  productName: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  active: boolean;
  startDate?: number;
  endDate?: number;
  createdAt: number;
}

const COUPONS_KEY = 'pos_coupons';
const OFFERS_KEY = 'pos_product_offers';

const normalizeCouponCode = (code: string) => code.trim().toLowerCase();

export function getCoupons(): Coupon[] {
  try {
    const raw = localStorage.getItem(COUPONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCoupons(coupons: Coupon[]) {
  localStorage.setItem(COUPONS_KEY, JSON.stringify(coupons));
}

export function addCoupon(coupon: Coupon) {
  const list = getCoupons();
  list.push(coupon);
  saveCoupons(list);
  return list;
}

export function updateCoupon(updated: Coupon) {
  const list = getCoupons().map(c => c.id === updated.id ? updated : c);
  saveCoupons(list);
  return list;
}

export function deleteCoupon(id: string) {
  const list = getCoupons().filter(c => c.id !== id);
  saveCoupons(list);
  return list;
}

export function findCouponWithStatus(code: string): { coupon: Coupon | null; error?: string } {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return { coupon: null, error: 'أدخل كود القسيمة' };

  const coupons = getCoupons();
  const c = coupons.find(coupon => normalizeCouponCode(coupon.code) === normalized);
  if (!c) return { coupon: null, error: 'القسيمة غير موجودة' };
  if (!c.active) return { coupon: null, error: 'القسيمة غير مفعلة' };
  if (c.expiresAt && Date.now() > c.expiresAt) {
    return { coupon: null, error: `القسيمة منتهية الصلاحية منذ ${new Date(c.expiresAt).toLocaleDateString('ar-EG')}` };
  }
  if (c.maxUsage && c.usageCount >= c.maxUsage) {
    const lastUsage = c.usageHistory?.length ? c.usageHistory[c.usageHistory.length - 1] : null;
    const lastDate = lastUsage ? new Date(lastUsage.date).toLocaleDateString('ar-EG') : '';
    return { coupon: null, error: `القسيمة استُخدمت بالفعل (${c.usageCount}/${c.maxUsage} مرة)${lastDate ? ` - آخر استخدام: ${lastDate}` : ''}` };
  }
  return { coupon: c };
}

export function findCoupon(code: string): Coupon | null {
  return findCouponWithStatus(code).coupon;
}

export function useCoupon(code: string, cashierId?: string, cashierName?: string) {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return;

  const coupons = getCoupons();
  const idx = coupons.findIndex(c => normalizeCouponCode(c.code) === normalized);
  if (idx >= 0) {
    coupons[idx].usageCount++;
    if (!coupons[idx].usageHistory) coupons[idx].usageHistory = [];
    coupons[idx].usageHistory!.push({ date: Date.now(), cashierId, cashierName });
    saveCoupons(coupons);
  }
}

export function resolveCouponDiscount(
  code: string,
  password: string,
  items: CartItem[]
): { success: boolean; message: string; discount?: DiscountInfo } {
  if (!code.trim()) {
    return { success: false, message: 'أدخل كود القسيمة' };
  }

  if (items.length === 0) {
    return { success: false, message: 'لا يمكن تطبيق القسيمة على فاتورة فارغة' };
  }

  const { coupon, error } = findCouponWithStatus(code);
  if (!coupon) {
    return { success: false, message: error || 'القسيمة غير موجودة أو غير مفعلة' };
  }

  if (coupon.password && coupon.password.trim() !== password.trim()) {
    return { success: false, message: 'كلمة مرور القسيمة غير صحيحة' };
  }

  const discount: DiscountInfo = {
    type: coupon.type,
    value: coupon.value,
    source: 'coupon',
    couponCode: coupon.code,
    couponId: coupon.id,
    appliesToProductId: coupon.productId,
  };

  const amount = calculateDiscountAmount(items, discount);
  if (amount <= 0) {
    return { success: false, message: coupon.productId ? 'القسيمة لا تنطبق على المنتجات الموجودة في الفاتورة' : 'القسيمة غير صالحة لهذه الفاتورة' };
  }

  return { success: true, message: 'تم تطبيق القسيمة بنجاح', discount };
}

// Product Offers
export function getOffers(): ProductOffer[] {
  try {
    const raw = localStorage.getItem(OFFERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveOffers(offers: ProductOffer[]) {
  localStorage.setItem(OFFERS_KEY, JSON.stringify(offers));
}

export function addOffer(offer: ProductOffer) {
  const list = getOffers();
  list.push(offer);
  saveOffers(list);
  return list;
}

export function deleteOffer(id: string) {
  const list = getOffers().filter(o => o.id !== id);
  saveOffers(list);
  return list;
}

export function getActiveOffers(): ProductOffer[] {
  const now = Date.now();
  return getOffers().filter(o => {
    if (!o.active) return false;
    if (o.startDate && now < o.startDate) return false;
    if (o.endDate && now > o.endDate) return false;
    return true;
  });
}

export function getOfferForProduct(productId: string): ProductOffer | null {
  return getActiveOffers().find(o => o.productId === productId) || null;
}
