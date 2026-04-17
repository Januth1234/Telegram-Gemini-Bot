const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('orinDesktop', {
  version: 1, shell: 'desktop',
  startLocalPcAgent: () => ipcRenderer.invoke('start-local-agent'),
  stopLocalPcAgent:  () => ipcRenderer.invoke('stop-local-agent'),
  agentStatus:       () => ipcRenderer.invoke('agent-status'),
});
