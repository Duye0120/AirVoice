import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onConnectionStatus: (callback: (status: boolean) => void) => {
    const handler = (_: Electron.IpcRendererEvent, status: boolean) => callback(status);
    ipcRenderer.on('connection-status', handler);
    return () => ipcRenderer.removeListener('connection-status', handler);
  },
  onIPChanged: (callback: (data: { ip: string; port: number; qrCode: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { ip: string; port: number; qrCode: string }) => callback(data);
    ipcRenderer.on('ip-changed', handler);
    return () => ipcRenderer.removeListener('ip-changed', handler);
  },
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  generateQRCode: (url: string) => ipcRenderer.invoke('generate-qrcode', url),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowClose: () => ipcRenderer.send('window-close'),
  getAIConfig: () => ipcRenderer.invoke('get-ai-config'),
  saveAIConfig: (config: Record<string, unknown>) => ipcRenderer.invoke('save-ai-config', config),
  getRoleConfig: () => ipcRenderer.invoke('get-role-config'),
  saveRoleConfig: (config: Record<string, unknown>) => ipcRenderer.invoke('save-role-config', config),
  optimizeText: (text: string) => ipcRenderer.invoke('optimize-text', text),
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
});
