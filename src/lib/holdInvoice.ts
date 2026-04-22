import { CartItem } from '@/types/pos';

export interface HeldInvoice {
  id: string;
  items: CartItem[];
  cashierId?: string;
  cashierName?: string;
  heldAt: number;
  note?: string;
  discount?: { type: 'percent' | 'fixed'; value: number };
}

const HELD_KEY = 'pos_held_invoices';

export function getHeldInvoices(): HeldInvoice[] {
  try {
    const raw = localStorage.getItem(HELD_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function holdInvoice(invoice: HeldInvoice) {
  const list = getHeldInvoices();
  list.push(invoice);
  localStorage.setItem(HELD_KEY, JSON.stringify(list));
  return list;
}

export function recallInvoice(id: string): HeldInvoice | null {
  const list = getHeldInvoices();
  const found = list.find(h => h.id === id);
  if (found) {
    const remaining = list.filter(h => h.id !== id);
    localStorage.setItem(HELD_KEY, JSON.stringify(remaining));
  }
  return found || null;
}

export function deleteHeldInvoice(id: string) {
  const list = getHeldInvoices().filter(h => h.id !== id);
  localStorage.setItem(HELD_KEY, JSON.stringify(list));
  return list;
}
