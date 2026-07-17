import { useState, useRef, useEffect } from 'react';
import { Product, POSMode } from '@/types/pos';
import { getProducts, addProduct, updateProduct, deleteProduct } from '@/lib/store';
import { getCategories } from '@/lib/settings';
import { Plus, Pencil, Trash2, Search, X, Camera, ScanBarcode, Sparkles, Printer } from 'lucide-react';
import CameraScanner from '@/components/pos/CameraScanner';
import { generateUniqueInternalBarcode } from '@/lib/barcodeGenerator';
import { printBarcodeLabel } from '@/lib/printBarcode';


const ProductManager = () => {
  const [products, setProducts] = useState<Product[]>(getProducts());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<POSMode | 'all'>('all');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  // scan target index: 0 = primary barcode, 1..N = extraBarcodes[index-1], null = camera closed
  const [scanTargetIdx, setScanTargetIdx] = useState<number | null>(null);
  const barcodeRefs = useRef<Array<HTMLInputElement | null>>([]);

  const filtered = products.filter(p => {
    const matchType = typeFilter === 'all' || p.type === typeFilter;
    const codes = [p.barcode, ...(p.barcodes || [])].filter(Boolean).join(' ');
    const matchSearch = !search || p.name.includes(search) || codes.includes(search) || p.category.includes(search);
    return matchType && matchSearch;
  });

  const [form, setForm] = useState<Partial<Product>>({
    name: '', barcode: '', costPrice: 0, price: 0, stock: 0, category: '', type: 'supermarket',
  });
  const [extraBarcodes, setExtraBarcodes] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  const focusBarcode = (idx: number) => {
    setTimeout(() => barcodeRefs.current[idx]?.focus(), 50);
  };

  const openNew = () => {
    setForm({ name: '', barcode: '', costPrice: 0, price: 0, stock: 0, category: '', type: 'supermarket' });
    setExtraBarcodes([]);
    setEditing(null);
    setFormError('');
    setShowForm(true);
    setScanTargetIdx(null);
    focusBarcode(0);
  };

  const openEdit = (p: Product) => {
    setForm({ ...p });
    setExtraBarcodes(p.barcodes ? [...p.barcodes] : []);
    setEditing(p);
    setFormError('');
    setShowForm(true);
    setScanTargetIdx(null);
    focusBarcode(0);
  };

  const handleSave = () => {
    setFormError('');
    if (!form.name || !form.price) {
      setFormError('اسم المنتج وسعر البيع مطلوبين');
      return;
    }

    const primary = (form.barcode || '').trim();
    const cleanExtras = extraBarcodes.map(b => b.trim());

    // Validate: no empty extra barcodes
    if (cleanExtras.some(b => !b)) {
      setFormError('في حقل باركود فاضي. اكتب رقم صحيح أو احذفه.');
      return;
    }

    // Validate: no in-form duplicates
    const allCodes = [primary, ...cleanExtras].filter(Boolean);
    const seen = new Set<string>();
    for (const c of allCodes) {
      if (seen.has(c)) {
        setFormError(`الباركود ${c} مكرر في نفس المنتج.`);
        return;
      }
      seen.add(c);
    }

    // Validate: not used by a different product
    for (const c of allCodes) {
      const clash = products.find(p => {
        if (editing && p.id === editing.id) return false;
        const codes = [p.barcode, ...(p.barcodes || [])].filter(Boolean) as string[];
        return codes.includes(c);
      });
      if (clash) {
        setFormError(`الباركود ${c} مستخدم بالفعل في المنتج «${clash.name}».`);
        return;
      }
    }

    const finalExtras = cleanExtras.filter(Boolean);
    if (editing) {
      const updated: Product = {
        ...editing,
        ...form,
        barcode: primary || undefined,
        barcodes: finalExtras.length > 0 ? finalExtras : undefined,
      } as Product;
      const newProducts = updateProduct(updated);
      setProducts(newProducts);
    } else {
      const newProduct: Product = {
        id: crypto.randomUUID(),
        name: form.name!,
        barcode: primary || undefined,
        barcodes: finalExtras.length > 0 ? finalExtras : undefined,
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

  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);

  const handleDelete = (p: Product) => {
    setConfirmDelete(p);
  };

  const confirmDeleteNow = () => {
    if (!confirmDelete) return;
    const newProducts = deleteProduct(confirmDelete.id);
    setProducts(newProducts);
    setConfirmDelete(null);
  };

  const handleGenerateBarcode = () => {
    const code = generateUniqueInternalBarcode();
    const primary = (form.barcode || '').trim();
    if (!primary) {
      setForm(f => ({ ...f, barcode: code }));
    } else {
      setExtraBarcodes(prev => [...prev, code]);
    }
    setFormError('');
  };

  const handlePrintCurrent = () => {
    const primary = (form.barcode || '').trim();
    const code = primary || extraBarcodes.find(b => b.trim())?.trim();
    if (!code) {
      setFormError('مفيش باركود للطباعة. اعمل توليد أو اكتب رقم الأول.');
      return;
    }
    printBarcodeLabel({ barcode: code, productName: form.name || 'منتج', price: form.price });
  };


  const handleBarcodeScan = (code: string) => {
    const cleaned = code.trim().replace(/[^\d]/g, '');
    if (!cleaned) {
      setFormError('الباركود اللي اتقرأ فاضي.');
      return;
    }

    // Duplicate check against other products
    const clash = products.find(p => {
      if (editing && p.id === editing.id) return false;
      const codes = [p.barcode, ...(p.barcodes || [])].filter(Boolean) as string[];
      return codes.includes(cleaned);
    });
    if (clash) {
      setFormError(`الباركود ${cleaned} مستخدم بالفعل في المنتج «${clash.name}».`);
      setScanTargetIdx(null);
      return;
    }

    // Duplicate check inside current form
    const currentCodes = [
      scanTargetIdx === 0 ? '' : (form.barcode || '').trim(),
      ...extraBarcodes.map((b, i) => (i + 1 === scanTargetIdx ? '' : b.trim())),
    ].filter(Boolean);
    if (currentCodes.includes(cleaned)) {
      setFormError(`الباركود ${cleaned} مكرر في نفس المنتج.`);
      setScanTargetIdx(null);
      return;
    }

    setFormError('');
    if (scanTargetIdx === null || scanTargetIdx === 0) {
      setForm(f => ({ ...f, barcode: cleaned }));
    } else {
      setExtraBarcodes(prev => {
        const next = [...prev];
        next[scanTargetIdx - 1] = cleaned;
        return next;
      });
    }
    setScanTargetIdx(null);
  };

  const addExtraBarcode = () => {
    setExtraBarcodes(prev => {
      const next = [...prev, ''];
      // Auto-focus the newly added field so scanner writes into it
      setTimeout(() => barcodeRefs.current[next.length]?.focus(), 50);
      return next;
    });
  };

  const removeExtraBarcode = (idx: number) => {
    setExtraBarcodes(prev => prev.filter((_, i) => i !== idx));
    if (scanTargetIdx === idx + 1) setScanTargetIdx(null);
  };

  const updateExtraBarcode = (idx: number, val: string) => {
    setExtraBarcodes(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const toggleScanTarget = (idx: number) => {
    setScanTargetIdx(prev => (prev === idx ? null : idx));
    focusBarcode(idx);
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

              {/* Barcodes - primary + extras (all point to the SAME product) */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="font-cairo text-sm text-muted-foreground">الباركود</label>
                  <span className="font-cairo text-[10px] text-muted-foreground">
                    كل الباركودات دي بتوصّل لنفس المنتج والسعر
                  </span>
                </div>

                {/* Primary barcode */}
                <div className="flex gap-2 mt-1">
                  <input
                    ref={el => { barcodeRefs.current[0] = el; }}
                    value={form.barcode || ''}
                    onChange={e => setForm({ ...form, barcode: e.target.value })}
                    onFocus={() => { /* keep camera closed unless explicitly opened */ }}
                    className="flex-1 h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
                    placeholder="الباركود الأساسي (سكانر أو يدوي)"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => toggleScanTarget(0)}
                    className={`h-10 px-3 rounded font-cairo text-sm font-bold transition-colors ${
                      scanTargetIdx === 0
                        ? 'bg-supermarket text-supermarket-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                    title="مسح بالكاميرا"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>

                {/* Extra barcodes */}
                {extraBarcodes.map((code, i) => (
                  <div key={i} className="flex gap-2 mt-2">
                    <input
                      ref={el => { barcodeRefs.current[i + 1] = el; }}
                      value={code}
                      onChange={e => updateExtraBarcode(i, e.target.value)}
                      className="flex-1 h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
                      placeholder={`باركود إضافي #${i + 2} (نفس المنتج)`}
                    />
                    <button
                      type="button"
                      onClick={() => toggleScanTarget(i + 1)}
                      className={`h-10 px-3 rounded font-cairo text-sm font-bold transition-colors ${
                        scanTargetIdx === i + 1
                          ? 'bg-supermarket text-supermarket-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                      title="مسح بالكاميرا"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeExtraBarcode(i)}
                      className="h-10 px-2 rounded bg-destructive/20 text-destructive hover:bg-destructive/30"
                      title="حذف الباركود ده"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={addExtraBarcode}
                    className="flex items-center gap-2 px-3 py-1.5 bg-supermarket/20 text-supermarket rounded font-cairo font-bold text-xs hover:bg-supermarket/30 transition-colors"
                  >
                    <ScanBarcode className="w-4 h-4" />
                    + باركود إضافي
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="flex items-center gap-2 px-3 py-1.5 bg-success/20 text-success rounded font-cairo font-bold text-xs hover:bg-success/30 transition-colors"
                    title="توليد باركود داخلي فريد للمنتجات اللي ملهاش باركود مصنع"
                  >
                    <Sparkles className="w-4 h-4" />
                    توليد باركود
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintCurrent}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/20 text-primary rounded font-cairo font-bold text-xs hover:bg-primary/30 transition-colors"
                    title="طباعة الباركود على طابعة حرارية"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة
                  </button>
                </div>


                {scanTargetIdx !== null && (
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
            {formError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/15 border border-destructive/40 text-destructive rounded font-cairo text-sm">
                <span className="text-lg leading-none">⚠️</span>
                <span className="flex-1">{formError}</span>
              </div>
            )}
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
            {filtered.map(p => {
              const allCodes = [p.barcode, ...(p.barcodes || [])].filter(Boolean) as string[];
              return (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="py-2 px-2 font-cairo font-bold">{p.name}</td>
                  <td className="py-2 px-2 text-center font-mono text-xs text-muted-foreground">
                    {allCodes.length === 0 ? '-' : (
                      <div className="flex flex-col items-center gap-0.5">
                        {allCodes.map((c, i) => (
                          <span key={i} className={i === 0 ? '' : 'text-[10px] opacity-70'}>{c}</span>
                        ))}
                        {allCodes.length > 1 && (
                          <span className="text-[9px] text-supermarket font-cairo font-bold">{allCodes.length} باركود</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center font-cairo font-bold text-supermarket">{p.price} ج.م</td>
                  <td className="py-2 px-2 text-center text-muted-foreground">{p.costPrice || '-'}</td>
                  <td className={`py-2 px-2 text-center font-bold ${p.stock < 10 ? 'text-destructive' : 'text-success'}`}>{p.stock}</td>
                  <td className="py-2 px-2 text-center">{p.type === 'supermarket' ? '🛒' : '☕'}</td>
                  <td className="py-2 px-2 text-center">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => openEdit(p)} className="p-1 hover:bg-secondary rounded" title="تعديل"><Pencil className="w-4 h-4 text-muted-foreground" /></button>
                      {allCodes.length > 0 && (
                        <button
                          onClick={() => printBarcodeLabel({ barcode: allCodes[0], productName: p.name, price: p.price })}
                          className="p-1 hover:bg-supermarket/20 rounded"
                          title="طباعة باركود"
                        >
                          <Printer className="w-4 h-4 text-supermarket" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(p)} className="p-1 hover:bg-destructive/20 rounded" title="حذف"><Trash2 className="w-4 h-4 text-destructive" /></button>
                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-8 font-cairo">لا توجد منتجات</div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center text-2xl">⚠️</div>
              <h3 className="font-cairo font-bold text-lg">تأكيد الحذف</h3>
            </div>
            <p className="font-cairo text-sm text-muted-foreground">
              هل أنت متأكد من حذف المنتج <span className="font-bold text-foreground">«{confirmDelete.name}»</span>؟
              <br />
              الإجراء ده مش هيتراجع.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded font-cairo font-bold text-sm hover:bg-muted transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={confirmDeleteNow}
                className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded font-cairo font-bold text-sm hover:opacity-90 transition-opacity"
              >
                نعم، احذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default ProductManager;
