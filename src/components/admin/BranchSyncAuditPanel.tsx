import { useEffect, useState } from 'react';
import { ClipboardList, Download, Trash2, RefreshCw } from 'lucide-react';
import { getBranchAudit, clearBranchAudit, BranchAuditEntry } from '@/lib/branchAudit';
import { triggerFileDownload } from '@/lib/branchSyncFeatures';

const kindLabel: Record<string, string> = {
  upload: 'رفع',
  download: 'تحميل',
  apply: 'تطبيق',
  conflict: 'تعارض',
  delete: 'حذف',
  restore: 'استعادة',
  backup: 'نسخة احتياطية',
};
const kindColor: Record<string, string> = {
  upload: 'bg-supermarket/20 text-supermarket',
  download: 'bg-cafe/20 text-cafe',
  apply: 'bg-foreground/10 text-foreground',
  conflict: 'bg-destructive/20 text-destructive',
  delete: 'bg-destructive/20 text-destructive',
  restore: 'bg-success/20 text-success',
  backup: 'bg-success/20 text-success',
};

interface Props { onClose: () => void }

const BranchSyncAuditPanel = ({ onClose }: Props) => {
  const [entries, setEntries] = useState<BranchAuditEntry[]>(() => getBranchAudit());
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const refresh = () => setEntries(getBranchAudit());
    window.addEventListener('pos-branch-audit-changed', refresh);
    const t = window.setInterval(refresh, 3000);
    return () => { window.removeEventListener('pos-branch-audit-changed', refresh); window.clearInterval(t); };
  }, []);

  const filtered = filter === 'all' ? entries : entries.filter(e => e.kind === filter);

  const exportLog = () => {
    triggerFileDownload(
      `branch-sync-audit-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(entries, null, 2),
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-supermarket" />
          <h3 className="font-cairo font-black flex-1">سجل مزامنة الفروع ({entries.length})</h3>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-2 py-1 bg-secondary border border-border rounded font-cairo text-xs">
            <option value="all">الكل</option>
            {Object.entries(kindLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={() => setEntries(getBranchAudit())}
            className="p-1.5 bg-secondary rounded" title="تحديث">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={exportLog}
            className="p-1.5 bg-secondary rounded" title="تصدير كـ JSON">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { if (confirm('مسح كل السجل؟')) { clearBranchAudit(); setEntries([]); } }}
            className="p-1.5 border border-destructive/40 text-destructive rounded" title="مسح">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="px-3 py-1.5 bg-secondary rounded font-cairo text-xs">إغلاق</button>
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-1.5">
          {filtered.length === 0 && (
            <div className="text-center text-muted-foreground font-cairo py-8 text-sm">مفيش سجلات بعد</div>
          )}
          {filtered.map(e => (
            <div key={e.id} className={`flex items-center gap-2 p-2 rounded text-xs font-cairo border ${e.ok ? 'border-border' : 'border-destructive/30 bg-destructive/5'}`}>
              <span className={`px-2 py-0.5 rounded font-bold ${kindColor[e.kind] || 'bg-secondary'}`}>{kindLabel[e.kind] || e.kind}</span>
              <span className="font-bold">{e.branchName}</span>
              {e.version ? <span className="text-muted-foreground">v{e.version}{e.parentVersion ? `←v${e.parentVersion}` : ''}</span> : null}
              {e.bytes ? <span className="text-muted-foreground">{(e.bytes / 1024).toFixed(1)}KB</span> : null}
              <span className="flex-1 text-muted-foreground truncate">{e.message || (e.ok ? 'ناجح' : 'فشل')}</span>
              <span className="text-muted-foreground text-[10px] whitespace-nowrap">{new Date(e.timestamp).toLocaleString('ar-EG')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BranchSyncAuditPanel;
