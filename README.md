# TypeWithMobile

手机语音输入到 PC - 利用手机语音输入法，通过局域网将文字发送到电脑。

## 功能特点

- 手机扫码连接，无需安装 App
- 支持任意语音输入法（微信输入法、搜狗等）
- 文字自动输入到 PC 当前光标位置
- 支持"发送并执行"（自动按回车，适合终端命令）
- 系统托盘运行，不占用桌面空间

## 下载使用

从 [Releases](../../releases) 下载最新版本：
- `TypeWithMobile x.x.x.exe` - 便携版，直接运行
- `TypeWithMobile Setup x.x.x.exe` - 安装版

## 使用方法

1. 运行程序，系统托盘显示图标
2. 弹出二维码窗口，手机扫码
3. 在手机网页上输入文字（支持语音输入）
4. 点击发送按钮，文字自动输入到 PC

**两个发送按钮：**
- 蓝色按钮：仅粘贴文字
- 绿色按钮：粘贴文字并按回车（适合终端命令）

## 技术栈

- Electron + React + TypeScript
- Express + WebSocket
- Windows SendInput API (koffi)
- Vite + Tailwind CSS

## 开发

```bash
# 安装依赖
npm install

# 开发运行
npm start

# 打包
npm run dist
```

## 目录结构

```
typeWithMobile/
├── electron/          # Electron 主进程 (TypeScript)
│   ├── main.ts        # 主入口
│   ├── server.ts      # HTTP + WebSocket 服务
│   ├── keyboard.ts    # 键盘模拟 (剪贴板 + Ctrl+V)
│   └── tray.ts        # 系统托盘
├── src/               # PC 渲染进程 (React)
├── mobile/            # 手机端网页 (React)
├── dist/              # 编译输出
└── release/           # 打包输出
```

## License

MIT
