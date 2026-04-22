import { Product } from '@/types/pos';

export const SUPERMARKET_PRODUCTS: Product[] = [
  { id: 's1', name: 'شيبسي ليز', barcode: '6221033001015', price: 15, stock: 50, category: 'سناكس', type: 'supermarket' },
  { id: 's2', name: 'بيبسي 330مل', barcode: '6221001420101', price: 10, stock: 100, category: 'مشروبات', type: 'supermarket' },
  { id: 's3', name: 'حليب جهينة 1لتر', barcode: '6221001100101', price: 35, stock: 30, category: 'ألبان', type: 'supermarket' },
  { id: 's4', name: 'خبز أبيض', barcode: '6221001500201', price: 5, stock: 200, category: 'مخبوزات', type: 'supermarket' },
  { id: 's5', name: 'بسكويت أولكر', barcode: '8690504011019', price: 12, stock: 60, category: 'سناكس', type: 'supermarket' },
  { id: 's6', name: 'ماء معدني 1.5لتر', barcode: '6221001300101', price: 8, stock: 80, category: 'مشروبات', type: 'supermarket' },
  { id: 's7', name: 'أرز بسمتي 1كجم', barcode: '6291001010101', price: 45, stock: 25, category: 'بقالة', type: 'supermarket' },
  { id: 's8', name: 'زيت عباد شمس 1لتر', barcode: '6221001200301', price: 55, stock: 20, category: 'بقالة', type: 'supermarket' },
];

export const CAFE_PRODUCTS: Product[] = [
  { id: 'c1', name: 'قهوة تركي', price: 20, stock: 999, category: 'مشروبات ساخنة', type: 'cafe' },
  { id: 'c2', name: 'كابتشينو', price: 30, stock: 999, category: 'مشروبات ساخنة', type: 'cafe' },
  { id: 'c3', name: 'لاتيه', price: 35, stock: 999, category: 'مشروبات ساخنة', type: 'cafe' },
  { id: 'c4', name: 'موكا', price: 35, stock: 999, category: 'مشروبات ساخنة', type: 'cafe' },
  { id: 'c5', name: 'شاي أحمر', price: 10, stock: 999, category: 'مشروبات ساخنة', type: 'cafe' },
  { id: 'c6', name: 'شاي أخضر', price: 12, stock: 999, category: 'مشروبات ساخنة', type: 'cafe' },
  { id: 'c7', name: 'عصير برتقال', price: 25, stock: 999, category: 'مشروبات باردة', type: 'cafe' },
  { id: 'c8', name: 'عصير مانجو', price: 25, stock: 999, category: 'مشروبات باردة', type: 'cafe' },
  { id: 'c9', name: 'سموثي فراولة', price: 30, stock: 999, category: 'مشروبات باردة', type: 'cafe' },
  { id: 'c10', name: 'آيس كوفي', price: 30, stock: 999, category: 'مشروبات باردة', type: 'cafe' },
  { id: 'c11', name: 'كرواسون', price: 20, stock: 50, category: 'حلويات', type: 'cafe' },
  { id: 'c12', name: 'كيكة شوكولاتة', price: 25, stock: 30, category: 'حلويات', type: 'cafe' },
];
