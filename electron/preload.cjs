// Ponte mínima e tipada entre a interface e o processo principal.
const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  setHotkeys: (list) => ipcRenderer.invoke('hotkeys:set', list),
  suspendHotkeys: (suspended) => ipcRenderer.invoke('hotkeys:suspend', suspended),
  onHotkey: (callback) => subscribe('hotkey', callback),
  setIdentity: (identity) => ipcRenderer.invoke('identity:set', identity),
  getAutoStart: () => ipcRenderer.invoke('autostart:get'),
  setAutoStart: (enabled) => ipcRenderer.invoke('autostart:set', enabled),
  watchProcesses: (names) => ipcRenderer.invoke('processes:watch', names),
  onProcesses: (callback) => subscribe('processes', callback),
  listProcesses: () => ipcRenderer.invoke('processes:list'),
  pickExecutable: () => ipcRenderer.invoke('processes:pick'),
});
