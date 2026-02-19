# UI 统一规范（shadcn/ui）

## 1. 目标

- 统一 **PC 端（`src/`）** 与 **移动端（`mobile/`）** 的视觉语言与组件行为。
- 以 `shadcn/ui + Tailwind` 作为组件基线，减少“同功能两套样式”的割裂感。
- 继续遵循产品优先级：**好看、顺手、响应快**。

## 2. 范围

### In Scope

- 两端主题 Token（颜色、圆角、阴影、间距、字体）
- 通用基础组件（Button/Input/Select/Switch/Card/Sheet/Dialog/Toast）
- 页面级一致性（连接、历史、设置、底部输入区）

### Out of Scope（本轮不做）

- 业务逻辑重构（WebSocket、图片上传协议）
- 信息架构重做（导航结构保持不变）
- 动画库替换（仅保留 Tailwind + CSS 动效）

## 3. 组件架构规范

## 3.1 Source of Truth

- `src/components/ui/*` 作为 shadcn 组件主来源（单一真源）。
- 移动端不再手写平行基础组件，改为复用同一套 UI 组件（通过 alias 引入）。

## 3.2 目录建议

- 通用基础组件：`src/components/ui/*`
- 业务复合组件：
  - PC：`src/components/*`
  - Mobile：`mobile/src/components/*`
- 主题规范文档：本文件 + `plan/CHANGELOG.md`

## 3.3 别名规范

- PC 保持：`@ -> src`
- Mobile 新增：`@ui -> ../src/components/ui`（或等价路径）
- 避免复制 UI 组件到 `mobile/src/components/ui`，除非出现端特有实现。

## 4. 设计 Token 规范

## 4.1 颜色 Token（语义优先）

- 主色：`--primary`
- 成功：`--success`
- 警告：`--warning`
- 危险：`--destructive`
- 文本层级：`--foreground` / `--muted-foreground`
- 边框/输入：`--border` / `--input`

规则：业务代码里禁止写死 hex（示例色板除外），必须走语义变量。

## 4.2 圆角

- 基准：`--radius: 0.75rem`
- 组件映射：
  - Button/Input/Select Trigger：`rounded-xl`
  - Card：`rounded-2xl`
  - Sheet/Drawer 顶部：`rounded-t-3xl`

## 4.3 阴影

- `shadow-sm`：普通卡片
- `shadow-md`：浮层/菜单
- 禁止高饱和重阴影（避免廉价感）

## 4.4 字体与字号

- 字体：`Inter + 中文系统字体回退`
- 正文：14~16px
- 标题：24~28px（桌面）/ 28~32px（移动主标题可更大）
- 禁止同屏出现 4 种以上字号层级

## 5. 交互与状态规范

## 5.1 反馈优先级

- 首选：微动效（`active:scale-[0.98]`）+ 颜色变化
- 上传/发送状态必须可见：`uploading/sending/sent/failed`
- 错误文案可读，不直接暴露底层异常原文

## 5.2 关键操作

- 发送/删除/清空等操作需有明显视觉区分
- 移动端底部菜单统一使用 Sheet 风格，不混用浏览器原生弹层

## 5.3 可访问性

- 所有 icon button 必须有 `aria-label`
- 可交互控件最小点击区域：40x40（桌面），44x44（移动）
- 文本对比度满足可读（避免浅灰叠浅灰）

## 6. 页面级一致性模板

## 6.1 连接页

- 标题 + 状态芯片（AI 启用状态）
- 主卡片：二维码、服务地址、连接状态
- 次卡片：图片缓存设置

## 6.2 历史页

- 历史项卡片化（时间列 + 内容列）
- 状态边或状态点统一语义色

## 6.3 移动端输入区

- 左侧工具入口（拍照/相册）
- 中间输入框
- 右侧发送动作（发送 / 发送并回车）
- 所有元素高度体系一致（避免错位）

## 7. 迁移策略（分阶段）

### Phase A：Token 对齐（先做）

- 对齐两端 `:root` 变量（颜色、radius、success/warning）
- 统一 Button/Input/Select/Card 的基础样式

### Phase B：基础组件统一

- Mobile 改用 shadcn 基础组件（通过 `@ui`）
- 清理重复样式与平行实现

### Phase C：页面统一

- 连接页 -> 历史页 -> 设置页 -> 角色页
- 每页只改视觉与交互，不改业务流程

### Phase D：体验打磨

- 动效节奏统一
- 空状态/错误态统一
- 触控与键鼠细节收敛

## 8. 验收标准（Definition of Done）

- 同类组件在两端视觉一致（圆角、边框、hover/active、禁用态）
- 关键流程（输入、发送、拍照、上传、历史）无样式错位
- 页面层级清晰：主内容 > 次级设置 > 辅助信息
- 不出现“PC 旧风格 + Mobile 新风格”混搭

## 9. 决策记录

- 先出规范再迁移代码（当前决策）
- 允许端特化布局，不允许端特化基础组件风格
- 美观与实用性并重：功能上线前必须过“自己愿不愿意用”这条线

## 10. 组件清单（完整迁移基线）

> 本节用于防止上下文丢失，作为后续迁移的唯一执行清单。

### 10.1 基础组件（必须统一）

- `Button`：`src/components/ui/button.tsx`
- `Input`：`src/components/ui/input.tsx`
- `Textarea`：`src/components/ui/textarea.tsx`
- `Select`：`src/components/ui/select.tsx`
- `Switch`：`src/components/ui/switch.tsx`
- `Card`：`src/components/ui/card.tsx`
- `Label`：`src/components/ui/label.tsx`

### 10.2 推荐补齐组件（用于体验一致）

- `Sheet`（移动端底部菜单统一）
- `Dialog`（确认/危险操作）
- `Badge`（状态芯片）
- `Separator`（分区层次）
- `ScrollArea`（历史长列表）
- `Toast`（轻提示，替换 alert）

### 10.3 页面映射（PC）

- 连接页：标题 + 状态芯片 + QR 卡片 + 图片缓存设置卡片
- 历史页：按日期分组 + 卡片化列表 + 清空操作
- AI 设置页：优化模式卡片 + Provider 卡片组 + 配置表单
- 角色页：角色选择 + 提示词编辑 + 新增/保存交互

### 10.4 页面映射（Mobile）

- 顶部状态栏（连接、AI 标签）
- 消息列表卡片（sending/sent/failed/uploading）
- 底部输入条（拍照/相册、输入框、发送模式）
- 图片预览确认层、来源选择层、模式菜单层

## 11. 当前进度快照（2026-02-10）

- 已完成：PC 端基础视觉升级（`src/index.css` + `src/App.tsx`）
- 已完成：基础组件圆角/交互统一（Button/Input/Select/Card）
- 已完成：移动端拍照入口分流（拍照/相册）
- 待完成：移动端全面替换为 shadcn 组件调用（以 `@ui` 复用为主）
- 待完成：`components.json` 标准化配置与组件清单固化

## 12. 下一步执行顺序（防中断版）

1. 建立 `components.json`（仓库级）
2. 配置 mobile 侧 `@ui` alias，直接复用 `src/components/ui/*`
3. Mobile 输入区与底部弹层改为 `Button/Input/Sheet` 组合
4. Mobile 历史项与状态标签改为 `Card/Badge`
5. Mobile 提示机制改为 `Toast`（替代 `alert`）
6. 全局检查：交互尺寸、圆角、状态色、文案一致
