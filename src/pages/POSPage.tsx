import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { POSMode, CartItem, Product, Sale, AppView, Cashier, CashierSession, SaleReturn } from '@/types/pos';
import { generateInvoiceNumber } from '@/lib/invoiceNumber';
import { playCashRegisterSound } from '@/lib/sound';
import { addSale, getActiveCashierSession, endCashierSession, updateActiveSession, getCashiers, getSales } from '@/lib/store';
import { getSettings, getStoreInfo } from '@/lib/settings';
import { getCashierPermissions } from '@/lib/permissions';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { getCustomShortcuts } from '@/components/pos/POSSettings';
import { DiscountInfo, calculateDiscountAmount } from '@/lib/discounts';
import { addReturn, getReturns, getReturnedQtysForSale, ReturnDialog } from '@/components/admin/SalesReturns';
import { getHeldInvoices } from '@/lib/holdInvoice';
import { getOfferForProduct, useCoupon } from '@/lib/coupons';
import TopBar from '@/components/pos/TopBar';
import InvoicePanel from '@/components/pos/InvoicePanel';
import SupermarketMode from '@/components/pos/SupermarketMode';
import CafeMode from '@/components/pos/CafeMode';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminLogin from '@/components/auth/AdminLogin';
import CashierLogin from '@/components/auth/CashierLogin';
import POSSettings from '@/components/pos/POSSettings';
import StartScreen from '@/components/auth/StartScreen';
import ActivationGate from '@/components/auth/ActivationGate';
import { LogOut, AlertTriangle, CheckCircle, Keyboard, GripVertical, FileText, RotateCcw, ChevronDown, ChevronUp, Minus, Plus, Check, X, RefreshCw } from 'lucide-react';

