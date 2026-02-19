# TypeWithMobile 开发日志

## 项目概述

通过局域网将手机语音输入的文字发送到 PC，模拟键盘输入。

## 产品优先级（约定）

- UI 与体验优先级最高：先保证好看、顺手、响应快，再叠加复杂功能
- 美观与实用性并重：不为炫技牺牲可用性，不为功能牺牲视觉一致性
- 功能迭代以自用体验为基线：如果自己都不想用，功能不算完成

## 更新记录

### 2026-02-19 - PC 端 Chat 界面重构

**功能描述：**
- PC 端主界面重构为 Chat 模式，作为 AI Agent 的核心交互入口
- 新增侧边栏导航：Chat（默认）、设置、手机连接
- 移除独立的“历史记录”页面，整合进 Chat 界面
- 合并“AI 设置”、“角色设定”、“图片设置”到统一的“设置”页面
- Chat 界面支持流式消息显示、工具调用可视化（Agent 步骤折叠）、多会话管理
- 保持原有手机连接功能（扫码、状态显示）在独立页面
- UI 样式适配：新增聊天气泡、工具调用详情、输入区域样式

**修改的文件：**
- `src/App.tsx` - 全量重构，实现 Chat 逻辑与新布局
- `src/index.css` - 新增 Chat 相关样式

### 2026-02-19 - Agent 模式（智能输入 v1）

**功能描述：**
- 新增 Agent 模式：AI 不再只是"润色器"，而是能理解用户意图、自主选择工具的智能助手
- 在 PC 端 AI 设置中，优化模式新增"Agent"选项，与原有的关闭/自动/手动模式并列
- Agent 拥有 6 个工具：typeText（输入到 PC）、translate（翻译）、formatCode（格式化代码）、rewrite（润色改写）、summarize（总结）、reply（直接回复）
- AI 根据用户输入自动判断意图：普通文字直接输入到 PC、包含指令时先处理再输入、提问时直接回复
- 移动端 Header 显示 Agent 徽章（靛蓝色），区别于普通 AI 模式
- 消息卡片展示 Agent 执行结果：AI 回复气泡、"已输入到 PC"状态、可折叠的 Agent 步骤详情
- PC 端保存 AI 配置后实时通知移动端状态变化

**Agent 工作流程：**
1. 用户在手机端输入文字，发送到 PC
2. PC 端 Agent 分析用户意图，选择合适的工具
3. 执行工具调用（可能多步），将结果返回手机端
4. 手机端展示执行过程和结果

**技术实现：**
- 使用 Vercel AI SDK v6 的 `generateText` + `tool()` + `stepCountIs()` 实现多步工具调用
- 工具定义使用 Zod v4 的 `inputSchema` 进行参数校验
- WebSocket 协议扩展：新增 `agent`、`agent-step`、`agent-done` 消息类型

**修改的文件：**
- `electron/tools.ts` - 新增，Agent 工具集定义
- `electron/agent.ts` - 新增，Agent 核心逻辑（system prompt + 工具编排）
- `electron/config.ts` - OptimizeMode 新增 `agent` 选项
- `electron/server.ts` - 新增 agent 消息处理分支、agentEnabled 状态推送
- `electron/main.ts` - 保存配置后通知移动端状态变化
- `shared/types.ts` - 新增 AgentStepInfo 接口、扩展 WebSocketMessage
- `electron/types.ts` - 同步类型定义
- `mobile/src/App.tsx` - Agent 模式 UI（徽章、发送逻辑、结果展示）
- `src/App.tsx` - PC 端优化模式下拉新增 Agent 选项
- `src/types/electron.d.ts` - OptimizeMode 类型同步

**注意事项：**
- Agent 模式需要配置 API Key 才能使用
- 默认行为：普通文字自动清理口语填充词后输入到 PC
- 角色系统与 Agent 兼容，角色 Prompt 会追加到 Agent 系统提示中

### 2026-02-10 - PC 端 UI 现代化（与移动端风格统一）

