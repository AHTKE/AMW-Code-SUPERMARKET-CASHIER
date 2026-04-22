// Per-cashier permissions system
export interface CashierPermissions {
  canReturn: boolean;
  canDiscount: boolean;
  canHold: boolean;
  canViewSales: boolean;
  showSalesCount: boolean;
  showSalesTotal: boolean;
  showReturns: boolean;
}

const PERMISSIONS_KEY = 'pos_cashier_permissions';
const GLOBAL_PERMISSIONS_KEY = 'pos_global_cashier_permissions';

const DEFAULT_PERMISSIONS: CashierPermissions = {
  canReturn: false,
  canDiscount: false,
  canHold: false,
  canViewSales: false,
  showSalesCount: false,
  showSalesTotal: false,
  showReturns: false,
};

export function getGlobalPermissions(): CashierPermissions {
  try {
    const raw = localStorage.getItem(GLOBAL_PERMISSIONS_KEY);
    return raw ? { ...DEFAULT_PERMISSIONS, ...JSON.parse(raw) } : DEFAULT_PERMISSIONS;
  } catch { return DEFAULT_PERMISSIONS; }
}

export function saveGlobalPermissions(perms: CashierPermissions) {
  localStorage.setItem(GLOBAL_PERMISSIONS_KEY, JSON.stringify(perms));
}

export function getCashierPermissions(cashierId: string): CashierPermissions {
  try {
    const raw = localStorage.getItem(`${PERMISSIONS_KEY}_${cashierId}`);
    if (raw) return { ...DEFAULT_PERMISSIONS, ...JSON.parse(raw) };
    return getGlobalPermissions();
  } catch { return getGlobalPermissions(); }
}

export function saveCashierPermissions(cashierId: string, perms: CashierPermissions) {
  localStorage.setItem(`${PERMISSIONS_KEY}_${cashierId}`, JSON.stringify(perms));
}

export function clearCashierPermissions(cashierId: string) {
  localStorage.removeItem(`${PERMISSIONS_KEY}_${cashierId}`);
}

export function hasCashierCustomPermissions(cashierId: string): boolean {
  return localStorage.getItem(`${PERMISSIONS_KEY}_${cashierId}`) !== null;
}
