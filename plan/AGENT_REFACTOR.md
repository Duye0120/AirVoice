# AirVoice Agent 重构计划

## 目标

将 AirVoice 从"手机遥控器"重构为"PC 端 AI Agent 桌面应用 + 手机可选语音输入"。

## 架构变更概览

### 之前
```
手机（主界面）→ WebSocket → PC（中转站）→ 键盘模拟
```

### 之后
```
PC（主界面 Chat）→ Agent → 工具调用（文件读写/搜索/终端/键盘）
手机（可选输入）→ WebSocket → 注入到 PC Chat 输入
```

## 新 PC 端布局

```
┌─────────────────────────────────────────────┐
│ AirVoice Agent                       ─ □ ×  │
├──────────┬──────────────────────────────────┤
│ 💬 对话   │  [Chat 消息流 - 流式渲染]         │
│ ⚙️ 设置   │                                  │
│ 📱 连接   │  User: 帮我看看 src 目录          │
│          │  Agent: 🔧 listDir src/           │
│          │         → App.tsx, index.css ...   │
│          │                                   │
│          │  User: 读一下 App.tsx 前 20 行     │
│          │  Agent: 🔧 readFile src/App.tsx    │
│          │         → [文件内容]               │
│          │                                   │
│          ├───────────────────────────────────┤
│          │ [输入框]                   [发送]  │
│          │ 📱 手机已连接 - 可语音输入          │
└──────────┴───────────────────────────────────┘
```

## Phase 1 实施步骤

### 1.1 新增文件系统工具 (electron/tools/)

参考 pi-mono 的工具设计，使用 Vercel AI SDK v6 的 `tool()` + Zod v4。

| 工具 | 描述 | 参考 pi-mono |
|------|------|-------------|
| readFile | 读取文件内容（支持行号范围、图片） | tools/read.ts |
| writeFile | 写入/创建文件 | tools/write.ts |
| editFile | 精确字符串替换（oldString → newString） | tools/edit.ts |
| listDir | 列出目录内容 | tools/ls.ts |
| searchContent | grep 搜索文件内容 | tools/grep.ts |
| findFiles | 按名称/glob 模式查找文件 | tools/find.ts |
| bash | 执行终端命令 | tools/bash.ts |
| typeText | 输入到 PC 光标位置（保留） | 现有 |
| reply | 直接回复用户（保留） | 现有 |

安全限制：
- bash 命令超时 30 秒
- 文件读取截断 2000 行或 50KB
- 写入前检查路径合法性
- 禁止读写 .env、credentials 等敏感文件

### 1.2 重构 Agent 核心 (electron/agent.ts)

- 从 `generateText` 改为 `streamText`，支持流式输出
- 支持对话历史（messages 数组）
- 新增 `onStepFinish` 回调，实时推送工具调用状态
- 支持 `stopWhen: stepCountIs(10)` 多步推理
- 保留角色系统兼容

### 1.3 扩展 WebSocket 协议

新增消息类型：
```typescript
// PC → 手机（也用于 PC 内部 IPC）
'chat-delta'      // 流式文本片段
'chat-tool-call'  // 工具调用开始
'chat-tool-result' // 工具调用结果
'chat-done'       // 对话完成
'chat-error'      // 对话错误

// 手机 → PC
'chat-input'      // 手机注入文字到 PC Chat 输入框

// 保留现有
'text' / 'ack' / 'ai-config' / 'history' / 'image' 等
```

### 1.4 PC 端 UI 重构 (src/App.tsx)

从设置面板重构为 Chat 界面：

- 侧边栏：对话 / 设置 / 手机连接
- 主区域：Chat 消息流
  - 用户消息：普通文本气泡
  - Agent 消息：流式文本 + 工具调用卡片
  - 工具调用卡片：显示工具名、参数、结果（可折叠）
- 底部：输入框 + 发送按钮 + 手机连接状态
- 设置页：保留现有 AI 配置、角色管理、图片设置

IPC 新增：
- `send-chat-message` — 发送 Chat 消息
- `get-chat-history` — 获取对话历史
- `clear-chat` — 清空对话
- `on-chat-delta` — 监听流式输出
- `on-chat-tool-call` — 监听工具调用
- `on-chat-done` — 监听对话完成

### 1.5 手机端改造 (mobile/src/App.tsx)

手机端变为可选输入设备：
- 保留现有所有功能（直接发送文字、图片、AI 优化）
- 新增：当 PC 端处于 Chat 模式时，手机输入注入到 PC Chat
- 手机端显示 PC Chat 的最近消息（只读）
- 语音输入的文字发送到 PC Chat 输入框

### 1.6 对话历史持久化

- 存储在 `app.getPath('userData')/chat-history.json`
- 每个对话有独立 ID 和时间戳
- 支持多轮对话
- 自动清理超过 30 天的历史

## 文件变更清单

### 新增文件
- `electron/tools/readFile.ts`
- `electron/tools/writeFile.ts`
- `electron/tools/editFile.ts`
- `electron/tools/listDir.ts`
- `electron/tools/searchContent.ts`
- `electron/tools/findFiles.ts`
- `electron/tools/bash.ts`
- `electron/tools/index.ts` — 导出所有工具
- `electron/chat.ts` — Chat 会话管理 + 历史持久化

### 重构文件
- `electron/agent.ts` — 重写为流式 Chat Agent
- `electron/tools.ts` → 迁移到 `electron/tools/` 目录
- `electron/server.ts` — 新增 Chat 消息处理
- `electron/main.ts` — 新增 Chat IPC
- `electron/preload.ts` — 暴露 Chat API
- `electron/types.ts` — 扩展消息类型
- `shared/types.ts` — 扩展消息类型
- `src/App.tsx` — 重构为 Chat 界面
- `src/types/electron.d.ts` — 新增 Chat API 类型
- `mobile/src/App.tsx` — 新增 Chat 输入注入

### 不变文件
- `electron/keyboard.ts` — 保持不变
- `electron/tray.ts` — 保持不变
- `electron/config.ts` — 仅扩展
- `mobile/src/hooks/useWebSocket.ts` — 保持不变
- `src/components/ui/*` — 保持不变

## 实施顺序

1. 先做后端（工具 + Agent + 协议）— 不影响现有功能
2. 再做 PC 端 UI — 替换现有界面
3. 最后改手机端 — 适配新协议
4. 构建验证 + CHANGELOG
