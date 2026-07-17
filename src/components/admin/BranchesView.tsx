import { useEffect, useState } from 'react';
import { Send, CheckCircle, AlertTriangle, Radio, HelpCircle, Trash2, Link2Off, Pencil, Sparkles, Info } from 'lucide-react';
import {
  TelegramConfig, getTelegramConfig, saveTelegramConfig, clearTelegramConfig,
  testConnection, uploadSnapshot, startAutoSync, stopAutoSync,
  normalizeChatId, deleteWebhook, fetchRemoteBranchNames, generateUniqueBranchId,
  onRateInfo,
} from '@/lib/telegramSync';
import PasswordGate from '@/components/shared/PasswordGate';

const DEFAULT_CFG: TelegramConfig = {
  botToken: '', chatId: '', branchId: '', branchName: '',
  autoSyncMinutes: 1, role: 'both',
};

type Step = 'creds' | 'name' | 'done';

const BranchesView = () => {
  const saved = getTelegramConfig();
  const existing = saved?.branchId && saved.branchId !== 'manager' ? saved : null;
  const [unlocked, setUnlocked] = useState(false);
  const [editMode, setEditMode] = useState(!existing); // if no config yet → enter wizard
  const [cfg, setCfg] = useState<TelegramConfig>(existing || DEFAULT_CFG);
  const [step, setStep] = useState<Step>(existing ? 'done' : 'creds');
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showWebhookHelp, setShowWebhookHelp] = useState(false);
  const [rate, setRate] = useState<{ queue: number; waitMs: number } | null>(null);
  const [remoteBranches, setRemoteBranches] = useState<{ branchId: string; branchName: string }[]>([]);
  const [nameCheck, setNameCheck] = useState<'idle' | 'checking' | 'ok' | 'duplicate'>('idle');

  useEffect(() => {
    onRateInfo(info => setRate(info.waitMs > 0 ? info : null));
    return () => onRateInfo(null);
  }, []);

  useEffect(() => { startAutoSync({ immediate: true }); }, []);

  // ─── Password gate ───
  if (!unlocked) {
    return (
      <PasswordGate
        title="دخول إعدادات السيرفرات"
        mode="activation"
        hint="أعطِ كود الجهاز للمصمم Ahmed واحصل على كود التفعيل، ثم أدخله هنا."
        onSuccess={() => setUnlocked(true)}
      />
    );
  }

  // ─── Step: enter Bot Token + Chat ID ───
  const handleConnect = async () => {
    setBusy(true); setMsg(null);
    try {
      const normalized = { ...cfg, chatId: normalizeChatId(cfg.chatId) };
      setCfg(normalized);
      const r = await testConnection(normalized);
      setMsg({ type: 'success', text: `متصل بنجاح — Bot: @${r.botName}` });
      // Pre-load remote branches to check name uniqueness
      const list = await fetchRemoteBranchNames(normalized);
      setRemoteBranches(list);
      setStep('name');
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'فشل الاتصال' });
    } finally { setBusy(false); }
  };

  // ─── Step: branch name uniqueness ───
  const checkName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) { setNameCheck('idle'); return; }
    setNameCheck('checking');
    const dup = remoteBranches.some(b =>
      b.branchName.trim().toLowerCase() === trimmed.toLowerCase() &&
      (!cfg.branchId || b.branchId !== cfg.branchId)
    );
    setNameCheck(dup ? 'duplicate' : 'ok');
  };

  const handleFinishName = async () => {
    if (!cfg.branchName.trim()) {
      setMsg({ type: 'error', text: 'اكتب اسم الفرع الأول' });
      return;
    }
    if (nameCheck === 'duplicate') {
      setMsg({ type: 'error', text: 'الاسم ده مستخدم بالفعل. غيره.' });
      return;
    }
    const existingIds = remoteBranches.map(b => b.branchId);
    const newId = cfg.branchId || generateUniqueBranchId(existingIds);
    const finalCfg = { ...cfg, branchId: newId, chatId: normalizeChatId(cfg.chatId) };
    saveTelegramConfig(finalCfg);
    setCfg(finalCfg);
    setStep('done');
    setEditMode(false);
    setBusy(true);
    try {
      await uploadSnapshot(finalCfg);
      startAutoSync({ immediate: false });
      setCfg({ ...getTelegramConfig()! });
      setMsg({ type: 'success', text: `تم الحفظ ورفع أول نسخة تلقائياً — معرّف الفرع: ${newId}` });
    } catch (e: any) {
      startAutoSync({ immediate: true });
      setMsg({ type: 'error', text: e.message || `تم الحفظ لكن فشل أول رفع تلقائي — معرّف الفرع: ${newId}` });
    } finally { setBusy(false); }
  };

  const handleTest = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await testConnection(cfg);
      setMsg({ type: 'success', text: `اختبار ناجح — تم إرسال رسالة تجريبية. Bot: @${r.botName}` });
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally { setBusy(false); }
  };

  const handleUpload = async () => {
    setBusy(true); setMsg(null);
    try {
      await uploadSnapshot(cfg);
      setCfg({ ...getTelegramConfig()! });
      setMsg({ type: 'success', text: 'تم رفع نسخة الفرع للقناة' });
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally { setBusy(false); }
  };

  const handleDeleteWebhook = async () => {
    setBusy(true); setMsg(null);
    try {
      await deleteWebhook(cfg.botToken);
      setMsg({ type: 'success', text: 'تم مسح الـ Webhook — تقدر تستخدم البوت بشكل عادي دلوقتي.' });
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message });
    } finally { setBusy(false); }
  };

  const handleReset = () => {
    if (!confirm('حذف إعدادات السيرفر والفروع المخزنة؟')) return;
    clearTelegramConfig();
    stopAutoSync();
    setCfg(DEFAULT_CFG);
    setStep('creds');
    setEditMode(true);
    setMsg({ type: 'success', text: 'تم مسح الإعدادات' });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-cairo font-black text-xl flex items-center gap-2">
          <Radio className="w-5 h-5 text-supermarket" />
          السيرفرات — ربط الفرع بالقناة
        </h2>
        <button onClick={() => setShowHelp(!showHelp)} className="text-muted-foreground hover:text-foreground">
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {rate && (
        <div className="p-3 bg-cafe/10 border border-cafe/30 rounded font-cairo text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cafe" />
          <div className="flex-1">
            <div className="font-bold">حماية من الحظر شغّالة</div>
            <div className="text-xs text-muted-foreground">
              وصلنا لحد الطلبات الآمن ({rate.queue}/12). بننتظر {(rate.waitMs / 1000).toFixed(1)} ثانية عشان الاتصال بالسيرفر يفضل مستقر.
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="p-4 bg-secondary/50 rounded-lg font-cairo text-sm space-y-2 border border-border">
          <p className="font-bold">إعداد سريع (مجاني):</p>
          <ol className="list-decimal pr-5 space-y-1 text-xs leading-relaxed">
            <li>افتح إعدادات السيرفر عندك → أنشئ اتصال جديد → خد الـ Token الخاص بالسيرفر.</li>
            <li>اعمل قناة خاصة، ضيف البوت فيها <b>Admin</b>.</li>
            <li>افتح لوحة تحكم السيرفر واعمل تحديث للرسائل — خد رقم القناة (<code>chat.id</code>) من هناك.</li>
            <li>ادخل هنا Token + Chat ID → اتصال → اكتب اسم الفرع → حفظ.</li>
          </ol>
        </div>
      )}

      {msg && (
        <div className={`flex items-center gap-2 p-3 rounded font-cairo text-sm ${
          msg.type === 'success' ? 'bg-success/20 text-success'
            : msg.type === 'error' ? 'bg-destructive/20 text-destructive'
            : 'bg-cafe/20 text-cafe'
        }`}>
          {msg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* ─── STEP 1: Credentials ─── */}
      {editMode && step === 'creds' && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h3 className="font-cairo font-bold">1) بيانات البوت والقناة</h3>
          <div>
            <label className="font-cairo text-xs text-muted-foreground">Bot Token</label>
            <input
              type="password"
              value={cfg.botToken}
              onChange={e => setCfg({ ...cfg, botToken: e.target.value.trim() })}
              placeholder="123456:ABC-DEF..."
              className="w-full px-3 py-2 bg-secondary border border-border rounded font-mono text-xs"
            />
          </div>
          <div>
            <label className="font-cairo text-xs text-muted-foreground">Chat ID (القناة)</label>
            <input
              value={cfg.chatId}
              onChange={e => setCfg({ ...cfg, chatId: e.target.value.trim() })}
              onBlur={() => setCfg(c => ({ ...c, chatId: normalizeChatId(c.chatId) }))}
              placeholder="-1001234567890"
              className="w-full px-3 py-2 bg-secondary border border-border rounded font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1 font-cairo">هيتضاف بادئة <code>-100</code> تلقائي.</p>
          </div>
          <button
            onClick={handleConnect}
            disabled={busy || !cfg.botToken || !cfg.chatId}
            className="w-full py-2.5 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm disabled:opacity-50"
          >
            {busy ? 'جاري الاتصال...' : 'اتصال'}
          </button>
        </div>
      )}

      {/* ─── STEP 2: Branch name ─── */}
      {editMode && step === 'name' && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h3 className="font-cairo font-bold">2) اسم الفرع (المعرّف يتولّد تلقائي)</h3>
          <div>
            <label className="font-cairo text-xs text-muted-foreground">اسم الفرع</label>
            <input
              value={cfg.branchName}
              onChange={e => { setCfg({ ...cfg, branchName: e.target.value }); checkName(e.target.value); }}
              placeholder="فرع المهندسين"
              className="w-full px-3 py-2 bg-secondary border border-border rounded font-cairo"
            />
            {nameCheck === 'duplicate' && (
              <p className="text-xs text-destructive font-cairo mt-1">⚠️ الاسم ده مستخدم بالفعل على القناة.</p>
            )}
            {nameCheck === 'ok' && cfg.branchName && (
              <p className="text-xs text-success font-cairo mt-1">✓ الاسم متاح.</p>
            )}
          </div>
          {remoteBranches.length > 0 && (
            <div className="p-3 bg-secondary/40 rounded text-xs font-cairo">
              <div className="text-muted-foreground mb-1">الفروع الموجودة على القناة:</div>
              <div className="flex flex-wrap gap-1">
                {remoteBranches.map(b => (
                  <span key={b.branchId} className="px-2 py-0.5 bg-card rounded border border-border">{b.branchName}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setStep('creds')} className="px-4 py-2 bg-secondary rounded font-cairo text-sm">رجوع</button>
            <button
              onClick={handleFinishName}
              disabled={!cfg.branchName || nameCheck === 'duplicate'}
              className="flex-1 py-2 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm disabled:opacity-50"
            >
              حفظ وإكمال
            </button>
          </div>
        </div>
      )}

      {/* ─── DONE: summary + actions ─── */}
      {!editMode && step === 'done' && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-cairo font-bold">إعدادات هذا السيرفر</h3>
            <button
              onClick={() => { setEditMode(true); setStep('creds'); }}
              className="flex items-center gap-1 text-xs font-cairo text-cafe hover:underline">
              <Pencil className="w-3 h-3" /> تعديل السيرفر
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm font-cairo">
            <Info2 label="اسم الفرع" value={cfg.branchName} />
            <Info2 label="معرّف الفرع" value={cfg.branchId} mono />
            <Info2 label="Chat ID" value={cfg.chatId} mono />
            <Info2 label="Bot Token" value={cfg.botToken ? '••••••••' + cfg.botToken.slice(-4) : '—'} mono />
          </div>

          <div>
            <label className="font-cairo text-xs text-muted-foreground">مزامنة تلقائية كل (دقيقة)</label>
            <input
              type="number" min={1}
              value={cfg.autoSyncMinutes}
              onChange={e => {
                const v = Math.max(1, +e.target.value || 1);
                const updated = { ...cfg, autoSyncMinutes: v };
                setCfg(updated); saveTelegramConfig(updated); startAutoSync({ immediate: true });
              }}
              className="w-full px-3 py-2 bg-secondary border border-border rounded font-cairo text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={handleTest} disabled={busy} className="px-4 py-2 bg-secondary border border-border rounded font-cairo text-sm">
              اختبار الاتصال
            </button>
            <button onClick={handleUpload} disabled={busy} className="flex items-center gap-2 px-4 py-2 bg-cafe text-cafe-foreground rounded font-cairo font-bold text-sm disabled:opacity-50">
              <Send className="w-4 h-4" /> رفع نسخة الفرع الآن
            </button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 border border-destructive/40 text-destructive rounded font-cairo text-sm mr-auto">
              <Trash2 className="w-4 h-4" /> حذف الإعدادات
            </button>
          </div>

          {cfg.lastSyncAt && (
            <p className="font-cairo text-xs text-muted-foreground">
              آخر رفع: {new Date(cfg.lastSyncAt).toLocaleString('ar-EG')}
            </p>
          )}
        </div>
      )}

      {/* ─── Webhook explanation card ─── */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <button
          onClick={() => setShowWebhookHelp(!showWebhookHelp)}
          className="w-full flex items-center justify-between font-cairo font-bold text-sm">
          <span className="flex items-center gap-2"><Info className="w-4 h-4 text-cafe" /> إيه هي خاصية "مسح Webhook"؟</span>
          <span className="text-xs text-muted-foreground">{showWebhookHelp ? 'إخفاء' : 'شرح'}</span>
        </button>
        {showWebhookHelp && (
          <div className="text-xs font-cairo leading-7 text-muted-foreground space-y-2">
            <p>
              الـ <b>Webhook</b> هو عنوان بيتربط بالسيرفر عشان يبعت له الرسايل الجديدة على طول (زي إشعار). ده مفيد لبعض السيرفرات، لكن مش لازم للبرنامج ده.
            </p>
            <p>
              البرنامج ده بيقرا الرسايل بنفسه من السيرفر. لو فيه Webhook مربوط بنفس الاتصال من مكان تاني، السيرفر هيرفض الطلب ويطلع رسالة <b>Conflict</b>.
            </p>
            <p>
              <b>حل المشكلة:</b> اضغط الزرار ده مرة واحدة، هيروح ماسح الـ Webhook القديم، والبوت هيرجع يشتغل مع البرنامج عادي. مش هيحصل أي ضرر للبيانات.
            </p>
            <button
              onClick={handleDeleteWebhook}
              disabled={busy || !cfg.botToken}
              className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded font-cairo text-sm disabled:opacity-50">
              <Link2Off className="w-4 h-4" /> مسح Webhook الآن
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Info2 = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="p-2 bg-secondary/40 rounded">
    <div className="text-[10px] text-muted-foreground">{label}</div>
    <div className={`font-bold ${mono ? 'font-mono text-xs' : ''} break-all`}>{value || '—'}</div>
  </div>
);

export default BranchesView;
