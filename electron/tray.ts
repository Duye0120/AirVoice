import { Tray, Menu, nativeImage, app } from 'electron';
import type { ServerState } from './types';

let tray: Tray | null = null;

interface TrayOptions {
  showQRWindow: () => void;
  getState: () => ServerState;
}

function createTrayIcon(): Electron.NativeImage {
  // 创建 32x32 的图标
  const size = 32;
  const canvas = Buffer.alloc(size * size * 4);

  // 绘制蓝色圆形背景 + 白色 T 字母
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
          // 蓝色背景
          canvas[idx] = 0;       // R
          canvas[idx + 1] = 122; // G
          canvas[idx + 2] = 255; // B
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
  const icon = createTrayIcon();

  tray = new Tray(icon);
  tray.setToolTip('TypeWithMobile');

  const updateMenu = () => {
    const state = getState();
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

  updateMenu();
  setInterval(updateMenu, 2000);

  tray.on('click', showQRWindow);
}
