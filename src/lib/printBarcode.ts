// Prints a barcode label suitable for a thermal receipt printer (58mm/80mm).
import JsBarcode from 'jsbarcode';

export interface PrintBarcodeOptions {
  barcode: string;
  productName: string;
  price?: number;
  copies?: number;
}

export function printBarcodeLabel({ barcode, productName, price, copies = 1 }: PrintBarcodeOptions) {
  // Render barcode into an SVG string
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  try {
    JsBarcode(svg, barcode, {
      format: barcode.length === 13 ? 'EAN13' : 'CODE128',
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 14,
      margin: 4,
    });
  } catch (e) {
    // Fallback to CODE128 if EAN13 checksum somehow fails
    JsBarcode(svg, barcode, { format: 'CODE128', width: 2, height: 60, displayValue: true, fontSize: 14, margin: 4 });
  }
  const svgMarkup = new XMLSerializer().serializeToString(svg);

  const labelHtml = `
    <div class="label">
      <div class="name">${escapeHtml(productName)}</div>
      ${svgMarkup}
      ${price != null ? `<div class="price">${price} ج.م</div>` : ''}
    </div>
  `;

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>طباعة باركود</title>
<style>
  @page { size: 58mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Cairo', Arial, sans-serif; color: #000; background: #fff; }
  .label {
    width: 54mm;
    text-align: center;
    padding: 2mm 0;
    page-break-after: always;
  }
  .label:last-child { page-break-after: auto; }
  .name { font-size: 12px; font-weight: bold; margin-bottom: 2px; word-wrap: break-word; }
  .price { font-size: 14px; font-weight: 900; margin-top: 2px; }
  svg { max-width: 100%; height: auto; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  ${labelHtml.repeat(Math.max(1, copies))}
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
        setTimeout(function() { window.close(); }, 300);
      }, 100);
    });
  <\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=400,height=600');
  if (!win) {
    alert('من فضلك اسمح بالنوافذ المنبثقة (popups) علشان الطباعة تشتغل.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
