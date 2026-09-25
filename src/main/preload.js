const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('glmQuota', {
  getState: () => ipcRenderer.invoke('state:get'),
  refresh: (accountId) => ipcRenderer.invoke('quota:refresh', accountId || null),
  saveAccount: (account) => ipcRenderer.invoke('account:save', account),
  deleteAccount: (accountId) => ipcRenderer.invoke('account:delete', accountId),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  hide: () => ipcRenderer.invoke('window:hide'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('state:changed', handler);
    return () => ipcRenderer.removeListener('state:changed', handler);
  },
});
