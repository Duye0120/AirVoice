# TypeWithMobile 开发日志

## 项目概述

通过局域网将手机语音输入的文字发送到 PC，模拟键盘输入。

## 更新记录

### 2026-01-21 - Connection Page Font Update

**功能描述：**
- 统一连接页面字体风格，使用与角色设置相同的无衬线字体 (font-sans)
- 移除服务器信息显示的等宽字体限制，确保整体视觉一致性
- 解决部分文本可能回退到宋体 (Songti) 的问题

**修改的文件：**
- `src/App.tsx` - 连接页面容器添加 `font-sans` 类
- `src/index.css` - 移除 `.server-info` 的等宽字体设置

### 2026-01-21 - PC 窗口尺寸与字体优化

**功能描述：**
- PC 窗口默认尺寸增大至 900x640，提供更宽敞的操作空间
- 调整侧边栏宽度至 240px，优化布局比例
- 修复 PC 端中文字体显示问题，显式添加 "Microsoft YaHei" 到字体栈，解决输入框宋体回退问题
- 更新 Tailwind 配置，确保 `font-sans` 正确映射到中文字体

**修改的文件：**
- `electron/main.ts` - 调整默认窗口尺寸
- `src/index.css` - 调整侧边栏宽度，更新全局字体栈
- `tailwind.config.cjs` - 更新 font-sans 定义


### 2026-01-21 - UI 布局调整：独立角色设置页面

**功能描述：**
- 将角色设定从 AI 设置页面分离，作为独立的侧边栏菜单项
- 侧边栏新增“角色设定”入口（使用 Bot 图标）
- 侧边栏导航扩展为 4 项：连接、历史记录、AI 设置、角色设定
- 优化 AI 设置页面布局，专注于服务商与优化配置

**修改的文件：**
- `src/App.tsx` - 调整导航结构，分离角色设置视图

### 2026-01-21 - 角色与提示词配置模块

**功能描述：**
- 新增角色配置存储（roles.json），与 API 配置解耦
- 提供默认角色（通用/程序员/日常工作）与 Prompt 模板
- 支持读取旧 customPrompt 自动迁移为“自定义”角色
- PC 端新增角色选择、编辑、新增与保存的 UI
- AI 优化使用当前角色 Prompt

**修改的文件：**
- `electron/config.ts` - 新增角色配置与迁移逻辑
- `electron/ai.ts` - 使用角色 Prompt 作为 system prompt
- `electron/main.ts` - 新增角色配置 IPC
- `electron/preload.ts` - 暴露角色配置 API
- `src/App.tsx` - 角色设置 UI 与逻辑
- `src/types/electron.d.ts` - 更新类型定义

### 2026-01-21 - 移动端历史记录 UI 优化

**功能描述：**
- 历史记录按日期分组显示（今天、昨天、具体日期）
- 简化历史消息显示样式：时间（左侧）+ 内容（右侧）
- 移除历史消息的卡片样式，保持界面整洁
- 优化列表渲染逻辑，非历史消息保留原有卡片样式

**修改的文件：**
- `mobile/src/App.tsx` - 添加日期分组逻辑，更新 Message 接口，重构列表渲染

### 2026-01-21 - UI 全面重构 (Typeless 风格) & AI 预览确认功能

**功能描述：**
- PC 端和移动端 UI 全面重构，采用 Typeless 风格设计
- PC 端使用 shadcn/ui + Tailwind CSS，左右布局（侧边导航 + 内容区）
- 移动端移除 antd-mobile，使用与 PC 端相同的 shadcn/ui 样式系统
- PC 端窗口宽度从 360px 调整为 680px
- 新增 AI 预览确认功能：AI 优化后先返回移动端预览，用户确认后再发送
- 移动端头部显示 AI 状态指示（从 PC 端同步）
- 底部滑出式预览面板，支持编辑优化后的文字
- 可选择"使用原文"直接发送原始内容
- 全部界面改为中文

**UI 设计特点：**
- 简洁干净的界面，大量留白
- 玻璃拟态效果（backdrop-blur）
- PC 端和移动端使用统一的 HSL 颜色变量系统
- 深色/浅色模式自动适配

**新增 WebSocket 消息类型：**
- `optimize`: 请求 AI 优化（不立即执行）
- `optimized`: 返回优化结果供预览
- `confirm`: 用户确认后执行粘贴
- `ai-config`: 同步 AI 配置状态

**修改的文件：**
- `package.json` - 添加 shadcn/ui 相关依赖，移除 antd-mobile
- `tailwind.config.cjs` - 扩展配置支持 shadcn/ui HSL 颜色系统
- `src/lib/utils.ts` - 新增 cn() 工具函数
- `src/components/ui/*` - 新增 shadcn/ui 组件（Button, Input, Select, Switch, Card, Label, Textarea）
- `src/App.tsx` - 重构为左右布局，中文界面
- `src/index.css` - 全新 Tailwind + HSL CSS 变量样式
- `mobile/src/App.tsx` - 重构，使用 shadcn/ui 样式系统，添加 AI 预览面板，中文界面
- `mobile/src/index.css` - 使用与 PC 端相同的 HSL 颜色变量
- `mobile/src/App.scss` - 删除
- `shared/types.ts` - 新增 AI 相关消息类型
- `electron/types.ts` - 同步更新类型定义
- `electron/server.ts` - 处理 optimize/confirm 消息，同步 AI 配置状态
- `electron/main.ts` - 窗口宽度调整为 680px

**AI 预览流程：**
1. 用户在移动端输入文字，点击发送
2. 如果 AI 开启，发送 `optimize` 请求到 PC
3. PC 端调用 AI 优化，返回 `optimized` 结果
4. 移动端弹出预览面板，显示优化后的文字（可编辑）
5. 用户可以：确认发送 / 编辑后发送 / 使用原文
6. 发送 `confirm` 请求，PC 端执行粘贴

