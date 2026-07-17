import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  RefreshCw,
  Radio,
  AlertTriangle,
  CheckCircle,
  Eye,
  Upload,
  Pencil,
  Database,
  Sparkles,
  Settings2,
  Trash2,
  ClipboardList,
  Save,
  FolderOpen,
  Lock as LockIcon,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import AdminDashboard from "./AdminDashboard";
import {
  TelegramConfig,
  getManagerTelegramConfig,
  saveManagerTelegramConfig,
  fetchBranches,
  fetchSingleBranch,
  getCachedBranches,
  BranchSnapshot,
  uploadSnapshotData,
  normalizeChatId,
  testConnection,
  onRateInfo,
  diagnoseChannel,
  SNAPSHOT_KEYS,
  deleteBranchFromChannel,
  BranchVersionConflictError,
} from "@/lib/telegramSync";
import {
  exitBranchPreview,
  buildAggregatedSnapshot,
  reapplyBranchPreview,
} from "@/lib/branchPreview";
import {
  onSyncProgress,
  SyncProgress,
  serializeBranchBackup,
  parseBranchBackup,
  triggerFileDownload,
} from "@/lib/branchSyncFeatures";
import { logBranchAudit } from "@/lib/branchAudit";
import PasswordGate from "@/components/shared/PasswordGate";
import BranchSyncAuditPanel from "./BranchSyncAuditPanel";
import { getManagerCredentials, setManagerCredentials, isManagerCredsSet } from "@/lib/store";

interface Props {
  onBack: () => void;
}

const AUTO_REFRESH_MS = 2_500;
const AUTO_REFRESH_ALL_MS = 10_000;
const AUTO_REFRESH_HIDDEN_MS = 45_000;
const AUTO_PUSH_DELAY_MS = 150;
// Grace window after the last user interaction (typing, focusing an input,
// clicking inside the dashboard). During this window we skip any remount
// so forms and scroll position stay intact.
const USER_ACTIVE_GRACE_MS = 4_000;

