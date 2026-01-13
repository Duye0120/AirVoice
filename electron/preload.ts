import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  onConnectionStatus: (callback: (status: boolean) => void) =>
    ipcRenderer.on('connection-status', (_, status) => callback(status)),
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  generateQRCode: (url: string) => ipcRenderer.invoke('generate-qrcode', url)
});
