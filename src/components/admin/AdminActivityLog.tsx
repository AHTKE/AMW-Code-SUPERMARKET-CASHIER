import { useState } from 'react';
import { getAdminLog, deleteLogEntries, clearAllLogs, AdminLogEntry } from '@/lib/adminLog';
import { verifyMasterRecovery } from '@/lib/store';
import { Trash2, AlertTriangle, Shield, Clock, Search } from 'lucide-react';

const AdminActivityLog = () => {
  const [log, setLog] = useState<AdminLogEntry[]>(getAdminLog());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [masterUser, setMasterUser] = useState('');
  const [masterPass, setMasterPass] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLog = log.filter(entry =>
    entry.action.includes(searchQuery) ||
    entry.details.includes(searchQuery) ||
    entry.user.includes(searchQuery)
  ).reverse();

  const handleDeleteRequest = (ids: string[]) => {
    setDeleteIds(ids);
    setShowDeleteConfirm(true);
    setMasterUser('');
    setMasterPass('');
    setDeleteError('');
  };

  const handleDeleteConfirm = () => {
    if (!verifyMasterRecovery(masterUser.trim(), masterPass.trim())) {
      setDeleteError('بيانات الاسترداد غير صحيحة');
      return;
    }
    if (deleteIds.length === 0) {
      clearAllLogs();
    } else {
      deleteLogEntries(deleteIds);
    }
    setLog(getAdminLog());
    setShowDeleteConfirm(false);
    setDeleteIds([]);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString('ar-EG')} ${d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-cairo font-black text-xl flex items-center gap-2">
          <Shield className="w-5 h-5" />
          📋 سجل النشاط والتغييرات
        </h2>
        {log.length > 0 && (
          <button
            onClick={() => handleDeleteRequest([])}
            className="flex items-center gap-1 px-3 py-2 bg-destructive text-destructive-foreground rounded font-cairo font-bold text-xs hover:opacity-90"
          >
            <Trash2 className="w-3 h-3" />
            حذف الكل
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full h-10 px-3 pr-10 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-supermarket"
          placeholder="بحث في السجل..."
        />
      </div>

      <p className="text-xs text-muted-foreground font-cairo">
        ⚠️ لحذف أي سجل يجب إدخال بيانات الاسترداد الأساسية (اسم المستخدم وكلمة المرور)
      </p>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {filteredLog.map(entry => (
          <div key={entry.id} className="p-3 bg-card rounded-lg border border-border flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-cairo font-bold text-sm">{entry.action}</span>
                <span className="text-[10px] bg-supermarket/20 text-supermarket px-1.5 py-0.5 rounded font-cairo">{entry.user}</span>
              </div>
              <p className="font-cairo text-xs text-muted-foreground mt-1 break-words">{entry.details}</p>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatDate(entry.timestamp)}
              </div>
            </div>
            <button
              onClick={() => handleDeleteRequest([entry.id])}
              className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors shrink-0"
              title="حذف"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {filteredLog.length === 0 && (
          <div className="text-center text-muted-foreground py-8 font-cairo">
            {searchQuery ? 'لا توجد نتائج' : 'لا توجد سجلات بعد'}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border p-6 w-full max-w-sm space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-destructive" />
              </div>
              <h3 className="font-cairo font-black text-lg">تأكيد الحذف</h3>
              <p className="font-cairo text-sm text-muted-foreground">
                {deleteIds.length === 0 ? 'سيتم حذف جميع السجلات' : 'سيتم حذف السجل المحدد'}
              </p>
              <p className="font-cairo text-xs text-destructive">
                أدخل بيانات الاسترداد الأساسية للتأكيد
              </p>
            </div>

            <div>
              <label className="font-cairo text-sm text-muted-foreground block mb-1">اسم المستخدم</label>
              <input
                type="text"
                value={masterUser}
                onChange={e => { setMasterUser(e.target.value); setDeleteError(''); }}
                className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
                autoFocus
              />
            </div>
            <div>
              <label className="font-cairo text-sm text-muted-foreground block mb-1">كلمة المرور</label>
              <input
                type="password"
                value={masterPass}
                onChange={e => { setMasterPass(e.target.value); setDeleteError(''); }}
                className="w-full h-10 px-3 bg-secondary rounded font-cairo text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
              />
            </div>

            {deleteError && (
              <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-destructive text-xs font-cairo">
                <AlertTriangle className="w-3 h-3" />
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-3 rounded font-cairo font-bold text-sm bg-secondary text-muted-foreground hover:text-foreground">
                إلغاء
              </button>
              <button onClick={handleDeleteConfirm} className="flex-1 py-3 rounded font-cairo font-bold text-sm bg-destructive text-destructive-foreground hover:opacity-90">
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminActivityLog;
