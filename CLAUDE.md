# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Rules

**NEVER push to remote repository unless explicitly requested by the user.**

Only run `git push` when the user specifically asks to push changes.

## Build Commands

```bash
npm install          # Install dependencies
npm run dev          # Development mode (hot reload for mobile + electron)
npm run start        # Build all and run electron
npm run dist         # Build and package for distribution
```

Individual build commands:
- `npm run build:mobile` - Build mobile web app
- `npm run build:renderer` - Build PC renderer
- `npm run build:electron` - Compile electron TypeScript

## Architecture

This is an Electron app that enables mobile voice input to PC via LAN WebSocket.

**Data Flow:**
1. Mobile browser connects via WebSocket (LAN)
2. User types/speaks text on mobile
3. Text sent to Electron main process via WebSocket
4. PC simulates Ctrl+V using Windows SendInput API (koffi)

**Three Build Targets:**
- `electron/` → `dist/electron/` - Main process (Express server, WebSocket, keyboard simulation)
- `src/` → `dist/renderer/` - PC QR code window (React)
- `mobile/` → `dist/mobile/` - Mobile web interface (React + Ant Design Mobile)

**Key Implementation Details:**
- Keyboard input uses clipboard + Ctrl+V (not SendInput for text) for Warp terminal compatibility
- Token-based auth prevents unauthorized access
- History stored in `app.getPath('userData')/history.json`
- System tray with dynamic icon color (green=connected, blue=disconnected)

## Platform

Windows only (uses koffi for user32.dll SendInput API).

## Development Workflow

完成一个功能后，必须在 `plan/CHANGELOG.md` 中记录更新内容，包括：
- 功能描述
- 修改的文件
- 注意事项（如有）
