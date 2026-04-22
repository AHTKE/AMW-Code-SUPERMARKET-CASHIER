import { useState, useMemo, useEffect } from 'react';
import { Product } from '@/types/pos';
import { getProducts } from '@/lib/store';
import { Search } from 'lucide-react';

interface CafeModeProps {
  onAddToCart: (product: Product) => void;
}

const ITEMS_PER_PAGE_KEY = 'pos_cafe_items_per_page';

const getItemsPerPage = (): number => {
  try {
    const v = localStorage.getItem(ITEMS_PER_PAGE_KEY);
    return v ? Number(v) : 12;
  } catch { return 12; }
};

const saveItemsPerPage = (n: number) => {
  localStorage.setItem(ITEMS_PER_PAGE_KEY, String(n));
};

const CafeMode = ({ onAddToCart }: CafeModeProps) => {
  const products = getProducts().filter(p => p.type === 'cafe');
  const categories = ['الكل', ...new Set(products.map(p => p.category))];
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [perPage, setPerPage] = useState(getItemsPerPage());
  const [showPerPageSetting, setShowPerPageSetting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let result = activeCategory === 'الكل' ? products : products.filter(p => p.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.barcode?.includes(q));
    }
    return result;
  }, [products, activeCategory, searchQuery]);

  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(filtered.length / perPage);
  const pageItems = filtered.slice(page * perPage, (page + 1) * perPage);

  // Listen for page/category navigation events
  useEffect(() => {
    const handleNextPage = () => setPage(p => Math.min(totalPages - 1, p + 1));
    const handlePrevPage = () => setPage(p => Math.max(0, p - 1));
    const handleNextCategory = () => {
      const idx = categories.indexOf(activeCategory);
      if (idx < categories.length - 1) { setActiveCategory(categories[idx + 1]); setPage(0); }
    };
    const handlePrevCategory = () => {
      const idx = categories.indexOf(activeCategory);
      if (idx > 0) { setActiveCategory(categories[idx - 1]); setPage(0); }
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

  const handlePerPageChange = (n: number) => {
    const val = Math.max(4, Math.min(50, n));
    setPerPage(val);
    saveItemsPerPage(val);
    setPage(0);
  };

  const cols = perPage <= 8 ? 2 : perPage <= 16 ? 3 : perPage <= 30 ? 4 : 5;

  return (
    <div className="flex flex-col h-full p-3 gap-2 flip-enter">
      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
          placeholder="ابحث عن مشروب أو منتج..."
          className="w-full h-9 pr-9 pl-3 bg-secondary rounded-lg font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-cafe"
        />
      </div>

      {/* Category tabs + per-page setting */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto flex-1 pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); setPage(0); }}
              className={`px-3 py-1.5 rounded font-cairo font-bold text-xs transition-colors whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-cafe text-cafe-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowPerPageSetting(!showPerPageSetting)}
          className="px-2 py-1.5 bg-secondary rounded font-cairo text-xs font-bold text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="عدد العناصر في الصفحة"
        >
          📄 {perPage}
        </button>
      </div>

      {/* Per-page setting */}
      {showPerPageSetting && (
        <div className="flex items-center gap-2 bg-secondary rounded-lg p-2">
          <span className="font-cairo text-xs text-muted-foreground">عدد العناصر:</span>
          <div className="flex gap-1">
            {[6, 8, 12, 16, 20, 30].map(n => (
              <button
                key={n}
                onClick={() => handlePerPageChange(n)}
                className={`px-2 py-1 rounded text-xs font-cairo font-bold transition-colors ${
                  perPage === n ? 'bg-cafe text-cafe-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <input
            type="number"
            min={4}
            max={50}
            value={perPage}
            onChange={e => handlePerPageChange(Number(e.target.value))}
            className="w-14 h-7 px-2 bg-muted rounded text-xs font-cairo text-center focus:outline-none focus:ring-1 focus:ring-cafe"
          />
        </div>
      )}

      {/* Products grid */}
      <div 
        className="flex-1 grid gap-1.5 overflow-auto"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: '1fr',
        }}
      >
        {pageItems.map(product => (
          <button
            key={product.id}
            onClick={() => onAddToCart(product)}
            className="flex flex-col items-center justify-center bg-secondary hover:bg-cafe/20 rounded-lg transition-colors active:scale-95 p-1.5 min-h-0"
          >
            <span className="font-cairo font-bold text-xs leading-tight text-center line-clamp-2">{product.name}</span>
            <span className="font-cairo font-black text-cafe text-sm mt-0.5">{product.price} ج.م</span>
          </button>
        ))}
        {pageItems.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-8 font-cairo text-sm">لا توجد منتجات في هذا التصنيف</div>
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
          <span className="text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="px-3 py-1 rounded bg-secondary hover:bg-muted disabled:opacity-30 font-bold"
          >
            التالي
          </button>
        </div>
      )}

      {/* Designer credit */}
      <div className="text-center py-1">
        <span className="font-cairo text-[10px] text-muted-foreground">تحت رعاية أحمد محمد وهبة</span>
      </div>
    </div>
  );
};

export default CafeMode;
