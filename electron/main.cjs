const { app, BrowserWindow, Menu, protocol, net, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';

// Force the same sRGB output profile used by normal browser previews.  Do not
// disable color-correct rendering here: Tailwind v4 emits modern CSS colors
// (color-mix/oklab), and the desktop app must let Chromium render them natively.
app.commandLine.appendSwitch('force-color-profile', 'srgb');
// Keep GPU/hardware acceleration ENABLED — disabling it forces software
// compositing which on Windows renders colors darker and blurrier and
// breaks the visual parity with the web version. If a specific machine
// hangs, users can pass --disable-gpu on the command line manually.

// ---------------------------------------------------------------------------
// Custom "app://" protocol
//
// Loading the SPA over file:// breaks: Chromium refuses to fetch ES-module
// <script type="module"> from file:// (CORS: "Cross origin requests are only
// supported for protocol schemes: chrome, chrome-untrusted, data, http, https"),
// which produces the white screen. Serving the same files through a custom
// standard scheme lets modules, dynamic import(), fetch() and workers all work.
// ---------------------------------------------------------------------------
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function resolveClientDir() {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'client'),
    path.join(process.resourcesPath || '', 'dist', 'client'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'dist', 'client'),
  ];
  for (const c of candidates) {
    try { if (c && fs.existsSync(path.join(c, 'index.html'))) return c; } catch {}
  }
  return path.join(__dirname, '..', 'dist', 'client');
}

function registerAppProtocol() {
  const clientDir = resolveClientDir();
  const resolveRequestPath = (requestUrl) => {
    const parsed = new URL(requestUrl);
    // app://index/... -> strip host, use pathname
    let relPath = decodeURIComponent(parsed.pathname || '/');
    if (relPath === '/' || relPath === '') relPath = '/index.html';
    // Prevent directory traversal
    const target = path.normalize(path.join(clientDir, relPath));
    if (!target.startsWith(clientDir)) return null;
    return fs.existsSync(target) && fs.statSync(target).isFile()
      ? target
      : path.join(clientDir, 'index.html'); // SPA fallback
  };

  if (typeof protocol.handle === 'function') {
    protocol.handle('app', (request) => {
      try {
        const finalPath = resolveRequestPath(request.url);
        if (!finalPath) return new Response('Forbidden', { status: 403 });
        return net.fetch('file://' + finalPath.replace(/\\/g, '/'));
      } catch (err) {
        return new Response(`Error: ${err.message}`, { status: 500 });
      }
    });
    return;
  }

  protocol.registerFileProtocol('app', (request, callback) => {
    try {
      const finalPath = resolveRequestPath(request.url);
      callback(finalPath ? { path: finalPath } : { error: -10 });
    } catch (err) {
      callback({ error: -2 });
    }
  });
}

function resolveIcon() {
  const desktopIcon = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const candidates = [
    path.join(__dirname, '..', 'build', desktopIcon),
    path.join(process.resourcesPath || '', 'build', desktopIcon),
    path.join(__dirname, '..', 'build', 'icon.png'),
    path.join(process.resourcesPath || '', 'build', 'icon.png'),
    path.join(__dirname, '..', 'dist', 'client', 'icons', 'icon-512x512.png'),
    path.join(process.resourcesPath || '', 'dist', 'client', 'icons', 'icon-512x512.png'),
    path.join(__dirname, '..', 'public', 'icons', 'icon-512x512.png'),
  ];
  for (const p of candidates) {
    try { if (p && fs.existsSync(p)) return p; } catch {}
  }
  return undefined;
}

let mainWindow = null;

function persistenceFilePath() {
  return path.join(app.getPath('userData'), 'pos-persistence.json');
}

function readPersistence() {
  try {
    const file = persistenceFilePath();
    if (!fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePersistence(data) {
  const file = persistenceFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function isPersistedPosKey(key) {
  return typeof key === 'string' && key.startsWith('pos_');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Supermarket Cashier',
    icon: resolveIcon(),
    show: false,
    backgroundColor: '#2b3438',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);

  // Load via the custom protocol so ES modules load correctly.
  // TanStack Router runs in hash mode under non-http protocols (see src/router.tsx).
  mainWindow.loadURL('app://index/index.html#/');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setTitle('Supermarket Cashier');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (/^https?:\/\//i.test(targetUrl)) shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

ipcMain.handle('app:toggle-fullscreen', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(next);
  return next;
});

ipcMain.handle('app:is-fullscreen', () => Boolean(mainWindow?.isFullScreen()));

ipcMain.handle('persistence:get-all', () => readPersistence());

ipcMain.handle('persistence:set', (_event, key, value) => {
  if (!isPersistedPosKey(key) || typeof value !== 'string') return false;
  const data = readPersistence();
  data[key] = value;
  writePersistence(data);
  return true;
});

ipcMain.handle('persistence:remove', (_event, key) => {
  if (!isPersistedPosKey(key)) return false;
  const data = readPersistence();
  delete data[key];
  writePersistence(data);
  return true;
});

// Single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