**注意事项：**
- PC 端和移动端现在共享相同的颜色系统，便于维护
- 移动端包体积大幅减小（移除了 antd-mobile）

---

### 2026-01-20 - BYOK 多服务商支持 & PC 端 UI 重构

**功能描述：**
- 支持 BYOK（Bring Your Own Key）模式，可自定义 API Base URL
- 支持三大 AI 服务商：OpenAI、Anthropic (Claude)、Google (Gemini)
- 每个服务商独立配置：Base URL、API Key、Model
- 模型名称支持自定义输入，同时提供预设建议
- PC 端 UI 重构为标签页导航（连接 / AI 设置）
- 服务商卡片式选择，点击切换当前使用的服务商
- 支持自定义系统提示词

**修改的文件：**
- `package.json` - 添加 @ai-sdk/google 依赖
- `electron/config.ts` - 扩展配置结构，支持多服务商和 baseURL
- `electron/ai.ts` - 支持 Gemini，动态选择模型和 baseURL
- `electron/server.ts` - 适配新的配置结构
- `src/App.tsx` - 全新标签页 UI，BYOK 风格的服务商配置
- `src/index.css` - 新增服务商卡片、标签页导航等样式
- `src/types/electron.d.ts` - 更新类型定义

**配置结构：**
```typescript
interface ProviderConfig {
  apiKey: string;
  model: string;
  baseURL?: string;  // 可选，留空使用默认
}

interface AIConfig {
  provider: 'openai' | 'anthropic' | 'google';
  optimizeMode: 'off' | 'auto' | 'manual';
  customPrompt?: string;
  providers: {
    openai: ProviderConfig;
    anthropic: ProviderConfig;
    google: ProviderConfig;
  };
}
```

**注意事项：**
- Base URL 留空时使用官方默认地址
- 可配置国内代理或私有部署的 API 地址
- 配置存储在用户数据目录 `ai-config.json`

### 2026-01-20 - AI 文字优化功能

**功能描述：**
- 集成 Vercel AI SDK，支持 OpenAI 和 Anthropic (Claude) 两种 AI 服务商
- 在 PC 端设置界面配置 API Key、选择服务商、设置优化模式
- 三种优化模式：关闭、自动优化（每次发送自动处理）、手动触发
- AI 自动优化语音输入的文字，去除口语化表达、重复词语、语气词

**修改的文件：**
- `package.json` - 添加 ai, @ai-sdk/openai, @ai-sdk/anthropic 依赖
- `electron/config.ts` - 新增，AI 配置存储模块
- `electron/ai.ts` - 新增，AI 文字优化服务
- `electron/server.ts` - 集成 AI 优化，自动模式下处理文字
- `electron/main.ts` - 添加配置相关 IPC 处理
- `electron/preload.ts` - 暴露 getAIConfig, saveAIConfig, optimizeText API
- `src/App.tsx` - 添加设置按钮和设置弹窗
- `src/index.css` - 添加设置弹窗样式
- `src/types/electron.d.ts` - 添加 AI 配置相关类型定义

**注意事项：**
- API Key 存储在用户数据目录 `ai-config.json`
- 自动模式下，每次发送文字会先经过 AI 优化再输入
- 手动模式需要在移动端触发（待实现）

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

### 2026-01-21 - UI 样式优化 (Mobile 输入区域与 PC 角色设置)

**功能描述：**
- Mobile: 进一步增大底部输入框区域（7行，最小高度140px，最大高度300px），提升大段文字输入体验
- Electron: 角色设置输入框改用无衬线字体 (font-sans)，移除等宽字体以解决中文显示回退问题
- Electron: 调整角色设置相关输入框和按钮尺寸为标准大小 (h-10)，提升点击区域和可读性

**修改的文件：**
- `mobile/src/App.tsx` - 调整输入框 rows=7, minHeight=140px, maxHeight=300px
- `src/App.tsx` - 角色设置 Input/Textarea 字体调整为 font-sans，尺寸调整为 h-10/min-h-[200px]

### 2026-01-21 - PC 端窗口与字体优化

**功能描述：**
- PC: 调整主窗口默认尺寸（更宽更高），提升整体可用空间
- PC: 侧边栏宽度略增，改善导航区域布局
- PC: 扩展无衬线字体栈并统一表单字体继承，避免输入框回退到宋体

**修改的文件：**
- `electron/main.ts` - 调整主窗口尺寸与最小尺寸
- `src/index.css` - 扩展全局字体栈
- `tailwind.config.cjs` - 扩展 sans 字体族
- `src/index.css` - 更新 body font-family 并添加表单元素字体继承

### 2026-01-23 - 修复移动端输入框高度异常

**功能描述：**
- 修复移动端输入框高度过大的问题
- 输入框从固定7行改为1行起始，随内容自动扩展
- 移除 minHeight 限制，让输入框自然高度
- 最大高度从 300px 调整为 150px
- 减小内边距，优化视觉效果

**修改的文件：**
- `mobile/src/App.tsx` - 调整 textarea 的 rows、style 和 className

### 2026-01-21 - UI 样式优化 (字体与输入框)

**功能描述：**
- Mobile: 增大底部输入框默认高度（3行），提升输入体验
- Electron: 优化 PC 端全局字体栈，显式指定系统字体以防止回退到宋体
- Electron: 强制 input, textarea, select, button 等表单元素继承全局字体设置

**修改的文件：**
- `mobile/src/App.tsx` - 调整输入框 rows 和 minHeight
- `src/index.css` - 更新 body font-family 并添加表单元素字体继承