**功能描述：**
- 重构 PC 端视觉层级：标题栏、侧边栏、主内容区统一为更现代的圆角卡片与轻毛玻璃风格
- 优化导航与页面结构：新增品牌头区、页面标题状态徽章、导航激活态更清晰
- 统一设计语言：按钮/输入框/选择器/卡片圆角升级，交互反馈更一致
- 提升可读性与信息密度：历史记录改为卡片化条目，状态与时间更清晰
- 补齐语义色彩变量：新增 `success/warning` 并应用到连接状态

**修改的文件：**
- `src/index.css` - 全量桌面样式升级（布局、卡片、导航、状态、历史列表、滚动条）
- `src/App.tsx` - 页面结构微调（品牌区、连接页标题状态徽章、历史项结构）
- `src/components/ui/button.tsx` - 圆角与交互反馈优化
- `src/components/ui/input.tsx` - 圆角与过渡优化
- `src/components/ui/select.tsx` - Trigger/Content 圆角与过渡优化
- `src/components/ui/card.tsx` - 卡片圆角统一

**注意事项：**
- 按要求本次未执行 build 验证

### 2026-02-10 - 拍照入口增强（拍照与相册分离）

**功能描述：**
- 修复“只能从已有图片选择”的体验问题，新增图片来源选择菜单
- 点击底部相机按钮后，用户可显式选择“拍照”或“从相册选择”
- 拍照入口使用独立 file input（`capture=environment`），相册入口使用无 capture 的独立 input，减少不同浏览器对同一 input 行为不一致导致的误判

**修改的文件：**
- `mobile/src/App.tsx` - 新增 `showImageSourceMenu` 状态、拍照/相册两个隐藏 input 与底部来源菜单

**注意事项：**
- 修改后请重启 `npm run dev` 并在手机端强制刷新页面
- 按要求本次未执行 build 验证

### 2026-02-10 - 图片缓存增强版（可配置目录/清理策略/失败降级）

**功能描述：**
- 新增 PC 端图片缓存设置：可选择缓存目录、设置自动清理间隔（含不自动清理）
- 新增“粘贴失败自动降级路径”策略：目标应用不支持图片粘贴时，自动发送图片文件路径
- 服务端图片缓存改为“内存 + 磁盘目录”双轨：提速同时保留可回溯的缓存文件
- 新增缓存目录定时清理与孤儿文件清理逻辑，降低长期占用风险

**修改的文件：**
- `electron/config.ts` - 新增 `ImageSettings` 配置读写与默认值
- `electron/main.ts` - 新增图片设置 IPC（读取/保存/选择目录）
- `electron/preload.ts` - 暴露图片设置 API 给 renderer
- `src/types/electron.d.ts` - 增加图片设置类型与 ElectronAPI 声明
- `src/App.tsx` - 连接页新增“图片缓存设置”UI（目录、清理间隔、失败降级）
- `electron/server.ts` - 图片缓存写入配置目录、按策略清理、粘贴失败时路径降级发送
- `shared/types.ts` / `electron/types.ts` - 增加 WS `notice` 字段
- `mobile/src/App.tsx` - 处理 `ack.notice` 提示文案

**注意事项：**
- 修改后请重启桌面端进程与 `npm run dev`，确保新 IPC 与服务逻辑生效
- 按要求本次未执行 build 验证

### 2026-02-10 - 修复图片上传超时根因（开发代理环路）

**功能描述：**
- 修复 Electron 开发模式下的代理环路问题：`/api/images` 被错误转发到 Vite 后再次回流，导致请求超时
- 开发代理改为显式白名单策略：`/api` 与 `/ws` 始终由 Electron 本地服务处理，仅静态资源转发到 Vite
- 消除上传链路中的循环转发，图片上传恢复直达后端

**修改的文件：**
- `electron/server.ts` - 重写开发代理挂载方式，防止 `/api` 与 `/ws` 被代理