const POSPage = () => {
  const [view, setView] = useState<AppView>('login');
  const [mode, setMode] = useState<POSMode>('supermarket');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentCashier, setCurrentCashier] = useState<Cashier | null>(null);
  const [currentSession, setCurrentSession] = useState<CashierSession | null>(null);
  const [salesCount, setSalesCount] = useState(0);
  const [salesTotalAmount, setSalesTotalAmount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutName, setLogoutName] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCashierSales, setShowCashierSales] = useState(false);
  // Force re-read permissions when settings are saved
  const [permsVersion, setPermsVersion] = useState(0);

  useEffect(() => {
    const activeSession = getActiveCashierSession();
    if (activeSession) {
      const cashiers = getCashiers();
      const fullCashier = cashiers.find(c => c.id === activeSession.cashierId);
      setCurrentCashier(fullCashier || { id: activeSession.cashierId, name: activeSession.cashierName, code: '', password: '', active: true, createdAt: 0 });
      setCurrentSession(activeSession);
      setSalesCount(activeSession.salesCount);
      setSalesTotalAmount(activeSession.salesTotal);
      setView('pos');
    }
  }, []);

  // Listen for settings/permissions changes
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key?.includes('permissions') || e.key?.includes('settings')) {
        setPermsVersion(v => v + 1);
      }
    };
    window.addEventListener('storage', handler);
    // Also listen for custom event from admin panel
    const customHandler = () => setPermsVersion(v => v + 1);
    window.addEventListener('pos-settings-changed', customHandler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('pos-settings-changed', customHandler);
    };
  }, []);

  const toggleMode = useCallback(() => {
    setMode(prev => (prev === 'supermarket' ? 'cafe' : 'supermarket'));
  }, []);

  const addToCart = useCallback((product: Product) => {
    const offer = getOfferForProduct(product.id);
    const productWithOffer = offer
      ? {
          ...product,
          price: offer.discountType === 'percent'
            ? Math.round(product.price * (1 - offer.discountValue / 100))
            : Math.max(0, product.price - offer.discountValue),
        }
      : product;

    setCart(prev => {
      const existing = prev.find(item => item.product.id === productWithOffer.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === productWithOffer.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product: productWithOffer, qty: 1 }];
    });
  }, []);

  const updateQty = useCallback((productId: string, delta: number) => {
    setCart(prev =>
      prev.map(item => item.product.id === productId ? { ...item, qty: Math.max(0, item.qty + delta) } : item).filter(item => item.qty > 0)
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const handleRecallInvoice = useCallback((items: CartItem[], discount?: DiscountInfo) => {
    setCart(items);
  }, []);

  const handlePay = useCallback((discount?: DiscountInfo) => {
    if (cart.length === 0) return;

    const now = new Date();
    const discountAmount = calculateDiscountAmount(cart, discount);
    const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
    const total = Math.max(0, subtotal - discountAmount);

    const sale: Sale = {
      id: crypto.randomUUID(),
      invoiceNumber: generateInvoiceNumber(),
      date: now.toLocaleDateString('ar-EG'),
      time: now.toLocaleTimeString('ar-EG'),
      total,
      cashier: currentCashier?.name || 'كاشير',
      cashierId: currentCashier?.id,
      items: cart,
      mode,
      timestamp: now.getTime(),
      discount: discount
        ? {
            type: discount.type,
            value: discount.value,
            amount: discountAmount,
            source: discount.source,
            couponCode: discount.couponCode,
            appliesToProductId: discount.appliesToProductId,
          }
        : undefined,
    };

    addSale(sale);

    if (discount?.source === 'coupon' && discount.couponCode) {
      useCoupon(discount.couponCode, currentCashier?.id, currentCashier?.name);
    }

    const newCount = salesCount + 1;
    const newTotal = salesTotalAmount + sale.total;
    setSalesCount(newCount);
    setSalesTotalAmount(newTotal);
    updateActiveSession(newCount, newTotal);

    const settings = getSettings();
    if (settings.printEnabled) {
      printReceipt(sale, settings.paperSize);
    }
    playCashRegisterSound();
    setCart([]);
  }, [cart, mode, currentCashier, salesCount, salesTotalAmount]);

  const printReceipt = (sale: Sale, paperSize: string) => {
    const storeInfo = getStoreInfo();
    const receiptWindow = window.open('', '_blank', 'width=350,height=600');
    if (!receiptWindow) return;

    const itemsHtml = sale.items
      .map((item, i) => {
        const offer = getOfferForProduct(item.product.id);
        const itemTotal = item.product.price * item.qty;
        let offerHtml = '';
        if (offer) {
          const originalPrice = offer.discountType === 'percent'
            ? Math.round(item.product.price / (1 - offer.discountValue / 100))
            : item.product.price + offer.discountValue;
          offerHtml = `<tr><td colspan="4" style="font-size:9px;color:#27ae60;padding:1px 2px;border:none;">
            🎁 عرض! بدلاً من ${originalPrice} ج.م ← ${item.product.price} ج.م (خصم ${offer.discountType === 'percent' ? offer.discountValue + '%' : offer.discountValue + ' ج.م'})
          </td></tr>`;
        }
        return `<tr><td>${i + 1}</td><td>${item.product.name}</td><td>${item.qty}</td><td>${itemTotal}</td></tr>${offerHtml}`;
      })
      .join('');

    const subtotalVal = sale.items.reduce((s, it) => s + it.product.price * it.qty, 0);

    let discountHtml = '';
    if (sale.discount) {
      const d = sale.discount;
      discountHtml = `
        <div style="border:1px dashed #27ae60;border-radius:4px;padding:6px;margin:6px 0;text-align:center;">
          <div style="color:#27ae60;font-weight:bold;font-size:12px;">🎁 ${d.source === 'coupon' ? `قسيمة: ${d.couponCode || ''}` : 'خصم يدوي'}</div>
          <div style="color:#e74c3c;font-size:13px;font-weight:bold;">
            ${d.type === 'percent' ? d.value + '% خصم' : d.amount + ' ج.م خصم'}
            &nbsp;(-${d.amount} ج.م)
          </div>
          <div style="font-size:10px;color:#888;">المجموع قبل الخصم: ${subtotalVal} ج.م</div>
        </div>`;
    }

    receiptWindow.document.write(`
      <html dir="rtl">
      <head><title>فاتورة</title>
      <style>
        @media print { @page { size: ${paperSize} auto; margin: 0; } .no-print { display: none; } }
        body { font-family: 'Cairo', 'Arial', sans-serif; width: ${paperSize}; max-width: ${paperSize}; margin: 0 auto; padding: 5px; font-size: 12px; color: #000; }
        h2 { text-align: center; margin: 5px 0; font-size: 16px; }
        .info { text-align: center; font-size: 10px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th, td { padding: 3px 2px; text-align: right; border-bottom: 1px dashed #ccc; font-size: 11px; }
        th { font-weight: bold; border-bottom: 1px solid #000; }
        .total { font-size: 16px; font-weight: 900; text-align: center; margin: 8px 0; padding: 5px; border: 2px solid #000; }
        .thanks { text-align: center; margin-top: 10px; font-size: 10px; }
        hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
      </style></head>
      <body>
        <h2>${storeInfo.name || (sale.mode === 'supermarket' ? '🛒 سوبرماركت' : '☕ كافيه')}</h2>
        ${storeInfo.address ? `<div class="info">${storeInfo.address}</div>` : ''}
        ${storeInfo.phone ? `<div class="info">📞 ${storeInfo.phone}</div>` : ''}
        ${storeInfo.extra1Label && storeInfo.extra1Value ? `<div class="info">${storeInfo.extra1Label}: ${storeInfo.extra1Value}</div>` : ''}
        ${storeInfo.extra2Label && storeInfo.extra2Value ? `<div class="info">${storeInfo.extra2Label}: ${storeInfo.extra2Value}</div>` : ''}
        <hr />
        <div class="info">${sale.date} - ${sale.time}</div>
        <div class="info">كاشير: ${sale.cashier}</div>
        <div class="info">فاتورة: #${sale.invoiceNumber || sale.id.slice(0, 8)}</div>
        <hr />
        <table><thead><tr><th>#</th><th>المنتج</th><th>عدد</th><th>المبلغ</th></tr></thead><tbody>${itemsHtml}</tbody></table>
        <hr />
        ${discountHtml}
        <div class="total">الإجمالي: ${sale.total} ج.م</div>
        <hr />
        <div class="thanks">شكراً لزيارتكم ❤️</div>
        <script>setTimeout(function() { window.print(); }, 300);</script>
      </body></html>
    `);
    receiptWindow.document.close();
  };

  const handleCashierLogin = (cashier: Cashier, session: CashierSession) => {
    setCurrentCashier(cashier);
    setCurrentSession(session);
    setSalesCount(0);
    setSalesTotalAmount(0);
    setView('pos');
  };

  const handleLogoutRequest = () => {
    // Check for held invoices
    const heldInvoices = getHeldInvoices();
    if (heldInvoices.length > 0) {
      setLogoutError(`لا يمكن إغلاق الشيفت - يوجد ${heldInvoices.length} فاتورة معلقة. يرجى استرجاعها أو حذفها أولاً.`);
      setShowLogoutConfirm(true);
      setLogoutName('');
      return;
    }
    setShowLogoutConfirm(true);
    setLogoutName('');
    setLogoutError('');
  };

  const handleLogoutConfirm = () => {
    if (!currentCashier) return;
    // Recheck held invoices
    const heldInvoices = getHeldInvoices();
    if (heldInvoices.length > 0) {
      setLogoutError(`لا يمكن إغلاق الشيفت - يوجد ${heldInvoices.length} فاتورة معلقة.`);
      return;
    }
    if (logoutName.trim() !== currentCashier.name.trim()) {
      setLogoutError('الاسم غير مطابق. اكتب اسمك الصحيح لتأكيد إغلاق الشيفت.');
      return;
    }
    endCashierSession();
    setCurrentCashier(null);
    setCurrentSession(null);
    setSalesCount(0);
    setSalesTotalAmount(0);
    setShowLogoutConfirm(false);
    setView('login');
  };

  // Get cashier permissions (re-read when permsVersion changes)
  const cashierPerms = useMemo(() => {
    if (!currentCashier) return null;
    return getCashierPermissions(currentCashier.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCashier, permsVersion]);

  // Default shortcuts that always work
  const DEFAULT_SHORTCUTS: Record<string, string> = {
    'F1': 'show_shortcuts',
    'F2': 'toggle_mode',
    'F4': 'open_settings',
    'F8': 'pay',
    'Escape': 'clear_cart',
    'F10': 'admin_login',
    'F12': 'logout',
  };

  // Keyboard shortcuts
  const shortcuts = useMemo(() => {
    if (view !== 'pos') return {};

    const actionMap: Record<string, () => void> = {
      'toggle_mode': toggleMode,
      'open_settings': () => setShowSettings(true),
      'pay': () => handlePay(),
      'clear_cart': clearCart,
      'admin_login': () => setView('admin-login'),
      'logout': handleLogoutRequest,
      'show_shortcuts': () => setShowShortcuts(s => !s),
      'toggle_manual_barcode': () => { window.dispatchEvent(new CustomEvent('pos-toggle-manual-barcode')); },
      'focus_search': () => { (document.querySelector('.search-input') as HTMLInputElement)?.focus(); },
      'increase_qty_last': () => { if (cart.length > 0) updateQty(cart[cart.length - 1].product.id, 1); },
      'decrease_qty_last': () => { if (cart.length > 0) updateQty(cart[cart.length - 1].product.id, -1); },
      'remove_last_item': () => { if (cart.length > 0) removeItem(cart[cart.length - 1].product.id); },
      'print_receipt': () => {},
      'toggle_fullscreen': () => {
        if (document.fullscreenElement) { document.exitFullscreen?.(); }
        else { document.documentElement.requestFullscreen?.(); }
      },
      'undo_last_action': () => { if (cart.length > 0) removeItem(cart[cart.length - 1].product.id); },
      'view_sales': () => { if (cashierPerms?.canViewSales) setShowCashierSales(true); },
      'refresh_page': () => { window.location.reload(); },
      'next_page': () => { window.dispatchEvent(new CustomEvent('pos-next-page')); },
      'prev_page': () => { window.dispatchEvent(new CustomEvent('pos-prev-page')); },
      'next_category': () => { window.dispatchEvent(new CustomEvent('pos-next-category')); },
      'prev_category': () => { window.dispatchEvent(new CustomEvent('pos-prev-category')); },
      'hold_invoice': () => { window.dispatchEvent(new CustomEvent('pos-hold-invoice')); },
      'recall_invoice': () => { window.dispatchEvent(new CustomEvent('pos-recall-invoice')); },
    };

    const map: Record<string, () => void> = {};

    // Apply default shortcuts first
    for (const [key, action] of Object.entries(DEFAULT_SHORTCUTS)) {
      if (actionMap[action]) {
        map[key] = actionMap[action];
      }
    }

    // F11 fullscreen always
    map['F11'] = actionMap['toggle_fullscreen'];

    // Then apply custom shortcuts (override defaults if set)
    const custom = getCustomShortcuts(currentCashier?.id);
    for (const s of custom) {
      if (s.key && actionMap[s.action]) {
        map[s.key] = actionMap[s.action];
      }
    }

    return map;
  }, [view, toggleMode, handlePay, clearCart, cart, updateQty, removeItem, currentCashier?.id, cashierPerms]);

  useKeyboardShortcuts(shortcuts);

  return (
    <ActivationGate>
      <POSContent
        view={view} setView={setView} mode={mode} toggleMode={toggleMode}
        cart={cart} addToCart={addToCart} updateQty={updateQty} removeItem={removeItem}
        clearCart={clearCart} handlePay={handlePay} handleRecallInvoice={handleRecallInvoice}
        currentCashier={currentCashier} currentSession={currentSession}
        salesCount={salesCount} salesTotalAmount={salesTotalAmount}
        showSettings={showSettings} setShowSettings={setShowSettings}
        showLogoutConfirm={showLogoutConfirm} setShowLogoutConfirm={setShowLogoutConfirm}
        logoutName={logoutName} setLogoutName={setLogoutName}
        logoutError={logoutError} setLogoutError={setLogoutError}
        showShortcuts={showShortcuts} setShowShortcuts={setShowShortcuts}
        handleLogoutRequest={handleLogoutRequest} handleLogoutConfirm={handleLogoutConfirm}
        handleCashierLogin={handleCashierLogin} cashierPerms={cashierPerms}
        showCashierSales={showCashierSales} setShowCashierSales={setShowCashierSales}
        defaultShortcuts={DEFAULT_SHORTCUTS}
      />
    </ActivationGate>
  );
};

interface POSContentProps {
  view: AppView; setView: (v: AppView) => void;
  mode: POSMode; toggleMode: () => void;
  cart: CartItem[]; addToCart: (p: Product) => void;
  updateQty: (id: string, d: number) => void; removeItem: (id: string) => void;
  clearCart: () => void; handlePay: (discount?: DiscountInfo) => void;
  handleRecallInvoice: (items: CartItem[], discount?: DiscountInfo) => void;
  currentCashier: Cashier | null; currentSession: CashierSession | null;
  salesCount: number; salesTotalAmount: number;
  showSettings: boolean; setShowSettings: (v: boolean) => void;
  showLogoutConfirm: boolean; setShowLogoutConfirm: (v: boolean) => void;
  logoutName: string; setLogoutName: (v: string) => void;
  logoutError: string; setLogoutError: (v: string) => void;
  showShortcuts: boolean; setShowShortcuts: (v: boolean | ((prev: boolean) => boolean)) => void;
  handleLogoutRequest: () => void; handleLogoutConfirm: () => void;
  handleCashierLogin: (c: Cashier, s: CashierSession) => void;
  cashierPerms: ReturnType<typeof getCashierPermissions> | null;
  showCashierSales: boolean; setShowCashierSales: (v: boolean) => void;
  defaultShortcuts: Record<string, string>;
}

const POSContent = ({
  view, setView, mode, toggleMode, cart, addToCart, updateQty, removeItem, clearCart, handlePay, handleRecallInvoice,
  currentCashier, currentSession, salesCount, salesTotalAmount,
  showSettings, setShowSettings, showLogoutConfirm, setShowLogoutConfirm,
  logoutName, setLogoutName, logoutError, setLogoutError,
  showShortcuts, setShowShortcuts, handleLogoutRequest, handleLogoutConfirm, handleCashierLogin,
  cashierPerms, showCashierSales, setShowCashierSales, defaultShortcuts,
}: POSContentProps) => {

  // Get returns count for current cashier shift (must be before early returns)
  const cashierReturns = useMemo(() => {
    if (!currentCashier || !cashierPerms?.showReturns) return [];
    return getReturns().filter(r => r.cashierId === currentCashier.id);
  }, [currentCashier, cashierPerms?.showReturns]);

  if (view === 'login') {
    return <StartScreen onAdminLogin={() => setView('admin-login')} onCashierLogin={() => setView('cashier-login')} />;
  }
  if (view === 'admin' || view === 'admin-login') {
    if (view === 'admin-login') {
      return <AdminLogin onSuccess={() => setView('admin')} onCancel={() => setView(currentCashier ? 'pos' : 'login')} />;
    }
    return <AdminDashboard onBack={() => setView(currentCashier ? 'pos' : 'login')} />;
  }
  if (view === 'cashier-login') {
    return <CashierLogin onSuccess={handleCashierLogin} onCancel={() => setView('login')} />;
  }

  const settings = getSettings();

  const ACTION_LABELS: Record<string, string> = {
    'show_shortcuts': 'إظهار الاختصارات',
    'toggle_mode': 'تبديل سوبرماركت / كافيه',
    'open_settings': 'فتح الإعدادات',
    'pay': 'دفع الفاتورة',
    'clear_cart': 'مسح الفاتورة',
    'admin_login': 'لوحة المدير',
    'logout': 'تسجيل خروج',
    'toggle_fullscreen': 'ملء الشاشة',
    'toggle_manual_barcode': 'إظهار/إخفاء الباركود',
    'focus_search': 'التركيز على البحث',
    'increase_qty_last': 'زيادة كمية آخر منتج',
    'decrease_qty_last': 'تقليل كمية آخر منتج',
    'remove_last_item': 'حذف آخر منتج',
    'undo_last_action': 'تراجع',
    'view_sales': 'عرض الفواتير',
    'refresh_page': 'تحديث الصفحة',
    'next_page': 'الصفحة التالية',
    'prev_page': 'الصفحة السابقة',
    'next_category': 'التصنيف التالي',
    'prev_category': 'التصنيف السابق',
    'hold_invoice': 'تعليق الفاتورة',
    'recall_invoice': 'استرجاع فاتورة معلقة',
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar
        mode={mode} onToggleMode={toggleMode}
        cashierName={currentCashier?.name || 'كاشير'}
        onOpenAdmin={() => setView('admin-login')} onLogout={handleLogoutRequest}
        onOpenSettings={() => setShowSettings(true)} onShowShortcuts={() => setShowShortcuts(true)}
        extraButtons={
          <>
            {cashierPerms?.canViewSales && (
              <button onClick={() => setShowCashierSales(true)} className="p-2 rounded hover:bg-secondary transition-colors" title="فواتيري">
                <FileText className="w-4 h-4" />
              </button>
            )}
          </>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden min-w-0">
          {mode === 'supermarket' ? <SupermarketMode onAddToCart={addToCart} /> : <CafeMode onAddToCart={addToCart} />}
        </div>
        <ResizableInvoice
          cart={cart} updateQty={updateQty} removeItem={removeItem} clearCart={clearCart}
          handlePay={handlePay} cashierId={currentCashier?.id} cashierName={currentCashier?.name}
          onRecallInvoice={handleRecallInvoice}
          canReturn={cashierPerms?.canReturn}
          canDiscount={cashierPerms?.canDiscount}
          canHold={cashierPerms?.canHold}
        />
      </div>

      {showSettings && <POSSettings onClose={() => { setShowSettings(false); window.dispatchEvent(new Event('pos-settings-changed')); }} cashierId={currentCashier?.id} />}

      {/* Keyboard shortcuts help */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-sm space-y-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-supermarket" />
              <h2 className="font-cairo font-black text-lg">اختصارات لوحة المفاتيح</h2>
            </div>
            <div className="space-y-1">
              <p className="font-cairo text-xs text-muted-foreground mb-2">الاختصارات الأساسية:</p>
              {Object.entries(defaultShortcuts).map(([key, action]) => (
                <div key={key} className="flex justify-between font-cairo text-sm p-2 bg-secondary rounded">
                  <span className="font-mono font-bold text-xs bg-muted px-2 py-0.5 rounded">{key}</span>
                  <span className="text-muted-foreground text-xs">{ACTION_LABELS[action] || action}</span>
                </div>
              ))}
              <div className="flex justify-between font-cairo text-sm p-2 bg-secondary rounded">
                <span className="font-mono font-bold text-xs bg-muted px-2 py-0.5 rounded">F11</span>
                <span className="text-muted-foreground text-xs">ملء الشاشة</span>
              </div>

              {getCustomShortcuts(currentCashier?.id).length > 0 && (
                <>
                  <p className="font-cairo text-xs text-muted-foreground mt-3 mb-2">اختصارات مخصصة:</p>
                  {getCustomShortcuts(currentCashier?.id).map(s => (
                    <div key={s.id} className="flex justify-between font-cairo text-sm p-2 bg-supermarket/10 rounded">
                      <span className="font-mono font-bold text-xs bg-muted px-2 py-0.5 rounded">{s.key}</span>
                      <span className="text-muted-foreground text-xs">{s.label}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
            <button onClick={() => setShowShortcuts(false)} className="w-full py-2 rounded font-cairo font-bold text-sm bg-secondary hover:bg-muted transition-colors">إغلاق</button>
          </div>
        </div>
      )}

      {/* Cashier Sales History */}
      {showCashierSales && cashierPerms?.canViewSales && (
        <CashierSalesPanel
          cashierId={currentCashier?.id}
          cashierName={currentCashier?.name}
          canReturn={cashierPerms?.canReturn}
          sessionLoginTime={currentSession?.loginTime}
          onClose={() => setShowCashierSales(false)}
        />
      )}

      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-sm space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
                <LogOut className="w-7 h-7 text-destructive" />
              </div>
              <h2 className="font-cairo font-black text-lg">إغلاق الشيفت</h2>
              <p className="font-cairo text-sm text-muted-foreground">هل أنت متأكد من إغلاق الشيفت؟</p>
            </div>
            <div className="bg-secondary rounded-lg p-3 space-y-1">
              <div className="flex justify-between font-cairo text-sm">
                <span className="text-muted-foreground">الكاشير:</span>
                <span className="font-bold">{currentCashier?.name}</span>
              </div>
              {cashierPerms?.showSalesCount && (
                <div className="flex justify-between font-cairo text-sm">
                  <span className="text-muted-foreground">عدد الفواتير:</span>
                  <span className="font-bold">{salesCount}</span>
                </div>
              )}
              {cashierPerms?.showSalesTotal && (
                <div className="flex justify-between font-cairo text-sm">
                  <span className="text-muted-foreground">إجمالي المبيعات:</span>
                  <span className="font-bold text-supermarket">{salesTotalAmount} ج.م</span>
                </div>
              )}
              {cashierPerms?.showReturns && cashierReturns.length > 0 && (
                <div className="flex justify-between font-cairo text-sm">
                  <span className="text-muted-foreground">عدد المرتجعات:</span>
                  <span className="font-bold text-destructive">{cashierReturns.length} ({cashierReturns.reduce((s, r) => s + r.total, 0)} ج.م)</span>
                </div>
              )}
            </div>

            {logoutError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded text-destructive text-xs font-cairo">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {logoutError}
              </div>
            )}

            {!logoutError?.includes('فاتورة معلقة') && (
              <div>
                <label className="font-cairo text-sm text-muted-foreground block mb-1">اكتب اسمك لتأكيد الإغلاق</label>
                <input
                  type="text" value={logoutName}
                  onChange={e => { setLogoutName(e.target.value); setLogoutError(''); }}
                  className="w-full h-11 px-4 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
                  placeholder={`اكتب "${currentCashier?.name}" للتأكيد`} autoFocus
                />
              </div>
            )}
            
            <div className="flex gap-3">
              <button onClick={() => { setShowLogoutConfirm(false); setLogoutError(''); }} className="flex-1 py-3 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground hover:text-foreground transition-colors">إلغاء</button>
              {!logoutError?.includes('فاتورة معلقة') && (
                <button onClick={handleLogoutConfirm} className="flex-1 flex items-center justify-center gap-2 py-3 rounded font-cairo font-bold text-sm bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity">
                  <CheckCircle className="w-4 h-4" />تأكيد الإغلاق
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Cashier Sales Panel with return tracking
const CashierSalesPanel = ({ cashierId, cashierName, canReturn, sessionLoginTime, onClose }: { cashierId?: string; cashierName?: string; canReturn?: boolean; sessionLoginTime?: number; onClose: () => void }) => {
  const allSales = getSales();
  // Only show sales from the CURRENT shift (after session login time)
  const mySales = useMemo(() => allSales.filter(s => s.cashierId === cashierId && (!sessionLoginTime || s.timestamp >= sessionLoginTime)).reverse().slice(0, 50), [allSales, cashierId, sessionLoginTime]);
  const [expandedSale, setExpandedSale] = useState<string | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);

  const handleReturn = (ret: SaleReturn) => {
    addReturn(ret);
    setReturnSale(null);
  };

  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border p-5 w-full max-w-lg space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-cairo font-black text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-supermarket" />
            فواتيري ({mySales.length})
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl font-bold">✕</button>
        </div>

        <div className="space-y-2">
          {mySales.map(sale => {
            const returnedQtys = getReturnedQtysForSale(sale.id);
            const allReturned = sale.items.every(item => (returnedQtys[item.product.id] || 0) >= item.qty);
            const hasPartialReturn = Object.values(returnedQtys).some(q => q > 0);

            return (
              <div key={sale.id} className={`rounded-lg overflow-hidden border ${allReturned ? 'bg-destructive/5 border-destructive/30' : hasPartialReturn ? 'bg-cafe/5 border-cafe/30' : 'bg-secondary border-border'}`}>
                <button
                  onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>{sale.mode === 'supermarket' ? '🛒' : '☕'}</span>
                    <span className="font-cairo font-bold text-sm">#{sale.invoiceNumber || sale.id.slice(0, 6)}</span>
                    <span className="text-xs text-muted-foreground">{sale.items.length} منتج</span>
                    {allReturned && <span className="text-[10px] bg-destructive/20 text-destructive px-1 rounded font-cairo">مُرتجع ✓</span>}
                    {hasPartialReturn && !allReturned && <span className="text-[10px] bg-cafe/20 text-cafe px-1 rounded font-cairo">مرتجع جزئي</span>}
                    {sale.discount && <span className="text-[10px] bg-success/20 text-success px-1 rounded font-cairo">خصم</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-left">
                      <div className="font-cairo font-black text-sm text-supermarket">{sale.total} ج.م</div>
                      <div className="text-[10px] text-muted-foreground">{sale.time} - {sale.date}</div>
                    </div>
                    {expandedSale === sale.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </div>
                </button>
                {expandedSale === sale.id && (
                  <div className="border-t border-border p-3 space-y-2">
                    {sale.items.map((item, idx) => {
                      const returnedQty = returnedQtys[item.product.id] || 0;
                      return (
                        <div key={idx} className="flex justify-between font-cairo text-xs">
                          <span className="flex items-center gap-1">
                            {item.product.name} × {item.qty}
                            {returnedQty > 0 && (
                              <span className="text-destructive text-[10px]">(مُرتجع: {returnedQty})</span>
                            )}
                          </span>
                          <span className="font-bold">{item.qty * item.product.price} ج.م</span>
                        </div>
                      );
                    })}
                    {sale.discount && (
                      <div className="text-xs text-success font-cairo font-bold">
                        خصم: {sale.discount.type === 'percent' ? `${sale.discount.value}%` : `${sale.discount.amount} ج.م`} (-{sale.discount.amount} ج.م)
                      </div>
                    )}
                    {canReturn && !allReturned && (
                      <button
                        onClick={() => setReturnSale(sale)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-destructive text-destructive-foreground rounded font-cairo font-bold text-xs hover:opacity-90 mt-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        مرتجع
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {mySales.length === 0 && (
            <div className="text-center text-muted-foreground py-8 font-cairo text-sm">لا توجد فواتير</div>
          )}
        </div>
      </div>

      {returnSale && (
        <ReturnDialog
          sale={returnSale}
          onClose={() => setReturnSale(null)}
          onReturn={handleReturn}
          cashierName={cashierName}
          cashierId={cashierId}
        />
      )}
    </div>
  );
};

// Resizable Invoice Panel wrapper
const ResizableInvoice = ({ cart, updateQty, removeItem, clearCart, handlePay, cashierId, cashierName, onRecallInvoice, canReturn, canDiscount, canHold }: {
  cart: CartItem[];
  updateQty: (id: string, d: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  handlePay: (discount?: DiscountInfo) => void;
  cashierId?: string;
  cashierName?: string;
  onRecallInvoice?: (items: CartItem[], discount?: DiscountInfo) => void;
  canReturn?: boolean;
  canDiscount?: boolean;
  canHold?: boolean;
}) => {
  const [width, setWidth] = useState(() => {
    try { return Number(localStorage.getItem('pos_invoice_width')) || 340; } catch { return 340; }
  });
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - ev.clientX;
      const newW = Math.max(220, Math.min(600, startW.current + delta));
      setWidth(newW);
    };
    const onUp = () => {
      isDragging.current = false;
      localStorage.setItem('pos_invoice_width', String(width));
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex h-full" style={{ width }}>
      <div onMouseDown={handleMouseDown} className="w-2 cursor-col-resize flex items-center justify-center hover:bg-primary/20 transition-colors group shrink-0" title="اسحب لتغيير حجم الفاتورة">
        <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="flex-1 min-w-0">
        <InvoicePanel
          items={cart} onUpdateQty={updateQty} onRemoveItem={removeItem} onClear={clearCart}
          onPay={handlePay} cashierId={cashierId} cashierName={cashierName}
          onRecallInvoice={onRecallInvoice} canReturn={canReturn}
          canDiscount={canDiscount} canHold={canHold}
        />
      </div>
    </div>
  );
};

export default POSPage;
