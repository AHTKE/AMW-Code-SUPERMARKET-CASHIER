import { useState, useRef } from 'react';
import { Product, POSMode } from '@/types/pos';
import { getProducts, addProduct, updateProduct, deleteProduct } from '@/lib/store';
import { getCategories } from '@/lib/settings';
import { Plus, Pencil, Trash2, Search, X, Camera, ScanBarcode } from 'lucide-react';
import CameraScanner from '@/components/pos/CameraScanner';

const ProductManager = () => {
  const [products, setProducts] = useState<Product[]>(getProducts());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<POSMode | 'all'>('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBarcodeCamera, setShowBarcodeCamera] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const filtered = products.filter(p => {
    const matchType = typeFilter === 'all' || p.type === typeFilter;
    const matchSearch = !search || p.name.includes(search) || p.barcode?.includes(search) || p.category.includes(search);
    return matchType && matchSearch;
  });

  const [form, setForm] = useState<Partial<Product>>({
    name: '', barcode: '', price: 0, costPrice: 0, stock: 0, category: '', type: 'supermarket',
  });

  const openNew = () => {
    setForm({ name: '', barcode: '', price: 0, costPrice: 0, stock: 0, category: '', type: 'supermarket' });
    setEditing(null);
    setShowForm(true);
    setShowBarcodeCamera(false);
  };

  const openEdit = (p: Product) => {
    setForm({ ...p });
    setEditing(p);
    setShowForm(true);
    setShowBarcodeCamera(false);
  };

  const handleSave = () => {
    if (!form.name || !form.price) return;
    if (editing) {
      const updated = { ...editing, ...form } as Product;
      const newProducts = updateProduct(updated);
      setProducts(newProducts);
    } else {
      const newProduct: Product = {
        id: crypto.randomUUID(),
        name: form.name!,
        barcode: form.barcode?.trim() || undefined,
        price: form.price!,
        costPrice: form.costPrice || 0,
        stock: form.stock || 0,
        category: form.category || 'عام',
        type: form.type as POSMode || 'supermarket',
      };
      const newProducts = addProduct(newProduct);
      setProducts(newProducts);
    }
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    const newProducts = deleteProduct(id);
    setProducts(newProducts);
  };

  const handleBarcodeScan = (code: string) => {
    const cleaned = code.trim().replace(/[^\d]/g, '');
    setForm({ ...form, barcode: cleaned });
    setShowBarcodeCamera(false);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الباركود..."
            className="w-full h-10 pr-10 pl-4 bg-secondary rounded font-tajawal text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-supermarket"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as POSMode | 'all')}
          className="h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none"
        >
          <option value="all">الكل</option>
          <option value="supermarket">سوبرماركت</option>
          <option value="cafe">كافيه</option>
        </select>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          إضافة منتج
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-cairo font-bold text-lg">{editing ? 'تعديل منتج' : 'إضافة منتج جديد'}</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="font-cairo text-sm text-muted-foreground">اسم المنتج *</label>
                <input
                  value={form.name || ''}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                />
              </div>
              <div>
                <label className="font-cairo text-sm text-muted-foreground">الباركود</label>
                <div className="flex gap-2 mt-1">
                  <input
                    ref={barcodeInputRef}
                    value={form.barcode || ''}
                    onChange={e => setForm({ ...form, barcode: e.target.value })}
                    className="flex-1 h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
                    placeholder="امسح الباركود أو اكتب الرقم"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBarcodeCamera(!showBarcodeCamera)}
                    className={`h-10 px-3 rounded font-cairo text-sm font-bold transition-colors ${
                      showBarcodeCamera
                        ? 'bg-supermarket text-supermarket-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                    title="مسح بالكاميرا"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>
                {showBarcodeCamera && (
                  <div className="mt-2">
                    <CameraScanner onScan={handleBarcodeScan} active={true} />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-cairo text-sm text-muted-foreground">سعر البيع *</label>
                  <input
                    type="number"
                    value={form.price || ''}
                    onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                    className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                  />
                </div>
                <div>
                  <label className="font-cairo text-sm text-muted-foreground">سعر الشراء</label>
                  <input
                    type="number"
                    value={form.costPrice || ''}
                    onChange={e => setForm({ ...form, costPrice: Number(e.target.value) })}
                    className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-cairo text-sm text-muted-foreground">المخزون</label>
                  <input
                    type="number"
                    value={form.stock || ''}
                    onChange={e => setForm({ ...form, stock: Number(e.target.value) })}
                    className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                  />
                </div>
              <div>
                  <label className="font-cairo text-sm text-muted-foreground">التصنيف</label>
                  <select
                    value={form.category || ''}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket mt-1"
                  >
                    <option value="">اختر التصنيف</option>
                    {getCategories((form.type as POSMode) || 'supermarket').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="font-cairo text-sm text-muted-foreground">النوع</label>
                <select
                  value={form.type || 'supermarket'}
                  onChange={e => setForm({ ...form, type: e.target.value as POSMode, category: '' })}
                  className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none mt-1"
                >
                  <option value="supermarket">سوبرماركت</option>
                  <option value="cafe">كافيه</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleSave}
              className="w-full py-3 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90 transition-opacity"
            >
              {editing ? 'حفظ التعديلات' : 'إضافة المنتج'}
            </button>
          </div>
        </div>
      )}

      {/* Products table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-right font-cairo py-2 px-2">المنتج</th>
              <th className="text-center font-cairo py-2 px-2">الباركود</th>
              <th className="text-center font-cairo py-2 px-2">السعر</th>
              <th className="text-center font-cairo py-2 px-2">التكلفة</th>
              <th className="text-center font-cairo py-2 px-2">المخزون</th>
              <th className="text-center font-cairo py-2 px-2">النوع</th>
              <th className="text-center font-cairo py-2 px-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30">
                <td className="py-2 px-2 font-cairo font-bold">{p.name}</td>
                <td className="py-2 px-2 text-center font-mono text-xs text-muted-foreground">{p.barcode || '-'}</td>
                <td className="py-2 px-2 text-center font-cairo font-bold text-supermarket">{p.price} ج.م</td>
                <td className="py-2 px-2 text-center text-muted-foreground">{p.costPrice || '-'}</td>
                <td className={`py-2 px-2 text-center font-bold ${p.stock < 10 ? 'text-destructive' : 'text-success'}`}>{p.stock}</td>
                <td className="py-2 px-2 text-center">{p.type === 'supermarket' ? '🛒' : '☕'}</td>
                <td className="py-2 px-2 text-center">
                  <div className="flex justify-center gap-1">
                    <button onClick={() => openEdit(p)} className="p-1 hover:bg-secondary rounded"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1 hover:bg-destructive/20 rounded"><Trash2 className="w-4 h-4 text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-8 font-cairo">لا توجد منتجات</div>
        )}
      </div>
    </div>
  );
};

export default ProductManager;