**注意事项：**
- 修改后需要重启 `npm run dev` 才会生效
- 按要求本次未执行 build 验证

### 2026-02-10 - 图片发送提速优化（预上传 + 内存直通）

**功能描述：**
- 新增图片“预上传”机制：选图后即后台上传，用户点确认时可直接发送，显著缩短体感等待
- 优化 Electron 图片链路为内存直通：服务端不再先写磁盘再读回，减少 I/O 开销
- 预览面板补充预上传状态提示（上传中/完成/失败），失败原因更可读
- 上传超时策略调整为 15 秒快速失败，避免长时间无响应

**修改的文件：**
- `mobile/src/App.tsx` - 预上传流程、确认发送逻辑、状态提示与错误文案
- `electron/server.ts` - 图片缓存由磁盘临时文件改为内存缓存
- `electron/types.ts` - `onImage` 回调参数改为 `Buffer`
- `electron/main.ts` - 图片回调参数适配
- `electron/keyboard.ts` - `pasteImage` 改为直接使用 `Buffer`

**注意事项：**
- 按要求本次未执行 build 验证

### 2026-02-10 - 修复开发模式下图片上传失败（代理与连接链路）

**功能描述：**
- 修复 `dev:mobile` 场景下 `/api/images` 上传失败问题（Vite 代理连接不稳定导致 `ENOBUFS/ECONNRESET`）
- WebSocket 连接在 `8081` 开发端口下改为直连 `23456` 服务端，避免误连到 Vite HMR 通道
- 图片上传在开发端口下改为直连 `23456` API，并新增跨域预检响应支持
- 上传超时时间从 20 秒提升到 60 秒，并优化超时错误提示文案
- Vite 代理目标由 `localhost` 改为 `127.0.0.1`，降低 DNS/IPv6 解析异常概率

**修改的文件：**
- `mobile/src/hooks/useWebSocket.ts` - 开发端口下 WS 直连后端（`/ws`）
- `mobile/src/App.tsx` - 开发端口下图片上传直连后端，完善上传超时错误处理
- `electron/server.ts` - 增加 CORS 与 `OPTIONS` 预检处理
- `mobile/vite.config.ts` - 代理目标切换为 `127.0.0.1` 并增加超时配置

**注意事项：**
- 按要求本次未执行 build 验证

### 2026-02-10 - 移动端图片发送（拍照/选图）能力落地

**功能描述：**
- 新增移动端拍照/选图发送图片能力，支持“发送图片”和“发送并回车”两种动作
- 图片发送链路升级为“HTTP 上传图片 + WebSocket 发送粘贴指令”，降低大体积图片传输风险
- 服务端新增图片上传安全控制：MIME 白名单、10MB 限制、每分钟限流、临时文件 TTL 清理
- Windows 粘贴链路新增图片注入：写入图片剪贴板后执行 `Ctrl+V`，可选追加回车
- 移动端新增图片预览确认面板、上传状态与失败回执展示，并支持图片消息重发
- 历史记录结构扩展支持图片条目元数据，兼容旧文本历史数据

**修改的文件：**
- `shared/types.ts` - 扩展 WebSocket 协议（`image` / `error`）与历史记录图片字段
- `electron/types.ts` - 同步协议类型，新增 `onImage` 回调签名
- `electron/server.ts` - 新增 `/api/images` 上传接口、限流/校验/TTL 清理与图片消息处理
- `electron/keyboard.ts` - 新增 `pasteImage` 图片粘贴实现，增强剪贴板恢复
- `electron/main.ts` - 连接图片消息到键盘注入回调
- `mobile/src/App.tsx` - 新增拍照/选图按钮、图片压缩预览、上传发送、状态与错误 UI
- `src/App.tsx` - PC 端历史记录显示兼容图片条目
- `src/types/electron.d.ts` - 历史记录类型补充图片字段

**注意事项：**
- 按要求本次未执行 build 验证

### 2026-02-10 - 发送区细节微调（placeholder 与按钮再收敛）

