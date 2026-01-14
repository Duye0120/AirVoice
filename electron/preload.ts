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
  generateQRCode: (url: string) => ipcRenderer.invoke('generate-qrcode', url)
});
