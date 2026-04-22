import { useState } from 'react';
import { POSMode } from '@/types/pos';
import { getCategories, saveCategories } from '@/lib/settings';
import { Plus, Trash2, X, Tag } from 'lucide-react';

const CategoryManager = () => {
  const [type, setType] = useState<POSMode>('supermarket');
  const [categories, setCategories] = useState<string[]>(getCategories(type));
  const [newCat, setNewCat] = useState('');

  const switchType = (t: POSMode) => {
    setType(t);
    setCategories(getCategories(t));
    setNewCat('');
  };

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    const updated = [...categories, trimmed];
    setCategories(updated);
    saveCategories(type, updated);
    setNewCat('');
  };

  const handleDelete = (cat: string) => {
    const updated = categories.filter(c => c !== cat);
    setCategories(updated);
    saveCategories(type, updated);
  };

  return (
    <div className="space-y-4">
      <h2 className="font-cairo font-black text-xl flex items-center gap-2">
        <Tag className="w-5 h-5" />
        إدارة التصنيفات
      </h2>

      <div className="flex gap-2">
        <button
          onClick={() => switchType('supermarket')}
          className={`px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${
            type === 'supermarket' ? 'bg-supermarket text-supermarket-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          🛒 سوبرماركت
        </button>
        <button
          onClick={() => switchType('cafe')}
          className={`px-4 py-2 rounded font-cairo font-bold text-sm transition-colors ${
            type === 'cafe' ? 'bg-cafe text-cafe-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          ☕ كافيه
        </button>
      </div>

      {/* Add new category */}
      <div className="flex gap-2">
        <input
          value={newCat}
          onChange={e => setNewCat(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="flex-1 h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
          placeholder="اسم التصنيف الجديد..."
        />
        <button
          onClick={handleAdd}
          disabled={!newCat.trim()}
          className="flex items-center gap-1 px-4 h-10 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm hover:opacity-90 disabled:opacity-30"
        >
          <Plus className="w-4 h-4" />
          إضافة
        </button>
      </div>

      {/* Categories list */}
      <div className="space-y-2">
        {categories.map(cat => (
          <div key={cat} className="flex items-center justify-between p-3 bg-card rounded-lg border border-border">
            <span className="font-cairo font-bold">{cat}</span>
            <button
              onClick={() => handleDelete(cat)}
              className="p-1 hover:bg-destructive/20 rounded"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="text-center text-muted-foreground py-4 font-cairo">لا توجد تصنيفات</div>
        )}
      </div>
    </div>
  );
};

export default CategoryManager;
