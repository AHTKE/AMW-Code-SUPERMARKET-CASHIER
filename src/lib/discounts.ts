import { CartItem } from '@/types/pos';

export interface DiscountInfo {
  type: 'percent' | 'fixed';
  value: number;
  source?: 'manual' | 'coupon';
  couponCode?: string;
  couponId?: string;
  appliesToProductId?: string;
}

export function getDiscountBaseSubtotal(items: CartItem[], discount?: DiscountInfo): number {
  if (!discount) return 0;

  if (discount.appliesToProductId) {
    return items
      .filter(item => item.product.id === discount.appliesToProductId)
      .reduce((sum, item) => sum + item.product.price * item.qty, 0);
  }

  return items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
}

export function calculateDiscountAmount(items: CartItem[], discount?: DiscountInfo): number {
  if (!discount) return 0;
  const base = getDiscountBaseSubtotal(items, discount);
  if (base <= 0 || discount.value <= 0) return 0;

  return discount.type === 'percent'
    ? Math.round(base * discount.value / 100)
    : Math.min(discount.value, base);
}