**功能描述：**
- placeholder 文案调整为 `请输入文字…`，在保留提示语义的同时保持单行显示
- 发送按钮与模式按钮继续缩小（高度 `h-11`），让底部输入区视觉更轻
- 输入框同步为 `h-11` 并微调内边距，确保与按钮组保持对齐

**修改的文件：**
- `mobile/src/App.tsx` - placeholder 文案、输入框高度、发送区按钮尺寸与图标尺寸

**注意事项：**
- 按要求本次未执行 build 验证

### 2026-02-10 - 移动端发送区对齐再微调

**功能描述：**
- 底部输入区容器从 `items-end` 调整为 `items-center`，输入框与发送按钮垂直轴线一致
- 输入框单行态固定 `h-12`，与右侧按钮组统一高度，减少视觉错位
- placeholder 进一步缩短为 `输入…`，避免窄屏下再次换行

**修改的文件：**
- `mobile/src/App.tsx` - 对齐规则与 placeholder 文案微调

**注意事项：**
- 按要求本次未执行 build 验证

### 2026-02-10 - 移动端输入框与发送按钮对齐修复

**功能描述：**
- 修复输入框与发送按钮高度视觉不对齐问题
- 输入框增加 `min-h-12` 并限制为内部滚动，保证单行状态与按钮基线一致
- 发送按钮组容器固定 `h-12`，按钮改为 `h-full`，确保左右按钮与输入框同一高度体系

**修改的文件：**
- `mobile/src/App.tsx` - 输入框与发送按钮组高度规则统一

**注意事项：**
- 按要求本次未执行 build 验证

### 2026-02-10 - 移动端发送区比例微调（按钮与占位文案）

**功能描述：**
- 缩小发送区按钮视觉体积，使其与页面整体比例更协调
- 缩短输入框占位文案并下调字号，修复小屏下 placeholder 自动换行问题
- 调整输入区横向间距，给输入框留出更多可用宽度

**修改的文件：**
- `mobile/src/App.tsx` - 调整 footer 间距、输入框字号与 placeholder、发送按钮/模式按钮尺寸

**注意事项：**
- 当前环境缺少 `typescript-language-server`，本次通过 `npm run build:mobile` 完成编译验证

### 2026-02-10 - 移动端 UI 进一步优化（小屏与输入稳定性）

**功能描述：**
- 进一步优化小屏可用性：压缩头部垂直占用，提升消息可视区域
- 优化输入稳定性：输入框自动扩展上限与样式保持一致，减少高度跳动感
- 提升触控体验：历史消息条目点击区域增大，发送按钮与模式按钮触达更友好
- 增强移动端输入行为：关闭自动大写/自动补全/拼写纠正，避免命令或术语输入被干扰

**修改的文件：**
- `mobile/src/App.tsx` - 调整 header 间距、列表底部留白缓冲、历史条目间距、输入框属性与发送区按钮尺寸
- `mobile/src/index.css` - 增加根节点 `overscroll-behavior: none`，减少移动端回弹对固定底栏的干扰

**注意事项：**
- 当前环境缺少 `typescript-language-server`，本次仍通过 `npm run build:mobile` 完成编译验证

### 2026-02-10 - 修复移动端输入区遮挡与小屏布局问题

**功能描述：**
- 修复底部固定输入栏与消息列表的重叠问题，避免最后几条消息被遮挡
- 将消息列表底部留白改为随输入栏实际高度动态计算，适配多行输入和不同设备安全区
- 优化输入区横向布局：文本框容器增加 `min-w-0` 防止挤压溢出，发送按钮与模式按钮宽度在小屏下更稳

**修改的文件：**
- `mobile/src/App.tsx` - 新增 footer 高度观测逻辑（`ResizeObserver` + state），主列表动态 `paddingBottom`，并调整底部输入区结构与按钮尺寸

**注意事项：**
- 当前环境缺少 `typescript-language-server`，本次通过 `npm run build:mobile` 完成编译验证

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
