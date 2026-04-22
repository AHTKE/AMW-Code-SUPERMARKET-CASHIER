// Generate unique 7-digit invoice numbers
const USED_NUMBERS_KEY = 'pos_used_invoice_numbers';

function getUsedNumbers(): Set<string> {
  try {
    const raw = localStorage.getItem(USED_NUMBERS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveUsedNumber(num: string) {
  const used = getUsedNumbers();
  used.add(num);
  // Keep only last 100000 to avoid bloat
  const arr = Array.from(used);
  if (arr.length > 100000) arr.splice(0, arr.length - 100000);
  localStorage.setItem(USED_NUMBERS_KEY, JSON.stringify(arr));
}

export function generateInvoiceNumber(): string {
  const used = getUsedNumbers();
  let num: string;
  do {
    num = String(Math.floor(1000000 + Math.random() * 9000000)); // 7 digits
  } while (used.has(num));
  saveUsedNumber(num);
  return num;
}
