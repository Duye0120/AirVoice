import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import QRCode from 'qrcode';
import { createTray } from './tray';
import { startServer, getState } from './server';
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
    height: 500,
    resizable: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function showQRWindow(): void {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createQRWindow();
  }
}

app.whenReady().then(() => {
  startServer({
    onText: (text, execute) => {
      lastText = text;
      typeText(text, execute);
    },
    onConnection: (connected) => {
      if (mainWindow) {
        mainWindow.webContents.send('connection-status', connected);
      }
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
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});
