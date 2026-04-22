import { Product, Sale, Expense, Income, AdminCredentials, Cashier, CashierSession } from '@/types/pos';
import { SUPERMARKET_PRODUCTS, CAFE_PRODUCTS } from '@/data/products';

const KEYS = {
  products: 'pos_products',
  sales: 'pos_sales',
  expenses: 'pos_expenses',
  income: 'pos_income',
  adminCredentials: 'pos_admin_credentials',
  cashiers: 'pos_cashiers',
  cashierSessions: 'pos_cashier_sessions',
  activeCashierSession: 'pos_active_cashier_session',
};

// Master recovery password (never changes)
const MASTER_RECOVERY = { username: 'Proofahmed', password: '24682468' };

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Admin Credentials ───
export function getAdminCredentials(): AdminCredentials | null {
  return load<AdminCredentials | null>(KEYS.adminCredentials, null);
}

export function setAdminCredentials(creds: AdminCredentials) {
  save(KEYS.adminCredentials, creds);
}

export function isAdminSetup(): boolean {
  return getAdminCredentials() !== null;
}

export function verifyAdmin(username: string, password: string): boolean {
  const creds = getAdminCredentials();
  if (creds) {
    return creds.username === username && creds.password === password;
  }
  return false;
}

export function verifyMasterRecovery(username: string, password: string): boolean {
  return username === MASTER_RECOVERY.username && password === MASTER_RECOVERY.password;
}

// ─── Cashiers ───
export function getCashiers(): Cashier[] {
  return load<Cashier[]>(KEYS.cashiers, []);
}

export function saveCashiers(cashiers: Cashier[]) {
  save(KEYS.cashiers, cashiers);
}

export function addCashier(cashier: Cashier) {
  const list = getCashiers();
  list.push(cashier);
  saveCashiers(list);
  return list;
}

export function updateCashier(updated: Cashier) {
  const list = getCashiers().map(c => c.id === updated.id ? updated : c);
  saveCashiers(list);
  return list;
}

export function deleteCashier(id: string) {
  const list = getCashiers().filter(c => c.id !== id);
  saveCashiers(list);
  return list;
}

export function verifyCashier(code: string, password: string): Cashier | null {
  const cashiers = getCashiers();
  return cashiers.find(c => c.code === code && c.password === password && c.active) || null;
}

// ─── Cashier Sessions ───
export function getCashierSessions(): CashierSession[] {
  return load<CashierSession[]>(KEYS.cashierSessions, []);
}

export function startCashierSession(cashier: Cashier): CashierSession {
  const session: CashierSession = {
    id: crypto.randomUUID(),
    cashierId: cashier.id,
    cashierName: cashier.name,
    loginTime: Date.now(),
    salesCount: 0,
    salesTotal: 0,
  };
  const sessions = getCashierSessions();
  sessions.push(session);
  save(KEYS.cashierSessions, sessions);
  save(KEYS.activeCashierSession, session);
  return session;
}

export function endCashierSession() {
  const active = getActiveCashierSession();
  if (active) {
    active.logoutTime = Date.now();
    const sessions = getCashierSessions().map(s => s.id === active.id ? active : s);
    save(KEYS.cashierSessions, sessions);
    localStorage.removeItem(KEYS.activeCashierSession);
  }
}

export function getActiveCashierSession(): CashierSession | null {
  return load<CashierSession | null>(KEYS.activeCashierSession, null);
}

export function updateActiveSession(salesCount: number, salesTotal: number) {
  const active = getActiveCashierSession();
  if (active) {
    active.salesCount = salesCount;
    active.salesTotal = salesTotal;
    save(KEYS.activeCashierSession, active);
    const sessions = getCashierSessions().map(s => s.id === active.id ? active : s);
    save(KEYS.cashierSessions, sessions);
  }
}

// ─── Products ───
export function getProducts(): Product[] {
  const stored = load<Product[] | null>(KEYS.products, null);
  if (stored) return stored;
  const defaults = [...SUPERMARKET_PRODUCTS, ...CAFE_PRODUCTS];
  save(KEYS.products, defaults);
  return defaults;
}

export function saveProducts(products: Product[]) {
  save(KEYS.products, products);
}

export function addProduct(product: Product) {
  const products = getProducts();
  products.push(product);
  saveProducts(products);
  return products;
}

export function updateProduct(updated: Product) {
  const products = getProducts().map(p => p.id === updated.id ? updated : p);
  saveProducts(products);
  return products;
}

export function deleteProduct(id: string) {
  const products = getProducts().filter(p => p.id !== id);
  saveProducts(products);
  return products;
}

export function findProductByBarcode(barcode: string): Product | null {
  const trimmed = barcode.trim();
  if (!trimmed) return null;
  const products = getProducts();
  return products.find(p => p.barcode === trimmed) || null;
}

// ─── Sales ───
export function getSales(): Sale[] {
  return load<Sale[]>(KEYS.sales, []);
}

export function addSale(sale: Sale) {
  const sales = getSales();
  sales.push(sale);
  save(KEYS.sales, sales);
  // Decrease stock
  const products = getProducts();
  sale.items.forEach(item => {
    const p = products.find(pr => pr.id === item.product.id);
    if (p) p.stock = Math.max(0, p.stock - item.qty);
  });
  saveProducts(products);
  return sales;
}

// ─── Expenses ───
export function getExpenses(): Expense[] {
  return load<Expense[]>(KEYS.expenses, []);
}

export function addExpense(expense: Expense) {
  const expenses = getExpenses();
  expenses.push(expense);
  save(KEYS.expenses, expenses);
  return expenses;
}

export function deleteExpense(id: string) {
  const expenses = getExpenses().filter(e => e.id !== id);
  save(KEYS.expenses, expenses);
  return expenses;
}

// ─── Income ───
export function getIncomeList(): Income[] {
  return load<Income[]>(KEYS.income, []);
}

export function addIncome(income: Income) {
  const list = getIncomeList();
  list.push(income);
  save(KEYS.income, list);
  return list;
}

export function deleteIncome(id: string) {
  const list = getIncomeList().filter(i => i.id !== id);
  save(KEYS.income, list);
  return list;
}

// ─── Stats helpers ───
export function getTodaySales(): Sale[] {
  const today = new Date().toLocaleDateString('ar-EG');
  return getSales().filter(s => s.date === today);
}

export function getSalesByDateRange(from: number, to: number): Sale[] {
  return getSales().filter(s => s.timestamp >= from && s.timestamp <= to);
}
