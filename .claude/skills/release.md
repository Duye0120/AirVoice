---
argument-hint: <version> [description]
description: Create GitHub release with bilingual notes and executables
---

# Release Skill

自动创建 GitHub Release，包含中英文双语说明和可执行文件。

## 使用方法

```bash
/release <version> [description]
```

例如：
```bash
/release 0.0.3
/release 0.0.3 "添加深色模式切换功能"
```

## 执行步骤

### 1. 更新版本号
- 修改 `package.json` 中的 `version` 字段为指定版本

### 2. 构建应用
- 运行 `npm run dist` 生成可执行文件
- 生成的文件位于 `release/` 目录：
  - `AirVoice Setup <version>.exe` - NSIS 安装包
  - `AirVoice <version>.exe` - 便携版

### 3. 分析变更内容
- 运行 `git log` 查看自上次 tag 以来的提交记录
- 自动分类提交类型：
  - 🎨 UI 改进 (style, ui)
  - ✨ 功能优化 (feat, feature)
  - 🐛 Bug 修复 (fix)
  - 📝 文档更新 (docs)
  - ♻️ 代码重构 (refactor)
  - ⚡️ 性能优化 (perf)
  - 🔧 其他 (chore, build, ci)

### 4. 生成 Release Notes（中英双语）

格式：
```markdown
## 🎨 UI 改进
- 优化移动端界面设计
- 添加深色模式切换功能

## ✨ 功能优化
- 添加应用版本更新检测机制
- 优化 WebSocket 连接稳定性

## 🐛 Bug 修复
- 修复输入区域高度溢出问题
- 修复消息列表底部按钮被遮挡

## 📦 其他
- 性能优化和稳定性改进

---

## 🎨 UI Improvements
- Optimize mobile interface design
- Add dark mode toggle

## ✨ Feature Enhancements
- Add app version update detection
- Improve WebSocket connection stability

## 🐛 Bug Fixes
- Fix input area height overflow
- Fix message list bottom button occlusion

## 📦 Others
- Performance optimization and stability improvements
```

### 5. 提交并创建 Release
- `git add package.json`
- `git commit -m "chore: bump version to <version>"`
- `git tag v<version>`
- `git push && git push --tags`
- `gh release create v<version>` 上传文件和 Release Notes

## 注意事项

1. **自动翻译**：中文内容自动翻译为英文（使用简洁的技术英语）
2. **文件上传**：自动上传两个 exe 文件到 Release
3. **版本格式**：版本号格式为 `x.y.z`（如 0.0.3）
4. **构建时间**：构建过程可能需要 1-2 分钟

## 示例输出

```
✅ 版本号已更新: 0.0.3
🔨 开始构建应用...
✅ 构建完成
📝 生成 Release Notes...
✅ 提交并推送到远程
🚀 创建 GitHub Release: v0.0.3
✅ 上传文件:
   - AirVoice Setup 0.0.3.exe
   - AirVoice 0.0.3.exe
✅ Release 创建成功: https://github.com/Duye0120/AirVoice/releases/tag/v0.0.3
```
