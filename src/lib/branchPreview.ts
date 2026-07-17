// Branch preview: temporarily swap this device's localStorage with a branch
// snapshot so the whole existing admin UI can render that branch's data
// without any modification. The original device data is backed up in
// localStorage and restored on exit — or on next app boot if the tab/app was
// closed while a preview was active.

import { BranchSnapshot, runWithoutTelegramDirtyTracking } from "./telegramSync";
import { runWithoutNativePersistence } from "./nativePersistence";

const BACKUP_KEY = "pos_internal_branch_preview_backup";
const ACTIVE_FLAG = "pos_internal_branch_preview_active";

const PREVIEW_KEYS = [
  "pos_products",
  "pos_sales",
  "pos_expenses",
  "pos_income",
  "pos_cashiers",
  "pos_cashier_sessions",
  "pos_returns",
  "pos_settings",
  "pos_store_info",
  "pos_categories_supermarket",
  "pos_categories_cafe",
  "pos_held_invoices",
  "pos_coupons",
  "pos_product_offers",
  "pos_purchases",
  "pos_global_cashier_permissions",
  "pos_admin_activity_log",
  "pos_used_invoice_numbers",
  "pos_custom_shortcuts",
  "pos_font_config",
  "pos_font_permission_cashier",
  "pos_theme",
  "pos_theme_color",
  "pos_admin_credentials",
];

let applyingPreview = false;
let previewWatcherInstalled = false;
let originalSetItem: typeof Storage.prototype.setItem | null = null;
let originalRemoveItem: typeof Storage.prototype.removeItem | null = null;

function installPreviewStorageWatcher() {
  if (previewWatcherInstalled || typeof window === "undefined") return;
  previewWatcherInstalled = true;
  originalSetItem = Storage.prototype.setItem;
  originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.setItem = function patchedPreviewSetItem(key: string, value: string) {
    originalSetItem!.call(this, key, value);
    if (
      this === window.localStorage &&
      PREVIEW_KEYS.includes(key) &&
      isInBranchPreview() &&
      !applyingPreview
    ) {
      window.dispatchEvent(new CustomEvent("pos-branch-preview-dirty", { detail: { key } }));
    }
  };

  Storage.prototype.removeItem = function patchedPreviewRemoveItem(key: string) {
    originalRemoveItem!.call(this, key);
    if (
      this === window.localStorage &&
      PREVIEW_KEYS.includes(key) &&
      isInBranchPreview() &&
      !applyingPreview
    ) {
      window.dispatchEvent(new CustomEvent("pos-branch-preview-dirty", { detail: { key } }));
    }
  };
}

export function isInBranchPreview(): boolean {
  return localStorage.getItem(ACTIVE_FLAG) === "1";
}

/** Called once on app boot to guarantee no stale preview data leaks in. */
export function safeguardBranchPreviewOnBoot() {
  // If backup exists after refresh/relaunch, restore original device data.
  if (localStorage.getItem(BACKUP_KEY)) {
    exitBranchPreview();
  }
}

export function enterBranchPreview(snapshotData: Record<string, any>) {
  installPreviewStorageWatcher();
  applyingPreview = true;
  try {
    runWithoutTelegramDirtyTracking(() => {
      runWithoutNativePersistence(() => {
        if (!localStorage.getItem(BACKUP_KEY)) {
          const backup: Record<string, string | null> = {};
          for (const k of PREVIEW_KEYS) backup[k] = localStorage.getItem(k);
          localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
        }
        // On a manager device, keep the local admin credentials intact.
        const isManagerDevice = localStorage.getItem("pos_telegram_manager_config") !== null;
        for (const k of PREVIEW_KEYS) {
          if (k === "pos_admin_credentials" && isManagerDevice) continue;
          const v = snapshotData[k];
          if (v !== undefined && v !== null) {
            localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
          } else {
            localStorage.removeItem(k);
          }
        }
      });
    });
  } finally {
    applyingPreview = false;
  }
  localStorage.setItem(ACTIVE_FLAG, "1");
}

export function reapplyBranchPreview(snapshotData: Record<string, any>) {
  installPreviewStorageWatcher();
  if (!localStorage.getItem(BACKUP_KEY)) {
    enterBranchPreview(snapshotData);
    return;
  }
  applyingPreview = true;
  try {
    runWithoutTelegramDirtyTracking(() => {
      runWithoutNativePersistence(() => {
        const isManagerDevice = localStorage.getItem("pos_telegram_manager_config") !== null;
        for (const k of PREVIEW_KEYS) {
          if (k === "pos_admin_credentials" && isManagerDevice) continue;
          const v = snapshotData[k];
          if (v !== undefined && v !== null) {
            localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
          } else {
            localStorage.removeItem(k);
          }
        }
      });
    });
  } finally {
    applyingPreview = false;
  }
  localStorage.setItem(ACTIVE_FLAG, "1");
}

export function exitBranchPreview() {
  const raw = localStorage.getItem(BACKUP_KEY);
  if (raw) {
    try {
      const backup: Record<string, string | null> = JSON.parse(raw);
      runWithoutTelegramDirtyTracking(() => {
        runWithoutNativePersistence(() => {
          for (const [k, v] of Object.entries(backup)) {
            if (v === null) localStorage.removeItem(k);
            else localStorage.setItem(k, v);
          }
        });
      });
    } catch {
      /* ignore */
    }
  }
  localStorage.removeItem(BACKUP_KEY);
  localStorage.removeItem(ACTIVE_FLAG);
}

/** Merge multiple branch snapshots into a single aggregated preview payload. */
export function buildAggregatedSnapshot(branches: BranchSnapshot[]): Record<string, any> {
  const merged: Record<string, any[]> = {
    pos_sales: [],
    pos_expenses: [],
    pos_income: [],
    pos_returns: [],
    pos_cashier_sessions: [],
    pos_held_invoices: [],
    pos_purchases: [],
  };
  const byId: Record<string, Map<string, any>> = {
    pos_products: new Map(),
    pos_cashiers: new Map(),
    pos_coupons: new Map(),
    pos_product_offers: new Map(),
    pos_categories_supermarket: new Map(),
    pos_categories_cafe: new Map(),
  };

  for (const b of branches) {
    // Concat lists, tag with branch for traceability
    for (const key of Object.keys(merged)) {
      const arr = (b.data?.[key] || []) as any[];
      for (const item of arr) {
        merged[key].push({ ...item, _branch: b.branchName });
      }
    }
    for (const key of Object.keys(byId)) {
      const arr = (b.data?.[key] || []) as any[];
      for (const item of arr) {
        if (item && item.id != null) byId[key].set(String(item.id), item);
      }
    }
  }

  const out: Record<string, any> = { ...merged };
  for (const [k, map] of Object.entries(byId)) out[k] = Array.from(map.values());
  out.pos_store_info = {
    name: `كل الفروع (${branches.length})`,
    address: "",
    phone: "",
    extra1Label: "",
    extra1Value: "",
    extra2Label: "",
    extra2Value: "",
  };
  return out;
}
