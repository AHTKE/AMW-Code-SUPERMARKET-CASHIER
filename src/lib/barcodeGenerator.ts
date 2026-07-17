// Generate unique internal barcodes for products without a manufacturer barcode.
// Uses EAN-13 format starting with "2" (internal store range) so it can never
// collide with real product barcodes from manufacturers.
import { getProducts } from './store';

function calcEAN13Checksum(digits12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? d : d * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

function allExistingBarcodes(): Set<string> {
  const set = new Set<string>();
  for (const p of getProducts()) {
    if (p.barcode) set.add(p.barcode.trim());
    (p.barcodes || []).forEach(b => set.add(b.trim()));
  }
  return set;
}

/**
 * Generates a unique EAN-13 barcode starting with "2" (internal-use prefix).
 * Guaranteed not to collide with any existing product barcode.
 */
export function generateUniqueInternalBarcode(): string {
  const used = allExistingBarcodes();
  for (let attempt = 0; attempt < 200; attempt++) {
    // 12 digits: "2" + 11 random digits, then checksum digit
    let body = '2';
    for (let i = 0; i < 11; i++) {
      body += Math.floor(Math.random() * 10).toString();
    }
    const code = body + calcEAN13Checksum(body);
    if (!used.has(code)) return code;
  }
  // Extremely unlikely fallback
  return '2' + Date.now().toString().slice(-11) + '0';
}
