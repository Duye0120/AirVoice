import { Tray, Menu, nativeImage, app } from 'electron';
import type { ServerState } from './types';
import { serverEvents } from './server';

let tray: Tray | null = null;
let lastConnected: boolean | null = null;

interface TrayOptions {
  showQRWindow: () => void;
  getState: () => ServerState;
}

function createTrayIcon(connected: boolean): Electron.NativeImage {
  // 创建 32x32 的图标
  const size = 32;
  const canvas = Buffer.alloc(size * size * 4);

  // 颜色：已连接=绿色，未连接=蓝色
  const color = connected ? { r: 52, g: 199, b: 89 } : { r: 0, g: 122, b: 255 };

  // 绘制圆形背景 + 白色 T 字母
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = x - size / 2;
      const cy = y - size / 2;
      const dist = Math.sqrt(cx * cx + cy * cy);

      if (dist < size / 2 - 1) {
        // 圆形内部
        const isT = (y >= 8 && y <= 11 && x >= 8 && x <= 23) || // T 横线
                    (x >= 14 && x <= 17 && y >= 8 && y <= 24);   // T 竖线
        if (isT) {
          // 白色 T
          canvas[idx] = 255;     // R
          canvas[idx + 1] = 255; // G
          canvas[idx + 2] = 255; // B
          canvas[idx + 3] = 255; // A
        } else {
          // 背景色
          canvas[idx] = color.r;
          canvas[idx + 1] = color.g;
          canvas[idx + 2] = color.b;
          canvas[idx + 3] = 255; // A
        }
      } else {
        // 透明
        canvas[idx] = 0;
        canvas[idx + 1] = 0;
        canvas[idx + 2] = 0;
        canvas[idx + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

export function createTray({ showQRWindow, getState }: TrayOptions): void {
  const state = getState();
  tray = new Tray(createTrayIcon(state.connected));
  tray.setToolTip('AirVoice');
  lastConnected = state.connected;

  const updateMenu = () => {
    const state = getState();
    if (lastConnected !== state.connected) {
      tray?.setImage(createTrayIcon(state.connected));
      lastConnected = state.connected;
    }
    const contextMenu = Menu.buildFromTemplate([
      {
        label: state.connected ? '● 已连接' : '○ 未连接',
        enabled: false
      },
      { type: 'separator' },
      {
        label: `IP: ${state.ip}:${state.port}`,
        enabled: false
      },
      { type: 'separator' },
      { label: '显示二维码', click: showQRWindow },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ]);
    tray?.setContextMenu(contextMenu);
  };

  // 初始更新
  updateMenu();

  // 监听连接状态变化事件
  serverEvents.on('connection-changed', () => {
    updateMenu();
  });

  // 监听 IP 变化事件
  serverEvents.on('ip-changed', () => {
    updateMenu();
  });

  tray.on('click', showQRWindow);
}
