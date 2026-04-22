const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');

// Disable hardware acceleration for old GPUs / Windows 7
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');

// Single instance lock - prevent multiple windows
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow;
  let forceQuit = false;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      icon: path.join(__dirname, '..', 'build', 'icon.png'),
      title: 'SUPERMARKET CASHIER',
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });

    Menu.setApplicationMenu(null);
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      mainWindow.maximize();
    });

    // Close behavior: ask user — minimize, close shift first, or force quit
    mainWindow.on('close', (e) => {
      if (forceQuit) return;

      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: [
          'أنا راجع أكمل',      // 0 - minimize to taskbar
          'أغلق الشيفت الآن',    // 1 - keep open, user goes to close shift
          'إغلاق التطبيق',       // 2 - force quit
        ],
        defaultId: 0,
        cancelId: 0,
        title: 'إغلاق التطبيق',
        message: 'هل أنهيت الوردية (Shift)؟',
        detail: 'اختر "أنا راجع أكمل" لتصغير التطبيق إلى شريط المهام.\nاختر "أغلق الشيفت الآن" للعودة إلى التطبيق وإغلاق الشيفت.\nاختر "إغلاق التطبيق" للخروج نهائياً (الشيفت سيظل مفتوحاً).',
      });

      if (choice === 0) {
        // "أنا راجع أكمل" - cancel close
        e.preventDefault();
        mainWindow.minimize();
      } else if (choice === 1) {
        // Stay open so user can close shift inside app
        e.preventDefault();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      } else {
        // Force quit
        forceQuit = true;
      }
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  // Focus existing window when a second instance is launched
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
