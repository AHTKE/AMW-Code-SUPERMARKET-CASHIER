const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  toggleFullscreen: () => ipcRenderer.invoke('app:toggle-fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('app:is-fullscreen'),
  persistenceGetAll: () => ipcRenderer.invoke('persistence:get-all'),
  persistenceSet: (key, value) => ipcRenderer.invoke('persistence:set', key, value),
  persistenceRemove: (key) => ipcRenderer.invoke('persistence:remove', key),
});
