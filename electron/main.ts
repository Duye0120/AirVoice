import { app, BrowserWindow, globalShortcut, ipcMain, Menu } from 'electron';
import path from 'path';
import QRCode from 'qrcode';
import { createTray } from './tray';
import { startServer, getState, serverEvents, stopServer } from './server';
import { typeText } from './keyboard';

let mainWindow: BrowserWindow | null = null;
let lastText = '';

ipcMain.handle('get-server-info', () => getState());

ipcMain.handle('generate-qrcode', async (_, url: string) => {
  return await QRCode.toDataURL(url, { width: 200, margin: 1 });
});

function createQRWindow(): void {
  mainWindow = new BrowserWindow({
    width: 340,
    height: 520,
    minWidth: 300,
    minHeight: 400,
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
  
  startServer({
    onText: (text, execute) => {
      lastText = text;
      typeText(text, execute);
    },
    onConnection: (connected) => {
      if (mainWindow) {
        mainWindow.webContents.send('connection-status', connected);
        if (connected) {
          mainWindow.hide();
        }
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