// Returns true when the manager is actively editing something — either a
// form field is focused, or they interacted very recently. We use this to
// suppress the auto-remount that would otherwise wipe their input.
function isUserInteracting(lastActivityMs: number): boolean {
  if (Date.now() - lastActivityMs < USER_ACTIVE_GRACE_MS) return true;
  if (typeof document === "undefined") return false;
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

// Fingerprint the currently-visible data so we only remount the admin
// dashboard when the remote data ACTUALLY changed for the selected branch
// (avoids interrupting the manager while they're typing in a form).
function fingerprintForSelection(list: BranchSnapshot[], selected: string): string {
  if (selected === "all") {
    return list
      .map((b) => `${b.branchId}:${b.timestamp}`)
      .sort()
      .join("|");
  }
  const snap = list.find((b) => b.branchId === selected);
  return snap ? `${snap.branchId}:${snap.timestamp}` : `${selected}:none`;
}

const MANAGER_SHARED_KEYS = new Set([
  "pos_products",
  "pos_cashiers",
  "pos_settings",
  "pos_store_info",
  "pos_categories_supermarket",
  "pos_categories_cafe",
  "pos_coupons",
  "pos_product_offers",
  "pos_global_cashier_permissions",
  "pos_custom_shortcuts",
  "pos_font_config",
  "pos_font_permission_cashier",
  "pos_theme",
  "pos_theme_color",
]);

// Keys that must never be uploaded from a manager device to a branch.
const LOCAL_ONLY_OVERLAY_KEYS = new Set(["pos_admin_credentials", "pos_manager_credentials"]);

function readLocalSnapshotOverlay(): Record<string, any> {
  const data: Record<string, any> = {};
  for (const key of SNAPSHOT_KEYS) {
    if (!MANAGER_SHARED_KEYS.has(key) || LOCAL_ONLY_OVERLAY_KEYS.has(key)) continue;
    const raw = localStorage.getItem(key);
    if (raw === null) {
      data[key] = null;
      continue;
    }
    try {
      data[key] = JSON.parse(raw);
    } catch {
      data[key] = raw;
    }
  }
  return data;
}

const BRANCH_MGR_TRUSTED_KEY = "pos_branch_manager_trusted";
const BranchManagerDashboard = ({ onBack }: Props) => {
  const initialCfg = getManagerTelegramConfig();
  // Password gate:
  //   - First-time on this device → ask rotating password once, then remember.
  //   - Once unlocked (or once manager credentials are saved) → never prompt
  //     again on this device. The user asked explicitly for the rotating
  //     screen to appear only once, ever.
  //   - Explicit "تعديل السيرفر" no longer re-locks.
  const managerCredsSet = isManagerCredsSet();
  const deviceTrusted =
    managerCredsSet ||
    (typeof localStorage !== "undefined" && localStorage.getItem(BRANCH_MGR_TRUSTED_KEY) === "1");
  const [unlocked, setUnlocked] = useState(deviceTrusted);
  const [editServer, setEditServer] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [cfg, setCfg] = useState<TelegramConfig | null>(initialCfg);
  const [tmpToken, setTmpToken] = useState(cfg?.botToken || "");
  const [tmpChat, setTmpChat] = useState(cfg?.chatId || "");
  const [branches, setBranches] = useState<BranchSnapshot[]>(() => getCachedBranches());
  const [selected, setSelected] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [dashKey, setDashKey] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const [confirmPush, setConfirmPush] = useState<"one" | "all" | null>(null);
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BranchSnapshot | null>(null);
  const [dirty, setDirty] = useState(false);
  const [dismissedIncompleteAll, setDismissedIncompleteAll] = useState<string>("");
  const [dismissedIncompleteSelected, setDismissedIncompleteSelected] = useState<string>("");
  const [editBarDismissed, setEditBarDismissed] = useState<boolean>(false);
  useEffect(() => {
    setEditBarDismissed(false);
    setDismissedIncompleteSelected("");
  }, [selected]);
  const [toolbarCollapsed, setToolbarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("pos_branch_toolbar_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggleToolbar = () => {
    setToolbarCollapsed((v) => {
      const nv = !v;
      try {
        localStorage.setItem("pos_branch_toolbar_collapsed", nv ? "1" : "0");
      } catch {
        /* ignore */
      }
      return nv;
    });
  };
  const [rate, setRate] = useState<{ queue: number; waitMs: number } | null>(null);
  // Signature of the last data we actually applied to the UI. Prevents the
  // auto-refresh from re-mounting the admin dashboard (and losing whatever
  // form the user is filling in) when nothing meaningfully changed remotely.
  const [appliedSignature, setAppliedSignature] = useState<string>("");
  const [diagnostic, setDiagnostic] = useState<{
    ok?: boolean;
    updatesCount?: number;
    manifestMessageId?: number;
    manifestBranches?: { branchId: string; branchName: string; messageId: number; date: number }[];
    branchMessages?: { branchId: string; branchName: string; messageId: number; date: number }[];
    error?: string;
    busy: boolean;
  }>({ busy: false });
  const [progress, setProgress] = useState<SyncProgress>({ stage: "idle" });
  const [showAudit, setShowAudit] = useState(false);
  const [conflictRetry, setConflictRetry] = useState<null | {
    mode: "one" | "all";
    error: BranchVersionConflictError;
  }>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef(selected);
  const branchesRef = useRef(branches);
  const dirtySeqRef = useRef(0);
  const fetchInFlightRef = useRef(false);
  const lastAllRefreshRef = useRef(0);
  const lastActivityRef = useRef(0);
  const pendingApplyRef = useRef<{ list: BranchSnapshot[]; sig: string; selected: string } | null>(
    null,
  );

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    branchesRef.current = branches;
  }, [branches]);

  // Track user activity inside the dashboard shell so silent refreshes never
  // remount AdminDashboard while the manager is typing or navigating tabs.
  useEffect(() => {
    const mark = () => {
      lastActivityRef.current = Date.now();
    };
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener("pointerdown", mark, opts);
    window.addEventListener("keydown", mark, opts);
    window.addEventListener("focusin", mark, opts);
    window.addEventListener("input", mark, opts);
    return () => {
      window.removeEventListener("pointerdown", mark, opts);
      window.removeEventListener("keydown", mark, opts);
      window.removeEventListener("focusin", mark, opts);
      window.removeEventListener("input", mark, opts);
    };
  }, []);

  // Flush any deferred remote update once the user stops interacting.
  useEffect(() => {
    const id = window.setInterval(() => {
      const pending = pendingApplyRef.current;
      if (!pending) return;
      if (dirty) return;
      if (isUserInteracting(lastActivityRef.current)) return;
      pendingApplyRef.current = null;
      applySelected(pending.list, pending.selected);
      setAppliedSignature(pending.sig);
    }, 800);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  useEffect(() => {
    const unsub = onSyncProgress(setProgress);
    return unsub;
  }, []);

  useEffect(() => {
    onRateInfo((info) => setRate(info.waitMs > 0 ? info : null));
    return () => onRateInfo(null);
  }, []);

  useEffect(() => {
    const markDirty = () => {
      dirtySeqRef.current += 1;
      setDirty(true);
    };
    window.addEventListener("pos-branch-preview-dirty", markDirty);
    return () => window.removeEventListener("pos-branch-preview-dirty", markDirty);
  }, []);

  const doFetch = async (silent = false) => {
    const latest = getManagerTelegramConfig();
    setCfg(latest);
    if (!latest?.botToken) return;
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    if (!silent) {
      setBusy(true);
      setMsg(null);
    }
    try {
      // Lightweight polling: single branch stays fast (6s); aggregated all-branches
      // view refreshes remotely every 30s to avoid hammering Telegram with many files.
      const currentSelected = selectedRef.current;
      const cachedList = getCachedBranches();
      let list: BranchSnapshot[];
      const shouldThrottleAll =
        silent &&
        currentSelected === "all" &&
        cachedList.length > 0 &&
        Date.now() - lastAllRefreshRef.current < AUTO_REFRESH_ALL_MS;
      if (shouldThrottleAll) {
        list = cachedList;
      } else if (
        silent &&
        currentSelected !== "all" &&
        cachedList.length > 0 &&
        cachedList.some((b) => b.branchId === currentSelected)
      ) {
        const snap = await fetchSingleBranch(latest, currentSelected, { force: true });
        list = snap
          ? cachedList.map((b) => (b.branchId === currentSelected ? snap : b))
          : cachedList.filter((b) => b.branchId !== currentSelected);
      } else {
        list = await fetchBranches(latest, { force: !silent });
        if (currentSelected === "all") lastAllRefreshRef.current = Date.now();
      }
      const hadBranchesBefore = branchesRef.current.length > 0;
      setBranches(list);
      // Auto-apply remote changes even during silent polls, but only when
      // (a) the manager isn't editing right now (`dirty` false), and
      // (b) the underlying data for the current selection actually changed.
      // The admin dashboard preserves its active tab through `tabStorageKey`,
      // so the manager keeps their place after the remount.
      const nextSig = `${currentSelected}#${fingerprintForSelection(list, currentSelected)}`;
      const shouldApply =
        list.length > 0 &&
        (!silent || !appliedSignature || !hadBranchesBefore || nextSig !== appliedSignature);
      if (shouldApply) {
        if (!dirty && !isUserInteracting(lastActivityRef.current)) {
          pendingApplyRef.current = null;
          applySelected(list, currentSelected);
          setAppliedSignature(nextSig);
        } else if (silent) {
          // Defer — flush later when the user idles.
          pendingApplyRef.current = { list, sig: nextSig, selected: currentSelected };
        }
      }
      if (!shouldThrottleAll) setLastRefresh(Date.now());
      if (currentSelected !== "all" && !list.some((b) => b.branchId === currentSelected))
        setSelected("all");
      if (!silent) setMsg({ type: "success", text: `تم جلب ${list.length} فرع` });
    } catch (e: any) {
      setMsg({ type: "error", text: e.message || "فشل الجلب" });
    } finally {
      fetchInFlightRef.current = false;
      if (!silent) setBusy(false);
    }
  };

  const doDiagnose = async () => {
    const latest = getManagerTelegramConfig();
    if (!latest?.botToken) return;
    setDiagnostic((d) => ({ ...d, busy: true }));
    try {
      const r = await diagnoseChannel(latest);
      setDiagnostic({ ...r, busy: false });
    } catch (e: any) {
      setDiagnostic({ busy: false, ok: false, error: e.message || "فشل الفحص" });
    }
  };

  const applySelected = (list: BranchSnapshot[], id: string) => {
    if (list.length === 0) {
      exitBranchPreview();
      return;
    }
    if (id === "all") reapplyBranchPreview(buildAggregatedSnapshot(list));
    else {
      const snap = list.find((b) => b.branchId === id);
      if (snap) reapplyBranchPreview(snap.data);
    }
    setDirty(false);
    setDashKey((k) => k + 1);
  };

  useEffect(() => {
    if (!unlocked) return;
    if (cfg?.botToken && !editServer) doFetch(true);
    return () => {
      exitBranchPreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  // Only re-apply + remount when the SELECTION changes (or first render). Silent
  // auto-refreshes must NOT rebuild AdminDashboard — that resets tabs and wipes
  // whatever form the manager is filling in. Remote data still lands in the
  // `branches` cache; the manager sees it after they switch branches or press
  // "تحديث الآن" manually.
  useEffect(() => {
    if (dirty) return;
    const sig = `${selected}#${fingerprintForSelection(branches, selected)}`;
    if (sig === appliedSignature) return;
    // Selection changes are explicit user actions — apply immediately, but
    // still skip if we're mid-interaction (rare: dropdown just changed).
    applySelected(branches, selected);
    setAppliedSignature(sig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, dirty]);

  // Auto-refresh: fast when the tab is visible, slow when it's hidden, and
  // paused while the manager is editing the server config or a modal is open.
  useEffect(() => {
    if (!unlocked || !cfg?.botToken || editServer) return;
    if (confirmPush || pendingSelect || confirmDelete) return;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) doFetch(true);
    };
    const schedule = () => {
      const ms =
        typeof document !== "undefined" && document.hidden
          ? AUTO_REFRESH_HIDDEN_MS
          : AUTO_REFRESH_MS;
      return window.setInterval(tick, ms);
    };
    let timer = schedule();
    const onVis = () => {
      window.clearInterval(timer);
      timer = schedule();
      if (typeof document !== "undefined" && !document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, editServer, cfg?.botToken, confirmPush, pendingSelect, confirmDelete]);

  const currentLabel = useMemo(() => {
    if (selected === "all") return `كل الفروع (${branches.length})`;
    return branches.find((b) => b.branchId === selected)?.branchName || selected;
  }, [selected, branches]);

  const selectedBranch = useMemo(() => {
    if (selected === "all") return null;
    return branches.find((b) => b.branchId === selected) || null;
  }, [selected, branches]);

  const incompleteBranches = useMemo(() => branches.filter((b) => b.incomplete), [branches]);

  const handleSelectBranch = (next: string) => {
    if (next === selected) return;
    if (
      dirty &&
      !confirm("في تعديلات لم يتم رفعها بعد. تغيير الفرع هيلغي التعديلات المحلية. تكمل؟")
    )
      return;
    // Show confirmation modal with the branch name before entering edit mode.
    setPendingSelect(next);
  };

  const confirmSelection = () => {
    if (pendingSelect === null) return;
    setDirty(false);
    setSelected(pendingSelect);
    setPendingSelect(null);
  };

  const doDelete = async (snap: BranchSnapshot) => {
    if (!cfg) return;
    setBusy(true);
    setMsg(null);
    try {
      await deleteBranchFromChannel(cfg, snap.branchId);
      setBranches((prev) => prev.filter((b) => b.branchId !== snap.branchId));
      if (selected === snap.branchId) setSelected("all");
      setConfirmDelete(null);
      setMsg({ type: "success", text: `تم حذف الفرع "${snap.branchName}" من القناة` });
    } catch (e: any) {
      setMsg({ type: "error", text: e.message || "فشل الحذف" });
    } finally {
      setBusy(false);
    }
  };

  const handleBack = () => {
    exitBranchPreview();
    onBack();
  };

  const doBackup = () => {
    if (!selectedBranch) {
      // Full multi-branch backup
      const bundle = branches.map((b) => ({
        branchId: b.branchId,
        branchName: b.branchName,
        timestamp: b.timestamp,
        data: b.data,
      }));
      triggerFileDownload(
        `branches-full-backup-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(
          {
            _fileType: "pos-branches-bundle",
            _version: 1,
            timestamp: Date.now(),
            branches: bundle,
          },
          null,
          2,
        ),
      );
      logBranchAudit({
        kind: "backup",
        actor: "manager",
        branchId: "all",
        branchName: `كل الفروع (${bundle.length})`,
        ok: true,
        message: "نسخة كاملة",
      });
      setMsg({ type: "success", text: "تم تنزيل النسخة الاحتياطية الكاملة" });
      return;
    }
    const content = serializeBranchBackup(
      selectedBranch.branchId,
      selectedBranch.branchName,
      selectedBranch.data,
    );
    triggerFileDownload(
      `${selectedBranch.branchId}-backup-${new Date().toISOString().slice(0, 10)}.json`,
      content,
    );
    logBranchAudit({
      kind: "backup",
      actor: "manager",
      branchId: selectedBranch.branchId,
      branchName: selectedBranch.branchName,
      ok: true,
      bytes: content.length,
    });
    setMsg({
      type: "success",
      text: `تم تنزيل نسخة احتياطية للفرع "${selectedBranch.branchName}"`,
    });
  };

  const doRestore = async (file: File) => {
    if (!cfg) return;
    try {
      const raw = await file.text();
      const parsed = parseBranchBackup(raw);
      if (
        !confirm(
          `استعادة نسخة احتياطية للفرع "${parsed.branchName}" ورفعها للقناة الآن؟\nالبيانات الحالية للفرع هتتستبدل بالكامل.`,
        )
      )
        return;
      setBusy(true);
      await uploadSnapshotData(cfg, parsed.data, {
        branchId: parsed.branchId,
        branchName: parsed.branchName,
        force: true,
      });
      logBranchAudit({
        kind: "restore",
        actor: "manager",
        branchId: parsed.branchId,
        branchName: parsed.branchName,
        ok: true,
        message: "استعادة من ملف",
      });
      setMsg({ type: "success", text: `تم استعادة الفرع "${parsed.branchName}"` });
      await doFetch(true);
    } catch (e: any) {
      logBranchAudit({
        kind: "restore",
        actor: "manager",
        branchId: "?",
        branchName: file.name,
        ok: false,
        message: e.message,
      });
      setMsg({ type: "error", text: `فشل الاستعادة: ${e.message}` });
    } finally {
      setBusy(false);
    }
  };

  const pushCurrentSelection = async (
    mode: "one" | "all",
    silent = false,
    opts: { force?: boolean } = {},
  ) => {
    if (!cfg) return;
    // Silent auto-pushes are the manager's own edits queued 300 ms after a
    // change — the "version conflict" modal for those is almost always a
    // false positive (branch device just polled in the meantime). Force
    // them through instead of interrupting the manager with a dialog.
    const forceUpload = opts.force || silent;
    const targets =
      mode === "all"
        ? branches.filter((b) => !b.incomplete)
        : branches.filter((b) => b.branchId === selected && !b.incomplete);
    if (targets.length === 0) return;

    setBusy(true);
    const startedDirtySeq = dirtySeqRef.current;
    try {
      const overlay = readLocalSnapshotOverlay();
      if (mode === "all") {
        for (const target of targets) {
          await uploadSnapshotData(
            cfg,
            { ...target.data, ...overlay },
            { branchId: target.branchId, branchName: target.branchName, force: forceUpload },
          );
        }
      } else {
        await uploadSnapshotData(
          cfg,
          { ...targets[0].data, ...overlay },
          { branchId: targets[0].branchId, branchName: targets[0].branchName, force: forceUpload },
        );
      }
      setConfirmPush(null);
      setConflictRetry(null);
      if (dirtySeqRef.current === startedDirtySeq) setDirty(false);
      setBranches(getCachedBranches());
      if (!silent) {
        setMsg({
          type: "success",
          text:
            mode === "all"
              ? `تم الرفع إلى ${targets.length} فروع`
              : `تم الرفع لفرع: ${targets[0].branchName}`,
        });
      }
      await doFetch(true);
    } catch (e: any) {
      if (e instanceof BranchVersionConflictError) {
        logBranchAudit({
          kind: "conflict",
          actor: "manager",
          branchId: e.branchId,
          branchName: e.branchName,
          ok: false,
          message: e.message,
          version: e.remoteVersion,
          parentVersion: e.parentVersion,
        });
        // Only surface the conflict modal for explicit user actions. Silent
        // auto-pushes already use force=true so this branch is effectively
        // for manual pushes that raced a branch upload.
        if (!silent) setConflictRetry({ mode, error: e });
      } else if (!silent) {
        setMsg({ type: "error", text: e.message || "فشل الرفع" });
      } else {
        console.warn("silent auto-push failed:", e?.message || e);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!dirty || busy || editServer || branches.length === 0) return;
    const mode = selected === "all" ? "all" : "one";
    const t = window.setTimeout(() => {
      pushCurrentSelection(mode, true);
    }, AUTO_PUSH_DELAY_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, selected, branches.length, busy, editServer]);

  const saveServer = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const next: TelegramConfig = {
        ...(cfg ||
          ({
            branchId: "manager",
            branchName: "مدير الفروع",
            autoSyncMinutes: 0,
            role: "manager",
          } as any)),
        botToken: tmpToken.trim(),
        chatId: normalizeChatId(tmpChat.trim()),
        role: "manager",
      };
      const r = await testConnection(next);
      saveManagerTelegramConfig(next);
      setCfg(next);
      setEditServer(false);
      setMsg({ type: "success", text: `متصل — @${r.botName}` });
      await doFetch(true);
    } catch (e: any) {
      setMsg({ type: "error", text: e.message || "فشل الاتصال" });
    } finally {
      setBusy(false);
    }
  };

  // ─── Password gate first ───
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-14 flex items-center px-4 bg-card border-b border-border">
          <button
            onClick={onBack}
            className="flex items-center gap-2 font-cairo font-bold text-sm text-muted-foreground"
          >
            <ArrowRight className="w-4 h-4" /> رجوع
          </button>
          <h1 className="flex-1 text-center font-cairo font-black">مدير الفروع</h1>
        </div>
        <PasswordGate
          title="دخول مدير الفروع"
          mode={isManagerCredsSet() ? "manager" : "activation"}
          onSuccess={() => {
            try {
              localStorage.setItem(BRANCH_MGR_TRUSTED_KEY, "1");
            } catch {
              /* ignore */
            }
            setUnlocked(true);
          }}
          onCancel={onBack}
        />
      </div>
    );
  }

  // ─── Inline server setup ───
  if (!cfg?.botToken || editServer) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-14 flex items-center justify-between px-4 bg-card border-b border-border">
          <button
            onClick={onBack}
            className="flex items-center gap-2 font-cairo font-bold text-sm text-muted-foreground"
          >
            <ArrowRight className="w-4 h-4" /> رجوع
          </button>
          <h1 className="font-cairo font-black flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> إعداد السيرفر
          </h1>
          <span className="w-14" />
        </div>
        <div className="max-w-md mx-auto p-6 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="font-cairo text-sm text-muted-foreground">
              ادخل بيانات البوت والقناة عشان تجيب بيانات كل الفروع.
            </p>
            <div>
              <label className="font-cairo text-xs text-muted-foreground">Bot Token</label>
              <input
                type="password"
                value={tmpToken}
                onChange={(e) => setTmpToken(e.target.value)}
                placeholder="123456:ABC..."
                className="w-full px-3 py-2 bg-secondary border border-border rounded font-mono text-xs"
              />
            </div>
            <div>
              <label className="font-cairo text-xs text-muted-foreground">Chat ID</label>
              <input
                value={tmpChat}
                onChange={(e) => setTmpChat(e.target.value)}
                placeholder="-1001234567890"
                className="w-full px-3 py-2 bg-secondary border border-border rounded font-mono text-xs"
              />
            </div>
            {msg && (
              <div
                className={`flex items-center gap-2 p-2 rounded font-cairo text-sm ${msg.type === "success" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}
              >
                {msg.type === "success" ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {msg.text}
              </div>
            )}
            <div className="flex gap-2">
              {cfg?.botToken && (
                <button
                  onClick={() => setEditServer(false)}
                  className="px-4 py-2 bg-secondary rounded font-cairo text-sm"
                >
                  إلغاء
                </button>
              )}
              <button
                onClick={saveServer}
                disabled={busy || !tmpToken || !tmpChat}
                className="flex-1 py-2 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm disabled:opacity-50"
              >
                {busy ? "جاري الاتصال..." : "اتصال وحفظ"}
              </button>
            </div>
            {cfg?.botToken && (
              <>
                <button
                  onClick={() => setShowCredentialsDialog(true)}
                  className="w-full mt-2 py-2 flex items-center justify-center gap-2 bg-secondary border border-border rounded font-cairo font-bold text-xs hover:bg-secondary/80"
                >
                  <LockIcon className="w-3.5 h-3.5" /> تغيير بيانات دخول مدير الفروع
                </button>
                <button
                  onClick={() => {
                    if (
                      !confirm(
                        "هيتم إزالة وضع مدير الفروع من هذا الجهاز. تقدر بعدها ترجع تدخل كمدير فرع أو كاشير عادي. تكمل؟",
                      )
                    )
                      return;
                    try {
                      localStorage.removeItem("pos_telegram_manager_config");
                      localStorage.removeItem(BRANCH_MGR_TRUSTED_KEY);
                    } catch {
                      /* ignore */
                    }
                    setCfg(null);
                    setTmpToken("");
                    setTmpChat("");
                    setMsg({ type: "success", text: "تمت الإزالة. ارجع لشاشة البداية." });
                    setTimeout(() => onBack(), 800);
                  }}
                  className="w-full mt-2 py-2 border border-destructive/50 text-destructive rounded font-cairo font-bold text-xs hover:bg-destructive/10"
                >
                  إزالة وضع مدير الفروع من هذا الجهاز
                </button>
              </>
            )}
          </div>
          {showCredentialsDialog && (
            <ManagerCredentialsDialog onClose={() => setShowCredentialsDialog(false)} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Responsive toolbar: stacked on mobile, single row on md+. */}
      <div className="bg-supermarket/10 border-b border-supermarket/30 px-4 py-2 flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 md:gap-3">
        {/* Header group */}
        <div className="flex items-center justify-between gap-3 shrink-0 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-xs font-cairo font-bold text-muted-foreground hover:text-foreground touch-target"
            >
              <ArrowRight className="w-4 h-4" /> خروج
            </button>
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-supermarket" />
              <span className="font-cairo font-black text-sm">مدير الفروع</span>
            </div>
          </div>
          <button
            onClick={toggleToolbar}
            title={toolbarCollapsed ? "إظهار أدوات المزامنة" : "إخفاء أدوات المزامنة لإتاحة مساحة أكبر"}
            aria-label={toolbarCollapsed ? "إظهار الأدوات" : "إخفاء الأدوات"}
            className="flex items-center gap-1 px-2 py-1 bg-card border border-supermarket/40 rounded font-cairo text-[10px] font-bold text-supermarket hover:bg-supermarket/10 touch-target md:hidden"
          >
            {toolbarCollapsed ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> أدوات
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> إخفاء
              </>
            )}
          </button>
        </div>

        {!toolbarCollapsed && (
          <>
            {/* Branch selector — full width on mobile, natural on desktop. */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
              <select
                value={selected}
                onChange={(e) => handleSelectBranch(e.target.value)}
                className="w-full md:max-w-xs min-w-0 px-3 py-1.5 bg-card border border-border rounded font-cairo text-sm truncate"
              >
                <option value="all">📊 كل الفروع (مجمّع)</option>
                {branches.map((b) => (
                  <option key={b.branchId} value={b.branchId}>
                    {b.branchName} — {new Date(b.timestamp).toLocaleString("ar-EG")}
                  </option>
                ))}
              </select>
            </div>

            {/* Action buttons — horizontal scroll on mobile, natural wrap on desktop. */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 md:overflow-visible md:mr-auto md:border-r md:border-supermarket/30 md:pr-3 no-scrollbar">
              <button
                onClick={() => doFetch(false)}
                disabled={busy}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-xs disabled:opacity-50 touch-target"
              >
                <RefreshCw className={`w-3 h-3 ${busy ? "animate-spin" : ""}`} />
                تحديث الآن
              </button>
              <button
                onClick={doBackup}
                title={
                  selectedBranch ? "تنزيل نسخة احتياطية للفرع الحالي" : "تنزيل نسخة احتياطية لكل الفروع"
                }
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-secondary border border-border rounded font-cairo text-xs touch-target"
              >
                <Save className="w-3 h-3" /> نسخة احتياطية
              </button>
              <button
                onClick={() => restoreInputRef.current?.click()}
                title="استعادة من ملف"
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-secondary border border-border rounded font-cairo text-xs touch-target"
              >
                <FolderOpen className="w-3 h-3" /> استعادة
              </button>
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) doRestore(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => setShowAudit(true)}
                title="سجل المزامنة"
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-secondary border border-border rounded font-cairo text-xs touch-target"
              >
                <ClipboardList className="w-3 h-3" /> السجل
              </button>
              <button
                onClick={() => {
                  setUnlocked(false);
                  setEditServer(true);
                }}
                title="تعديل السيرفر (يطلب كلمة المرور)"
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-secondary border border-border rounded font-cairo text-xs touch-target"
              >
                <Settings2 className="w-3 h-3" /> تعديل السيرفر
              </button>
            </div>

            {/* Status chips */}
            <div className="flex items-center gap-3 text-[10px] font-cairo shrink-0">
              {lastRefresh > 0 && (
                <span className="text-muted-foreground">
                  آخر تحديث: {new Date(lastRefresh).toLocaleTimeString("ar-EG")}
                </span>
              )}
              {dirty && <span className="font-bold text-cafe">تعديلات غير مرفوعة</span>}
            </div>
          </>
        )}

        {/* Desktop-only toggle at the end so the compact/expanded row also collapses on wide screens if needed. */}
        <button
          onClick={toggleToolbar}
          title={toolbarCollapsed ? "إظهار الأدوات" : "إخفاء الأدوات"}
          className="hidden md:flex items-center gap-1 px-2 py-1 bg-card border border-supermarket/40 rounded font-cairo text-[10px] font-bold text-supermarket hover:bg-supermarket/10"
        >
          {toolbarCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          {toolbarCollapsed ? "إظهار" : "إخفاء"}
        </button>
      </div>


      {/* Danger row — kept on its own line, far from the refresh button, on
          every screen size, so it's impossible to hit "حذف الفرع" by accident. */}
      {selectedBranch && !toolbarCollapsed && (
        <div className="bg-destructive/5 border-b border-destructive/20 px-4 py-2 flex items-center justify-start md:justify-end">
          <button
            onClick={() => setConfirmDelete(selectedBranch)}
            title={`حذف "${selectedBranch.branchName}" من القناة`}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-destructive/50 text-destructive rounded font-cairo font-bold text-xs hover:bg-destructive/10 touch-target"
          >
            <Trash2 className="w-3.5 h-3.5" /> حذف الفرع من القناة
          </button>
        </div>
      )}

      {rate && (
        <div className="bg-cafe/10 border-b border-cafe/30 px-4 py-1.5 flex items-center gap-2 font-cairo text-xs text-cafe-foreground">
          <Sparkles className="w-3 h-3 text-cafe" />
          حماية من الحظر: بننتظر {(rate.waitMs / 1000).toFixed(1)} ثانية ({rate.queue}/12 طلب/ث)
        </div>
      )}

      {progress.stage !== "idle" && progress.stage !== "done" && (
        <div
          className={`px-4 py-1.5 flex items-center gap-2 font-cairo text-xs ${progress.stage === "error" ? "bg-destructive/15 text-destructive" : progress.stage === "retrying" ? "bg-cafe/15 text-cafe-foreground" : "bg-supermarket/15 text-supermarket"}`}
        >
          <RefreshCw
            className={`w-3 h-3 ${progress.stage === "uploading" || progress.stage === "downloading" || progress.stage === "retrying" ? "animate-spin" : ""}`}
          />
          <span className="font-bold">{progress.branchName || ""}</span>
          <span>{progress.message || progress.stage}</span>
          {progress.total ? (
            <span className="mr-auto">
              {progress.current}/{progress.total}
            </span>
          ) : null}
        </div>
      )}

      {msg && (
        <div
          className={`px-4 py-1.5 flex items-center gap-2 font-cairo text-xs ${msg.type === "success" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}
        >
          {msg.type === "success" ? (
            <CheckCircle className="w-3 h-3" />
          ) : (
            <AlertTriangle className="w-3 h-3" />
          )}
          <span className="flex-1">{msg.text}</span>
          <button
            onClick={() => setMsg(null)}
            title="إغلاق"
            className="opacity-70 hover:opacity-100 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {incompleteBranches.length > 0 && (() => {
        const key = incompleteBranches.map((b) => `${b.branchId}:${b.timestamp}`).join("|");
        if (dismissedIncompleteAll === key) return null;
        return (
          <div className="bg-cafe/15 border-b border-cafe/25 px-4 py-2 font-cairo text-xs text-cafe-foreground leading-6 flex items-start gap-2">
            <div className="flex-1">
              <b>جاري تحديث بيانات هذه الفروع تلقائياً:</b>{" "}
              {incompleteBranches.map((b) => b.branchName).join("، ")} — البرنامج
              هيسحب النسخة الجديدة أول ما تتوفر على القناة.
            </div>
            <button
              onClick={() => setDismissedIncompleteAll(key)}
              title="إغلاق"
              className="opacity-70 hover:opacity-100 shrink-0 mt-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })()}

      {selectedBranch?.incomplete && (() => {
        const key = `${selectedBranch.branchId}:${selectedBranch.timestamp}`;
        if (dismissedIncompleteSelected === key) return null;
        return (
          <div className="bg-cafe/15 border-b border-cafe/25 px-4 py-2 font-cairo text-xs text-cafe-foreground leading-6 flex items-start gap-2">
            <span className="flex-1">جاري تحميل بيانات هذا الفرع تلقائياً من القناة…</span>
            <button
              onClick={() => setDismissedIncompleteSelected(key)}
              title="إغلاق"
              className="opacity-70 hover:opacity-100 shrink-0 mt-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })()}


      {toolbarCollapsed ? (
        <div className="bg-cafe/10 border-b border-cafe/30 px-4 py-1 flex items-center justify-end">
          <button
            onClick={() => setConfirmPush(selected === "all" ? "all" : "one")}
            disabled={busy || (selected === "all" && branches.length === 0)}
            className="flex items-center gap-1 px-3 py-1 bg-cafe text-cafe-foreground rounded font-cairo font-bold text-xs disabled:opacity-50"
          >
            <Upload className="w-3 h-3" />
            {selected === "all" ? "رفع لكل الفروع" : "رفع للفرع"}
          </button>
        </div>
      ) : editBarDismissed ? null : selected === "all" ? (
        <div className="bg-cafe/10 border-b border-cafe/30 px-4 py-1.5 text-[11px] font-cairo text-cafe-foreground flex items-center gap-2 flex-wrap">
          <Pencil className="w-3 h-3" /> وضع تعديل جماعي — أي تغيير هيتحفظ محلياً، اضغط{" "}
          <b>"تأكيد ورفع لكل الفروع"</b> عشان يوصل لكل الفروع.
          <button
            onClick={() => setConfirmPush("all")}
            disabled={busy || branches.length === 0}
            className="mr-auto flex items-center gap-1 px-3 py-1 bg-cafe text-cafe-foreground rounded font-cairo font-bold text-xs disabled:opacity-50"
          >
            <Upload className="w-3 h-3" /> تأكيد ورفع لكل الفروع
          </button>
          <button
            onClick={() => setEditBarDismissed(true)}
            title="إغلاق"
            className="opacity-70 hover:opacity-100 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="bg-cafe/10 border-b border-cafe/30 px-4 py-1.5 text-[11px] font-cairo text-cafe-foreground flex items-center gap-2 flex-wrap">
          <Pencil className="w-3 h-3" /> وضع تعديل — أي تغيير هيتحفظ محلياً، اضغط{" "}
          <b>"تأكيد ورفع للفرع"</b> عشان يوصل لفرع: <b>{currentLabel}</b>
          <button
            onClick={() => setConfirmPush("one")}
            disabled={busy}
            className="mr-auto flex items-center gap-1 px-3 py-1 bg-cafe text-cafe-foreground rounded font-cairo font-bold text-xs disabled:opacity-50"
          >
            <Upload className="w-3 h-3" /> تأكيد ورفع للفرع
          </button>
          <button
            onClick={() => setEditBarDismissed(true)}
            title="إغلاق"
            className="opacity-70 hover:opacity-100 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {branches.length === 0 ? (
          <div className="h-full flex items-center justify-center p-6">
            <div className="max-w-lg w-full bg-card border border-border rounded-lg p-6 text-center space-y-4">
              <Database className="w-12 h-12 mx-auto text-supermarket" />
              <h2 className="font-cairo font-black text-xl">لسه مفيش فروع محمّلة</h2>
              <p className="font-cairo text-sm text-muted-foreground leading-7">
                تأكد إن الفرع رفع نسخة على القناة، ثم اضغط <b>تحديث الآن</b>.<br />
                لو لسه مش ظاهر، اضغط <b>فحص القناة</b> تشوف إذا السيرفر بيبعت الرسايل ولا لأ.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => doFetch(false)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${busy ? "animate-spin" : ""}`} /> جلب الآن
                </button>
                <button
                  onClick={doDiagnose}
                  disabled={diagnostic.busy}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-secondary border border-border rounded font-cairo font-bold text-sm disabled:opacity-50"
                >
                  <Eye className={`w-4 h-4 ${diagnostic.busy ? "animate-spin" : ""}`} /> فحص القناة
                </button>
              </div>

              {diagnostic.error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded font-cairo text-xs text-right">
                  <b>مشكلة:</b> {diagnostic.error}
                </div>
              )}
              {diagnostic.ok && (
                <div className="p-3 bg-secondary/60 rounded font-cairo text-xs text-right space-y-1">
                  <div className="font-bold">نتيجة الفحص:</div>
                  <div>
                    فهرس الفروع المثبت:{" "}
                    {diagnostic.manifestMessageId
                      ? `موجود #${diagnostic.manifestMessageId}`
                      : "غير موجود"}
                  </div>
                  <div>الفروع في الفهرس: {diagnostic.manifestBranches?.length || 0}</div>
                  <div>آخر رسايل getUpdates: {diagnostic.updatesCount}</div>
                  <div>فروع قابلة للتحميل: {diagnostic.branchMessages?.length || 0}</div>
                  {diagnostic.branchMessages && diagnostic.branchMessages.length > 0 && (
                    <ul className="list-disc pr-4 space-y-0.5">
                      {diagnostic.branchMessages.map((m) => (
                        <li key={m.messageId}>
                          {m.branchName} ({m.branchId}) — #{m.messageId}
                        </li>
                      ))}
                    </ul>
                  )}
                  {diagnostic.branchMessages?.length === 0 &&
                    diagnostic.updatesCount &&
                    diagnostic.updatesCount > 0 && (
                      <div className="text-destructive mt-1">
                        ⚠️ القناة فيها رسايل، لكن مفيش فهرس مثبت ولا ملفات فروع قابلة للقراءة. اضغط
                        "رفع نسخة الفرع الآن" من جهاز الفرع مرة بعد هذا التحديث.
                      </div>
                    )}
                  {diagnostic.updatesCount === 0 && (
                    <div className="text-destructive mt-1">
                      ⚠️ مفيش فهرس مثبت ظاهر. افتح جهاز الفرع واضغط "رفع نسخة الفرع الآن"؛ البرنامج
                      هيعمل رسالة فهرس ويثبتها في القناة تلقائياً.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <AdminDashboard
            key={dashKey}
            onBack={handleBack}
            embedded
            hideBack
            tabStorageKey="branch-manager-admin-tab"
            title={`مدير الفروع — ${currentLabel}`}
          />
        )}
      </div>

      {confirmPush &&
        (() => {
          const targets =
            confirmPush === "all"
              ? branches.filter((b) => !b.incomplete)
              : branches.filter((b) => b.branchId === selected && !b.incomplete);
          if (targets.length === 0) return null;
          return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4">
                <h3 className="font-cairo font-black text-lg">تأكيد رفع التعديلات</h3>
                <p className="font-cairo text-sm">
                  {confirmPush === "all"
                    ? "هيتم رفع النسخة الحالية لكل الفروع التالية:"
                    : "هيتم رفع النسخة الحالية للقناة تحت هوية الفرع:"}
                </p>
                <div className="p-3 bg-secondary rounded font-cairo">
                  {targets.map((target) => (
                    <div
                      key={target.branchId}
                      className="py-1 border-b border-border/50 last:border-0"
                    >
                      <div className="font-bold">{target.branchName}</div>
                      <div className="text-xs text-muted-foreground">{target.branchId}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setConfirmPush(null)}
                    className="px-4 py-2 bg-secondary rounded font-cairo text-sm"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={async () => {
                      await pushCurrentSelection(confirmPush);
                    }}
                    disabled={busy}
                    className="px-4 py-2 bg-cafe text-cafe-foreground rounded font-cairo font-bold text-sm disabled:opacity-50"
                  >
                    {busy ? "جاري الرفع..." : "تأكيد ورفع"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {pendingSelect !== null &&
        (() => {
          const label =
            pendingSelect === "all"
              ? `كل الفروع (${branches.length})`
              : branches.find((b) => b.branchId === pendingSelect)?.branchName || pendingSelect;
          return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4">
                <h3 className="font-cairo font-black text-lg">تأكيد اختيار الفرع</h3>
                <p className="font-cairo text-sm">إنت هتشتغل دلوقتي على:</p>
                <div className="p-3 bg-secondary rounded font-cairo font-bold text-center text-base">
                  {label}
                </div>
                <p className="font-cairo text-xs text-muted-foreground leading-6">
                  أي تعديل هتعمله جوه لوحة المدير هيتحفظ محلياً على النسخة اللي بتعرضها لهذا الفرع،
                  ولما تدوس "تأكيد ورفع" هيتنقل للفرع (أو للفروع كلها لو اخترت "كل الفروع").
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setPendingSelect(null)}
                    className="px-4 py-2 bg-secondary rounded font-cairo text-sm"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={confirmSelection}
                    className="px-4 py-2 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm"
                  >
                    تأكيد الدخول
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-cairo font-black text-lg text-destructive">حذف الفرع من القناة</h3>
            <p className="font-cairo text-sm leading-7">
              هيتم إزالة الفرع <b>{confirmDelete.branchName}</b> من فهرس القناة ومن قايمة الفروع
              عندك. الجهاز اللي شغّال عليه الفرع ده لسه هيقدر يرفع نسخة جديدة ما لم تلغي الربط من
              جهازه نفسه.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 bg-secondary rounded font-cairo text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={() => doDelete(confirmDelete)}
                disabled={busy}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded font-cairo font-bold text-sm disabled:opacity-50"
              >
                {busy ? "جاري الحذف..." : "حذف نهائي"}
              </button>
            </div>
          </div>
        </div>
      )}

      {conflictRetry && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-destructive/40 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-cairo font-black text-lg text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> تعارض إصدار
            </h3>
            <p className="font-cairo text-sm leading-7">
              الفرع <b>{conflictRetry.error.branchName}</b> اتحدث من مكان تاني بعد ما بدأت تعديلك.
              <br />
              نسختك المحلية بنيت على v{conflictRetry.error.parentVersion}، والنسخة الحالية على
              القناة v{conflictRetry.error.remoteVersion}.
            </p>
            <p className="font-cairo text-xs text-muted-foreground">
              الأفضل تعمل تحديث الآن، تراجع تعديلاتك، وترفعها تاني. أو تفرض الرفع لو أنت متأكد إن
              نسختك أحدث.
            </p>
            <div className="flex gap-2 justify-end flex-wrap">
              <button
                onClick={() => setConflictRetry(null)}
                className="px-4 py-2 bg-secondary rounded font-cairo text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={async () => {
                  setConflictRetry(null);
                  await doFetch(false);
                }}
                className="px-4 py-2 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm"
              >
                تحديث الآن (يفقد تعديلاتك)
              </button>
              <button
                onClick={() => pushCurrentSelection(conflictRetry.mode, false, { force: true })}
                disabled={busy}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded font-cairo font-bold text-sm disabled:opacity-50"
              >
                فرض الرفع
              </button>
            </div>
          </div>
        </div>
      )}

      {showAudit && <BranchSyncAuditPanel onClose={() => setShowAudit(false)} />}
    </div>
  );
};

export default BranchManagerDashboard;

// ─── Manager credentials dialog ──────────────────────────────────────────
// Local-only login for the manager device. Not synced through Telegram —
// changing branch admin credentials from the manager side no longer touches
// this store, and vice versa. When set, the rotating-password gate also
// accepts these credentials (see PasswordGate).
function ManagerCredentialsDialog({ onClose }: { onClose: () => void }) {
  const existing = getManagerCredentials();
  const [username, setUsername] = useState(existing?.username || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || username.trim().length < 3) {
      setMsg({ type: "error", text: "اسم المستخدم لازم يكون 3 حروف على الأقل." });
      return;
    }
    if (!password || password.length < 4) {
      setMsg({ type: "error", text: "كلمة المرور لازم 4 خانات على الأقل." });
      return;
    }
    if (password !== confirm) {
      setMsg({ type: "error", text: "كلمة المرور والتأكيد مش متطابقين." });
      return;
    }
    setManagerCredentials({ username: username.trim(), password });
    setPassword("");
    setConfirm("");
    setMsg({ type: "success", text: "تم حفظ بيانات دخول مدير الفروع (على هذا الجهاز فقط)." });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-5 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LockIcon className="w-4 h-4 text-supermarket" />
            <h3 className="font-cairo font-black text-sm">تغيير بيانات دخول مدير الفروع</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
        <p className="font-cairo text-[11px] text-muted-foreground leading-relaxed">
          دي بيانات دخول <b>محلية على الجهاز ده فقط</b>، مش بتتنقل لأي فرع ولا للسيرفر. لما تتحفظ،
          تقدر تدخل بيها من غير ما تستنى كلمة المرور المتغيرة.
        </p>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="font-cairo text-xs text-muted-foreground">اسم المستخدم</label>
            <input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setMsg(null);
              }}
              className="w-full px-3 py-2 bg-secondary border border-border rounded font-cairo text-sm"
            />
          </div>
          <div>
            <label className="font-cairo text-xs text-muted-foreground">كلمة المرور الجديدة</label>
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setMsg(null);
              }}
              className="w-full px-3 py-2 bg-secondary border border-border rounded font-mono text-sm"
            />
          </div>
          <div>
            <label className="font-cairo text-xs text-muted-foreground">تأكيد كلمة المرور</label>
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setMsg(null);
              }}
              className="w-full px-3 py-2 bg-secondary border border-border rounded font-mono text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-cairo text-muted-foreground">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            إظهار كلمة المرور
          </label>
          {msg && (
            <div
              className={`flex items-center gap-2 p-2 rounded font-cairo text-xs ${msg.type === "success" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}
            >
              {msg.type === "success" ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              {msg.text}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-secondary rounded font-cairo text-sm"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-supermarket text-supermarket-foreground rounded font-cairo font-bold text-sm"
            >
              {existing ? "تحديث" : "حفظ"}
            </button>
          </div>
        </form>
        <p className="font-cairo text-[11px] text-muted-foreground leading-relaxed">
          نسيت كلمة المرور؟ استخدم بيانات الاسترداد الرئيسية:
          <b> Proofahmed / 24682468</b> — أو كلمة المرور المتغيرة اللي بتتغير كل 5 دقايق.
        </p>
      </div>
    </div>
  );
}
