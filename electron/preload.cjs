// Ponte mínima e tipada entre a interface e o processo principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  setHotkeys: (list) => ipcRenderer.invoke('hotkeys:set', list),
  suspendHotkeys: (suspended) => ipcRenderer.invoke('hotkeys:suspend', suspended),
  onHotkey: (callback) => {
    const listener = (_event, id) => callback(id);
    ipcRenderer.on('hotkey', listener);
    return () => ipcRenderer.removeListener('hotkey', listener);
  },
  setIdentity: (identity) => ipcRenderer.invoke('identity:set', identity),
  getAutoStart: () => ipcRenderer.invoke('autostart:get'),
  setAutoStart: (enabled) => ipcRenderer.invoke('autostart:set', enabled),
});
