import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu } from 'electron';
import path from 'path';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { createTray } from './tray';
import { startServer, getState, serverEvents, stopServer, loadHistory, saveHistory, notifyAIConfigChanged } from './server';
import { typeText, pasteImage } from './keyboard';
import {
  getConfig,
  getImageSettings,
  getRoleConfig,
  saveConfig,
  saveImageSettings,
  saveRoleConfig,
  type AIConfig,
  type ImageSettings,
  type RoleConfig,
} from './config';
import { optimizeText } from './ai';
import { runAgent } from './agent';
import {
  loadSessions,
  createSession,
  getCurrentSession,
  getSession,
  setCurrentSession,
  getSessions,
  deleteSession,
  clearAllSessions,
  addMessage,
  updateMessage,
} from './chat';
import type { ChatMessage, AgentStepInfo } from './types';

let mainWindow: BrowserWindow | null = null;
let lastText = '';

ipcMain.handle('get-server-info', () => getState());

ipcMain.handle('generate-qrcode', async (_, url: string) => {
  return await QRCode.toDataURL(url, { width: 200, margin: 1 });
});

ipcMain.handle('get-ai-config', () => getConfig());

ipcMain.handle('save-ai-config', (_, config: Partial<AIConfig>) => {
  const updated = saveConfig(config);
  notifyAIConfigChanged();
  return updated;
});

ipcMain.handle('get-role-config', () => getRoleConfig());

ipcMain.handle('save-role-config', (_, config: Partial<RoleConfig>) => saveRoleConfig(config));

ipcMain.handle('get-image-settings', () => getImageSettings());

ipcMain.handle('save-image-settings', (_, settings: Partial<ImageSettings>) => saveImageSettings(settings));

ipcMain.handle('pick-image-cache-dir', async () => {
  if (!mainWindow) {
    return null;
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: '选择图片缓存目录',
  });

  if (result.canceled || !result.filePaths?.[0]) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('optimize-text', async (_, text: string) => optimizeText(text));

ipcMain.handle('get-history', () => loadHistory());

ipcMain.handle('clear-history', () => {
  saveHistory([]);
  return true;
});

// ============================================================
// Chat IPC Handlers
// ============================================================

ipcMain.handle('get-chat-sessions', () => getSessions());

ipcMain.handle('get-chat-session', (_, sessionId: string) => getSession(sessionId) ?? null);

ipcMain.handle('create-chat-session', (_, title?: string) => createSession(title));

ipcMain.handle('delete-chat-session', (_, sessionId: string) => deleteSession(sessionId));

ipcMain.handle('clear-all-chat-sessions', () => clearAllSessions());

ipcMain.handle('set-current-chat-session', (_, sessionId: string) => setCurrentSession(sessionId) ?? null);

ipcMain.handle('send-chat-message', async (_, content: string, sessionId?: string) => {
  const session = sessionId ? getSession(sessionId) ?? getCurrentSession() : getCurrentSession();
  const chatId = crypto.randomUUID();

  // 获取历史消息（排除 streaming 占位）
  const history = session.messages.filter((m) => !m.streaming);

  // 添加用户消息
  const userMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    timestamp: Date.now(),
  };
  addMessage(session.id, userMsg);

  // 创建 assistant 消息占位
  const assistantMsg: ChatMessage = {
    id: chatId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    steps: [],
    streaming: true,
  };
  addMessage(session.id, assistantMsg);

  // 异步执行 Agent（不阻塞 IPC 返回）
  runAgent(content, { history }).then((result) => {
    const steps: AgentStepInfo[] = result.steps;
    updateMessage(session.id, chatId, {
      content: result.replyMessage || result.text || '',
      steps,
      streaming: false,
    });
    if (mainWindow) {
      mainWindow.webContents.send('chat-done', {
        chatId,
        content: result.replyMessage || result.text || '',
        steps,
      });
    }
  }).catch((err) => {
    const errorMsg = err instanceof Error ? err.message : 'Agent 处理失败';
    updateMessage(session.id, chatId, {
      content: `错误: ${errorMsg}`,
      streaming: false,
    });
    if (mainWindow) {
      mainWindow.webContents.send('chat-error', { chatId, error: errorMsg });
    }
  });

  return { chatId, sessionId: session.id };
});

function createQRWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 640,
    minWidth: 600,
    minHeight: 500,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-close', () => {
  mainWindow?.hide();
});

function showQRWindow(): void {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createQRWindow();
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  loadSessions();
  
  startServer({
    onText: (text, execute) => {
      lastText = text;
      typeText(text, execute);
    },
    onImage: (imageBuffer, execute) => {
      return pasteImage(imageBuffer, execute);
    },
    onConnection: (connected) => {
      if (mainWindow) {
        mainWindow.webContents.send('connection-status', connected);
      }
    }
  });

  // 监听 IP 变化，通知 renderer 刷新二维码
  serverEvents.on('ip-changed', () => {
    if (mainWindow) {
      const state = getState();
      const url = `http://${state.ip}:${state.port}`;
      QRCode.toDataURL(url, { width: 200, margin: 1 }).then((qrDataUrl) => {
        mainWindow?.webContents.send('ip-changed', { ip: state.ip, port: state.port, qrCode: qrDataUrl });
      }).catch((err) => {
        console.warn('Failed to generate QR code on IP change:', err);
      });
    }
  });

  createTray({ showQRWindow, getState });

  globalShortcut.register('Ctrl+Shift+V', () => {
    if (lastText) {
      typeText(lastText);
    }
  });

  createQRWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopServer();
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});
