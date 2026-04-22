// PDF Export utility
interface PDFExportOptions {
  title: string;
  subtitle?: string;
  dateRange?: string;
  headers: string[];
  rows: string[][];
  summary?: { label: string; value: string }[];
}

function generateHTML(options: PDFExportOptions, showPrintButton: boolean): string {
  const { title, subtitle, dateRange, headers, rows, summary } = options;

  const headerCells = headers.map(h => `<th>${h}</th>`).join('');
  const bodyRows = rows.map(row => 
    `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
  ).join('');

  const summaryHtml = summary ? summary.map(s =>
    `<div class="summary-item"><span class="label">${s.label}</span><span class="value">${s.value}</span></div>`
  ).join('') : '';

  return `
    <html dir="rtl">
    <head>
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Cairo', 'Arial', sans-serif;
          padding: 30px;
          color: #1a1a1a;
          font-size: 12px;
        }
        @media print {
          @page { size: A4; margin: 15mm; }
          body { padding: 0; }
          .no-print { display: none; }
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #e67e22;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .header h1 { font-size: 22px; color: #e67e22; margin-bottom: 5px; }
        .header .subtitle { font-size: 14px; color: #666; }
        .header .date-range { font-size: 12px; color: #999; margin-top: 5px; }
        .header .generated { font-size: 10px; color: #999; margin-top: 5px; }

        .summary-section {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .summary-item {
          flex: 1;
          min-width: 120px;
          background: #f8f9fa;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #eee;
          text-align: center;
        }
        .summary-item .label { display: block; font-size: 11px; color: #666; }
        .summary-item .value { display: block; font-size: 18px; font-weight: 900; color: #e67e22; margin-top: 4px; }

        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th {
          background: #e67e22;
          color: white;
          padding: 10px 8px;
          text-align: right;
          font-weight: 700;
          font-size: 12px;
        }
        td {
          padding: 8px;
          border-bottom: 1px solid #eee;
          font-size: 11px;
        }
        tr:nth-child(even) { background: #fafafa; }
        tr:hover { background: #fff3e0; }

        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #eee;
          color: #999;
          font-size: 10px;
        }

        .actions {
          position: fixed;
          top: 20px;
          left: 20px;
          display: flex;
          gap: 10px;
          z-index: 100;
        }
        .btn {
          padding: 10px 25px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Cairo', sans-serif;
          font-size: 14px;
          font-weight: bold;
        }
        .btn-print { background: #e67e22; color: white; }
        .btn-print:hover { background: #d35400; }
        .btn-pdf { background: #27ae60; color: white; }
        .btn-pdf:hover { background: #219a52; }
      </style>
    </head>
    <body>
      ${showPrintButton ? `
      <div class="actions no-print">
        <button class="btn btn-print" onclick="window.print()">🖨️ طباعة</button>
        <button class="btn btn-pdf" onclick="window.print()">📄 حفظ PDF</button>
      </div>` : ''}

      <div class="header">
        <h1>📊 ${title}</h1>
        ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
        ${dateRange ? `<div class="date-range">الفترة: ${dateRange}</div>` : ''}
        <div class="generated">تم إنشاء التقرير: ${new Date().toLocaleString('ar-EG')}</div>
      </div>

      ${summaryHtml ? `<div class="summary-section">${summaryHtml}</div>` : ''}

      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>

      <div class="footer">
        تم إنشاء هذا التقرير بواسطة نظام نقاط البيع • ${new Date().toLocaleDateString('ar-EG')}
      </div>
    </body>
    </html>
  `;
}

export function exportToPDF(options: PDFExportOptions) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;
  printWindow.document.write(generateHTML(options, true));
  printWindow.document.close();
}

export function downloadAsPDF(options: PDFExportOptions) {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;
  printWindow.document.write(generateHTML(options, true));
  printWindow.document.close();
  // Auto-trigger print (user can choose "Save as PDF" from browser)
  setTimeout(() => printWindow.print(), 600);
}
