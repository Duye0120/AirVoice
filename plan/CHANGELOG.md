# TypeWithMobile 开发日志

## 项目概述

通过局域网将手机语音输入的文字发送到 PC，模拟键盘输入。

## 更新记录

### 2026-01-16 - 移动端 UI 现代化升级

**功能描述：**
- 全新的现代化设计系统，采用 Apple 风格的设计语言
- 玻璃拟态效果（Glassmorphism）应用于顶部导航和底部输入区
- 全新的消息卡片设计，带有状态指示边框
- 优化的空状态页面，带有浮动动画图标
- 更圆润的按钮和输入框设计
- 发送中状态显示旋转加载动画
- 使用 Inter 字体提升可读性
- 优化的深色模式配色

**修改的文件：**
- `mobile/src/App.tsx` - 重构组件结构，使用语义化 HTML 标签
- `mobile/src/App.scss` - 全新的现代化样式设计
- `mobile/src/index.css` - 新的设计系统变量（玻璃拟态、卡片、输入框）

**设计亮点：**
- 顶部导航和底部输入区使用 `backdrop-filter: blur(20px)` 实现毛玻璃效果
- 消息卡片左侧边框颜色指示状态（绿色=已发送，蓝色=发送中）
- 发送按钮使用渐变背景
- 空状态图标有轻微的浮动动画
- 所有动画支持 `prefers-reduced-motion`

### 2026-01-16 - Web Interface Guidelines 无障碍性改进

**功能描述：**
- 根据 Vercel Web Interface Guidelines 改进 PC 端和手机端的无障碍性
- 添加 `aria-label` 到所有图标按钮
- 添加 `color-scheme` 声明支持系统主题
- 添加 `prefers-reduced-motion` 支持减少动画
- 修复 `transition: all` 性能问题
- 添加 `touch-action: manipulation` 优化触摸体验
- 使用正确的省略号字符 `…` 替代 `...`
- 为图片添加明确的宽高属性

**修改的文件：**
- `src/App.tsx` - 添加 aria-label、aria-live、aria-hidden 属性
- `src/index.css` - 添加 color-scheme、focus-visible 状态、prefers-reduced-motion
- `mobile/src/App.tsx` - 添加 aria-label、aria-hidden 属性，修复省略号
- `mobile/src/App.scss` - 修复 transition: all，添加 prefers-reduced-motion
- `mobile/src/index.css` - 添加 color-scheme、touch-action

**注意事项：**
- 所有动画在用户开启减少动画偏好时会被禁用
- 窗口控制按钮现在有可见的焦点状态

### 2026-01-16 - 自定义标题栏（标题居中）

**功能描述：**
- 移除原生标题栏，实现自定义标题栏
- 标题 "TypeWithMobile" 居中显示
- 添加最小化和关闭按钮

**修改的文件：**
- `electron/main.ts` - 设置 `frame: false`，添加窗口控制 IPC 处理
- `electron/preload.ts` - 暴露 `windowMinimize` 和 `windowClose` API
- `src/App.tsx` - 添加自定义标题栏组件
- `src/index.css` - 添加标题栏样式（拖拽区域、按钮悬停效果）
- `src/types/electron.d.ts` - 更新 TypeScript 类型定义
- `CLAUDE.md` - 添加开发规范（完成功能后记录更新）

**注意事项：**
- 标题栏使用 `-webkit-app-region: drag` 实现拖拽
- 关闭按钮点击后隐藏窗口（不退出应用）
- 按钮区域设置 `-webkit-app-region: no-drag` 避免拖拽冲突

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
