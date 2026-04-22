export type POSMode = 'supermarket' | 'cafe';

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  price: number;
  costPrice?: number;
  stock: number;
  category: string;
  type: POSMode;
}

export interface CartItem {
  product: Product;
  qty: number;
}

export interface SaleDiscount {
  type: 'percent' | 'fixed';
  value: number;
  amount: number;
  source?: 'manual' | 'coupon';
  couponCode?: string;
  appliesToProductId?: string;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  time: string;
  total: number;
  cashier: string;
  cashierId?: string;
  items: CartItem[];
  mode: POSMode;
  timestamp: number;
  discount?: SaleDiscount;
}

export interface SaleReturn {
  id: string;
  originalSaleId: string;
  date: string;
  time: string;
  total: number;
  cashier: string;
  cashierId?: string;
  items: CartItem[];
  reason: string;
  timestamp: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  time: string;
  timestamp: number;
}

export interface Income {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  time: string;
  timestamp: number;
}

export interface AdminCredentials {
  username: string;
  password: string;
}

export interface Cashier {
  id: string;
  name: string;
  password: string;
  code: string;
  active: boolean;
  createdAt: number;
}

export interface CashierSession {
  id: string;
  cashierId: string;
  cashierName: string;
  loginTime: number;
  logoutTime?: number;
  salesCount: number;
  salesTotal: number;
}

export type AppView = 'pos' | 'admin' | 'admin-login' | 'login' | 'cashier-login';
