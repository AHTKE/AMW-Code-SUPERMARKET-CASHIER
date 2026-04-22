import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Product } from '@/types/pos';
import { getProducts } from '@/lib/store';
import { getSettings } from '@/lib/settings';
import { playSuccessBeep, playErrorBeep } from '@/lib/sound';
import { Search, ScanBarcode } from 'lucide-react';
import CameraScanner from './CameraScanner';
import { getOfferForProduct } from '@/lib/coupons';

interface SupermarketModeProps {
  onAddToCart: (product: Product) => void;
}

const normalizeBarcode = (code: string): string => {
  return code.trim().replace(/[^\d]/g, '');
};

const SupermarketMode = ({ onAddToCart }: SupermarketModeProps) => {
  const [searchInput, setSearchInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [barcodeValue, setBarcodeValue] = useState('');
  const [showBarcodeField, setShowBarcodeField] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyTimestampsRef = useRef<number[]>([]);
  const isScannerDetectedRef = useRef(false);
  const settings = getSettings();

  const products = getProducts().filter(p => p.type === 'supermarket');
  const categories = ['الكل', ...new Set(products.map(p => p.category))];

  const findProduct = useCallback((value: string): Product | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = normalizeBarcode(trimmed);
    const allProducts = getProducts();

    for (const p of allProducts) {
      if (p.barcode && normalizeBarcode(p.barcode) === normalized) return p;
    }
    if (normalized.length >= 8) {
      for (const p of allProducts) {
        if (p.barcode) {
          const pNorm = normalizeBarcode(p.barcode);
          if (pNorm.includes(normalized) || normalized.includes(pNorm)) return p;
        }
      }
    }
    const byId = allProducts.find(p => p.id === trimmed);
    if (byId) return byId;
    const byName = allProducts.find(p => p.name === trimmed);
    if (byName) return byName;
    return null;
  }, []);

  const handleBarcodeScan = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const product = findProduct(trimmed);
    if (product) {
      onAddToCart(product);
      playSuccessBeep();
      setFeedback({ type: 'success', message: `✓ ${product.name} - ${product.price} ج.م` });
      setTimeout(() => setFeedback(null), 1500);
    } else {
      playErrorBeep();
      setFeedback({ type: 'error', message: `✗ لم يتم العثور على منتج: "${trimmed}"` });
      setTimeout(() => setFeedback(null), 2500);
    }
  }, [findProduct, onAddToCart]);

  const handleBarcodeScanRef = useRef(handleBarcodeScan);
  handleBarcodeScanRef.current = handleBarcodeScan;

  const submitBarcode = useCallback((code: string) => {
    if (code.trim()) {
      handleBarcodeScanRef.current(code);
      setBarcodeValue('');
    }
  }, []);

  // Process scanned buffer immediately
  const processBuffer = useCallback(() => {
    const code = scanBufferRef.current.trim();
    if (code.length >= 4) {
      setBarcodeValue(code);
      handleBarcodeScanRef.current(code);
      // Clear the display after a short flash
      setTimeout(() => setBarcodeValue(''), 200);
    }
    scanBufferRef.current = '';
    keyTimestampsRef.current = [];
    isScannerDetectedRef.current = false;
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }, []);

  // Clean leaked scanner chars from an input field
  const cleanLeakedChars = useCallback((element: HTMLInputElement | HTMLTextAreaElement, chars: string) => {
    if (!chars || element === barcodeInputRef.current) return;
    const val = element.value;
    if (val.includes(chars)) {
      const cleaned = val.replace(chars, '');
      const proto = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(element, cleaned);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, []);

  // Global keydown listener - NEVER blocks normal typing
  useEffect(() => {
    if (settings.scanMode === 'camera') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const target = e.target as HTMLElement;

      // If typing in the barcode input field, let it work naturally
      if (target === barcodeInputRef.current) return;

      // Enter key - only intercept if scanner was detected
      if (e.key === 'Enter') {
        if (isScannerDetectedRef.current && scanBufferRef.current.length >= 4) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          // Clean leaked chars from active input
          if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            cleanLeakedChars(target, scanBufferRef.current);
          }
          processBuffer();
        }
        return;
      }

      // Only track printable single chars (digits for barcodes)
      if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;

      // Always let the character through to the focused field
      // We NEVER call preventDefault here for normal typing

      scanBufferRef.current += e.key;
      keyTimestampsRef.current.push(now);

      // Check speed - scanner sends chars extremely fast (< 30ms avg)
      const ts = keyTimestampsRef.current;
      if (ts.length >= 4) {
        let totalInterval = 0;
        for (let i = 1; i < ts.length; i++) totalInterval += ts[i] - ts[i - 1];
        const avg = totalInterval / (ts.length - 1);

        if (avg < 35) {
          isScannerDetectedRef.current = true;
        }
      }

      // Reset idle timer
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(() => {
        if (isScannerDetectedRef.current) {
          const buffered = scanBufferRef.current.trim();
          const digits = normalizeBarcode(buffered);
          
          if (digits.length >= 8 && digits.length <= 14) {
            // Clean leaked chars from whichever field was focused
            const activeEl = document.activeElement;
            if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
              cleanLeakedChars(activeEl, buffered);
            }
            
            // Flash in barcode field and process
            setBarcodeValue(buffered);
            handleBarcodeScanRef.current(buffered);
            setTimeout(() => setBarcodeValue(''), 300);
          }
        }
        // Reset buffer
        scanBufferRef.current = '';
        keyTimestampsRef.current = [];
        isScannerDetectedRef.current = false;
        scanTimerRef.current = null;
      }, 80);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, [settings.scanMode, processBuffer, cleanLeakedChars]);

  const handleCameraScan = (code: string) => {
    handleBarcodeScan(code);
  };

  const ITEMS_PER_PAGE = 20;
  const [page, setPage] = useState(0);

  const categoryFiltered = activeCategory === 'الكل' ? products : products.filter(p => p.category === activeCategory);
  const searchFiltered = searchInput.trim()
    ? categoryFiltered.filter(p =>
        p.name.includes(searchInput) || p.barcode?.includes(searchInput)
      )
    : categoryFiltered;
  
  const totalPages = Math.ceil(searchFiltered.length / ITEMS_PER_PAGE);
  const filteredProducts = searchFiltered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  // Listen for page/category navigation events
  useEffect(() => {
    const handleNextPage = () => setPage(p => Math.min(totalPages - 1, p + 1));
    const handlePrevPage = () => setPage(p => Math.max(0, p - 1));
    const handleNextCategory = () => {
      const idx = categories.indexOf(activeCategory);
      if (idx < categories.length - 1) setActiveCategory(categories[idx + 1]);
    };
    const handlePrevCategory = () => {
      const idx = categories.indexOf(activeCategory);
      if (idx > 0) setActiveCategory(categories[idx - 1]);
    };
    window.addEventListener('pos-next-page', handleNextPage);
    window.addEventListener('pos-prev-page', handlePrevPage);
    window.addEventListener('pos-next-category', handleNextCategory);
    window.addEventListener('pos-prev-category', handlePrevCategory);
    return () => {
      window.removeEventListener('pos-next-page', handleNextPage);
      window.removeEventListener('pos-prev-page', handlePrevPage);
      window.removeEventListener('pos-next-category', handleNextCategory);
      window.removeEventListener('pos-prev-category', handlePrevCategory);
    };
  }, [totalPages, categories, activeCategory]);

  const showCamera = settings.scanMode === 'camera' || settings.scanMode === 'both';

  return (
    <div className="flex flex-col h-full p-4 gap-3 flip-enter">
      {/* Toggle + Barcode input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-muted-foreground font-cairo">الماسح الضوئي جاهز</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showBarcodeField}
              onChange={e => setShowBarcodeField(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-supermarket cursor-pointer"
            />
            <span className="text-xs font-cairo font-bold text-muted-foreground">إظهار حقل الباركود</span>
          </label>
        </div>

        {showBarcodeField && (
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeValue}
                onChange={e => setBarcodeValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitBarcode(barcodeValue);
                  }
                }}
                placeholder="رقم الباركود (سكانر أو يدوي)..."
                className="w-full h-12 pr-12 pl-4 bg-secondary rounded-lg font-cairo text-sm font-bold placeholder:text-muted-foreground placeholder:font-normal placeholder:text-xs focus:outline-none focus:ring-2 focus:ring-supermarket border border-supermarket/30"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {/* Hidden ref input when field is hidden - keeps scanner working */}
        {!showBarcodeField && (
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeValue}
            onChange={() => {}}
            tabIndex={-1}
            className="sr-only"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Camera scanner */}
      {showCamera && (
        <CameraScanner onScan={handleCameraScan} active={true} />
      )}

      {/* Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded font-cairo font-bold text-sm animate-pulse ${
            feedback.type === 'success'
              ? 'bg-success/20 text-success border border-success/30'
              : 'bg-destructive/20 text-destructive border border-destructive/30'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded font-cairo font-bold text-xs transition-colors whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-supermarket text-supermarket-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-muted'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="بحث بالاسم..."
          className="search-input w-full h-10 pr-10 pl-4 bg-secondary rounded font-tajawal text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-supermarket"
        />
      </div>

      {/* Products grid */}
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 auto-rows-min overflow-auto">
        {filteredProducts.map(product => {
          const offer = getOfferForProduct(product.id);
          const offerPrice = offer
            ? offer.discountType === 'percent'
              ? Math.round(product.price * (1 - offer.discountValue / 100))
              : Math.max(0, product.price - offer.discountValue)
            : null;
          return (
            <button
              key={product.id}
              onClick={() => {
                onAddToCart(product);
                playSuccessBeep();
              }}
              className={`flex flex-col items-center justify-center p-3 rounded transition-colors active:scale-95 text-center ${offer ? 'bg-success/10 hover:bg-success/20 border border-success/30' : 'bg-secondary hover:bg-supermarket/20'}`}
            >
              <span className="font-cairo font-bold text-sm">{product.name}</span>
              {offer ? (
                <div className="flex items-center gap-1">
                  <span className="font-cairo text-xs text-muted-foreground line-through">{product.price}</span>
                  <span className="font-cairo font-black text-success text-lg">{offerPrice} ج.م</span>
                </div>
              ) : (
                <span className="font-cairo font-black text-supermarket text-lg">{product.price} ج.م</span>
              )}
              {offer && <span className="text-[10px] text-success font-cairo font-bold">🎁 عرض!</span>}
              {product.barcode && (
                <span className="text-[10px] text-muted-foreground font-mono">{product.barcode}</span>
              )}
              <span className="text-xs text-muted-foreground">مخزون: {product.stock}</span>
            </button>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-8 font-cairo">لا توجد منتجات</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 font-cairo text-xs">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 rounded bg-secondary hover:bg-muted disabled:opacity-30 font-bold"
          >
            السابق
          </button>
          <span className="text-muted-foreground">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="px-3 py-1 rounded bg-secondary hover:bg-muted disabled:opacity-30 font-bold"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
};

export default SupermarketMode;
