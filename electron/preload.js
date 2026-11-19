const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  info: () => ipcRenderer.invoke('info'),
  openDataDir: () => ipcRenderer.invoke('open-data-dir'),
  uninstall: () => ipcRenderer.invoke('uninstall'),
  autoBackup: json => ipcRenderer.invoke('auto-backup', json),
  openBackups: () => ipcRenderer.invoke('open-backups'),
  onOpenFile: cb => ipcRenderer.on('open-file', (_e, f) => cb(f)),
});
