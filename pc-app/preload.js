const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('orinDesktop', {
  version: 2, shell: 'desktop',
  startLocalPcAgent: () => ipcRenderer.invoke('start-local-agent'),
  stopLocalPcAgent:  () => ipcRenderer.invoke('stop-local-agent'),
  agentStatus:       () => ipcRenderer.invoke('agent-status'),
  /** Stage pair_id + pair_code into the local agent and (re)start it. */
  registerAgent:     (pairId, pairCode) => ipcRenderer.invoke('register-agent', { pair_id: pairId, pair_code: pairCode }),
  /** Open the system browser at the Orin login form and wait for approval (device flow). */
  browserLogin:      () => ipcRenderer.invoke('browser-login'),
});
