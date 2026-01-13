# TypeWithMobile 开发日志

## 项目概述

通过局域网将手机语音输入的文字发送到 PC，模拟键盘输入。

## 已完成步骤

### 1. 项目初始化
- [x] 创建 package.json，配置 Electron 项目
- [x] 安装依赖：express, ws, qrcode, koffi, react, react-dom
- [x] 配置 Vite 构建手机端 React 应用

### 2. Electron 主进程 (`electron/main.js`)
- [x] 创建 BrowserWindow 显示二维码
- [x] 注册全局快捷键 `Ctrl+Shift+V` 重复输入
- [x] IPC 通信：获取服务器信息、生成二维码
- [x] 系统托盘集成

### 3. 系统托盘 (`electron/tray.js`)
- [x] 显示连接状态（已连接/未连接）
- [x] 右键菜单：显示二维码、IP/端口、退出

### 4. HTTP + WebSocket 服务 (`electron/server.js`)
- [x] Express 静态文件服务（端口 23456）
- [x] WebSocket 实时通信
- [x] Token 验证机制
- [x] 智能获取局域网 IP（排除 VMware 等虚拟网卡）

### 5. 键盘模拟 (`electron/keyboard.js`)
- [x] 使用 koffi 调用 Windows SendInput API
- [x] 支持 Unicode 字符输入（中文、emoji 等）
- [x] 立即输入模式
- [x] 快捷键触发模式

### 6. 二维码窗口 (`electron/qrcode.html`)
- [x] 现代简洁 UI 设计
- [x] 显示连接状态
- [x] 显示 IP 和端口
- [x] 通过 IPC 生成二维码（使用 qrcode 库）

### 7. 手机端 React 应用 (`mobile/`)
- [x] Vite + React 构建
- [x] Tailwind CSS 样式
- [x] WebSocket 连接与自动重连
- [x] 消息发送与状态显示
- [x] 历史记录（localStorage）
- [x] 现代化 UI（深色消息气泡、简洁布局）

### 8. 防火墙配置
- [x] 需要手动添加防火墙规则允许端口 23456

## 目录结构

```
typeWithMobile/
├── package.json
├── electron/
│   ├── main.js           # Electron 主进程
│   ├── preload.js        # 预加载脚本（IPC 桥接）
│   ├── tray.js           # 系统托盘
│   ├── server.js         # HTTP + WebSocket 服务
│   ├── keyboard.js       # Windows SendInput 键盘模拟
│   └── qrcode.html       # 二维码窗口 UI
├── mobile/
│   ├── vite.config.js
│   ├── index.html
│   ├── tailwind.config.cjs
│   ├── postcss.config.cjs
│   ├── src/
│   │   ├── main.jsx      # React 入口
│   │   ├── App.jsx       # 主组件
│   │   └── index.css     # Tailwind 样式
│   └── dist/             # 构建输出
└── plan/
    ├── README.md         # 项目计划
    └── CHANGELOG.md      # 本文件
```

## 运行命令

```bash
# 开发模式（需先构建 mobile）
npm run build:mobile
npm run dev

# 一键启动（构建 + 运行）
npm run start

# 单独开发手机端 UI
npm run dev:mobile
```

## 技术栈

| 模块 | 技术 |
|------|------|
| 桌面应用 | Electron 28 |
| HTTP 服务 | Express 4 |
| 实时通信 | ws (WebSocket) |
| 键盘模拟 | koffi (Windows API) |
| 二维码 | qrcode |
| 手机端 | React 18 + Vite 5 |
| 样式 | Tailwind CSS 3 |

## 端口配置

- HTTP/WebSocket: `23456`

## 待优化

- [ ] macOS 支持（需要不同的键盘模拟方案）
- [ ] 打包发布（electron-builder）
- [ ] 自动添加防火墙规则
- [ ] 多设备同时连接
