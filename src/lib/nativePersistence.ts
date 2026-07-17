const POS_KEY_PREFIX = 'pos_';
const MIRRORED_KEYS = new Set<string>([
  'pos_device_activated',
  'pos_device_id',
]);

type ElectronPersistence = {
  persistenceGetAll?: () => Promise<Record<string, string>>;
  persistenceSet?: (key: string, value: string) => Promise<boolean>;
  persistenceRemove?: (key: string) => Promise<boolean>;
};

let initialized = false;
let initializing: Promise<void> | null = null;
let storagePatched = false;
let nativeSet: ((key: string, value: string) => void) | null = null;
let nativeRemove: ((key: string) => void) | null = null;
let suspendMirror = false;

function shouldMirrorKey(key: string) {
  return key.startsWith(POS_KEY_PREFIX) || MIRRORED_KEYS.has(key);
}

export function runWithoutNativePersistence<T>(fn: () => T): T {
  const previous = suspendMirror;
  suspendMirror = true;
  try {
    return fn();
  } finally {
    suspendMirror = previous;
  }
}

function readLocalKeys(): Record<string, string> {
  const data: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !shouldMirrorKey(key)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    }
  } catch {
    /* ignore */
  }
  return data;
}

async function loadCapacitorBackup(): Promise<Record<string, string>> {
  try {
    const [{ Capacitor }, { Preferences }] = await Promise.all([
      import('@capacitor/core'),
      import('@capacitor/preferences'),
    ]);
    if (!Capacitor.isNativePlatform()) return {};
    const { keys } = await Preferences.keys();
    const data: Record<string, string> = {};
    await Promise.all(
      keys.filter(shouldMirrorKey).map(async (key) => {
        const { value } = await Preferences.get({ key });
        if (value !== null) data[key] = value;
      }),
    );
    nativeSet = (key, value) => {
      void Preferences.set({ key, value });
    };
    nativeRemove = (key) => {
      void Preferences.remove({ key });
    };
    return data;
  } catch {
    return {};
  }
}

async function loadElectronBackup(): Promise<Record<string, string>> {
  try {
    const api = window.electronAPI as (typeof window.electronAPI & ElectronPersistence) | undefined;
    if (!api?.persistenceGetAll) return {};
    nativeSet = (key, value) => {
      void api.persistenceSet?.(key, value);
    };
    nativeRemove = (key) => {
      void api.persistenceRemove?.(key);
    };
    return await api.persistenceGetAll();
  } catch {
    return {};
  }
}

function restoreMissingKeys(nativeData: Record<string, string>) {
  for (const [key, value] of Object.entries(nativeData)) {
    if (!shouldMirrorKey(key)) continue;
    try {
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, value);
      }
    } catch {
      /* ignore */
    }
  }
}

function seedNativeBackupFromLocal() {
  if (!nativeSet) return;
  const localData = readLocalKeys();
  for (const [key, value] of Object.entries(localData)) {
    nativeSet(key, value);
  }
}

function patchLocalStorageMirror() {
  if (storagePatched || typeof window === 'undefined' || !nativeSet) return;
  storagePatched = true;
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.setItem = function persistentSetItem(key: string, value: string) {
    originalSetItem.call(this, key, value);
    if (this === window.localStorage && shouldMirrorKey(key) && !suspendMirror) {
      nativeSet?.(key, value);
    }
  };

  Storage.prototype.removeItem = function persistentRemoveItem(key: string) {
    originalRemoveItem.call(this, key);
    if (this === window.localStorage && shouldMirrorKey(key) && !suspendMirror) {
      nativeRemove?.(key);
    }
  };
}

export function initializeNativePersistence(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (initialized) return Promise.resolve();
  if (initializing) return initializing;

  initializing = (async () => {
    const [electronData, capacitorData] = await Promise.all([
      loadElectronBackup(),
      loadCapacitorBackup(),
    ]);
    restoreMissingKeys({ ...capacitorData, ...electronData });
    seedNativeBackupFromLocal();
    patchLocalStorageMirror();
    initialized = true;
  })();

  return initializing;
}
