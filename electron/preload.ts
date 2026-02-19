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
  getImageSettings: () => ipcRenderer.invoke('get-image-settings'),
  saveImageSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('save-image-settings', settings),
  pickImageCacheDir: () => ipcRenderer.invoke('pick-image-cache-dir'),
  optimizeText: (text: string) => ipcRenderer.invoke('optimize-text', text),
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  // Chat API
  sendChatMessage: (content: string, sessionId?: string) => ipcRenderer.invoke('send-chat-message', content, sessionId),
  getChatSessions: () => ipcRenderer.invoke('get-chat-sessions'),
  getChatSession: (sessionId: string) => ipcRenderer.invoke('get-chat-session', sessionId),
  createChatSession: (title?: string) => ipcRenderer.invoke('create-chat-session', title),
  deleteChatSession: (sessionId: string) => ipcRenderer.invoke('delete-chat-session', sessionId),
  clearAllChatSessions: () => ipcRenderer.invoke('clear-all-chat-sessions'),
  setCurrentChatSession: (sessionId: string) => ipcRenderer.invoke('set-current-chat-session', sessionId),

  // Chat 流式事件监听
  onChatDelta: (callback: (data: { chatId: string; delta: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { chatId: string; delta: string }) => callback(data);
    ipcRenderer.on('chat-delta', handler);
    return () => ipcRenderer.removeListener('chat-delta', handler);
  },
  onChatToolCall: (callback: (data: { chatId: string; toolName: string; args: Record<string, unknown> }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { chatId: string; toolName: string; args: Record<string, unknown> }) => callback(data);
    ipcRenderer.on('chat-tool-call', handler);
    return () => ipcRenderer.removeListener('chat-tool-call', handler);
  },
  onChatToolResult: (callback: (data: { chatId: string; toolName: string; result: unknown }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { chatId: string; toolName: string; result: unknown }) => callback(data);
    ipcRenderer.on('chat-tool-result', handler);
    return () => ipcRenderer.removeListener('chat-tool-result', handler);
  },
  onChatDone: (callback: (data: { chatId: string; content: string; steps: unknown[] }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { chatId: string; content: string; steps: unknown[] }) => callback(data);
    ipcRenderer.on('chat-done', handler);
    return () => ipcRenderer.removeListener('chat-done', handler);
  },
  onChatError: (callback: (data: { chatId: string; error: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { chatId: string; error: string }) => callback(data);
    ipcRenderer.on('chat-error', handler);
    return () => ipcRenderer.removeListener('chat-error', handler);
  },
});
