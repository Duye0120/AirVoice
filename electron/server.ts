import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import http from 'http';
import os from 'os';
import fs from 'fs';
import { EventEmitter } from 'events';
import { app } from 'electron';
import type { ServerState, ServerCallbacks, WebSocketMessage } from './types';

const PORT = 23456;
const DEV_PORT = 5173; // vite dev server port
const isDev = process.env.NODE_ENV === 'development';

let connected = false;
let wsClient: WebSocket | null = null;
let callbacks: ServerCallbacks = {};
let currentIP = '127.0.0.1';
let ipCheckInterval: NodeJS.Timeout | null = null;

// 事件发射器，用于通知连接状态和 IP 变化
export const serverEvents = new EventEmitter();

// 历史记录存储
const historyPath = path.join(app.getPath('userData'), 'history.json');

interface HistoryItem {
  text: string;
  time: number;
}

let historyCache: HistoryItem[] | null = null;
let saveTimer: NodeJS.Timeout | null = null;

function loadHistory(): HistoryItem[] {
  if (historyCache) return historyCache;
  try {
    if (fs.existsSync(historyPath)) {
      historyCache = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      return historyCache!;
    }
  } catch (err) {
    console.warn('Failed to load history:', err);
  }
  historyCache = [];
  return historyCache;
}

function saveHistory(history: HistoryItem[]): void {
  historyCache = history;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFileSync(historyPath, JSON.stringify(history.slice(0, 50)));
  }, 500);
}

function addHistory(text: string): void {
  const history = loadHistory();
  history.unshift({ text, time: Date.now() });
  saveHistory(history);
}

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  const virtualKeywords = ['vmware', 'virtual', 'vbox', 'docker', 'wsl', 'hyper-v'];

  for (const name of Object.keys(interfaces)) {
    const nameLower = name.toLowerCase();
    if (virtualKeywords.some(k => nameLower.includes(k))) continue;

    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
          return iface.address;
        }
      }
    }
  }

  for (const name of Object.keys(interfaces)) {
    const nameLower = name.toLowerCase();
    if (virtualKeywords.some(k => nameLower.includes(k))) continue;

    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }

  return '127.0.0.1';
}

function checkIPChange(): void {
  const newIP = getLocalIP();
  if (newIP !== currentIP) {
    const oldIP = currentIP;
    currentIP = newIP;
    serverEvents.emit('ip-changed', { oldIP, newIP });
  }
}

export function startServer(cbs: ServerCallbacks): void {
  callbacks = cbs;
  const expressApp = express();
  const server = http.createServer(expressApp);

  // 开发模式：代理到 vite dev server
  if (isDev) {
    const { createProxyMiddleware } = require('http-proxy-middleware');
    expressApp.use('/', createProxyMiddleware({
      target: `http://localhost:${DEV_PORT}`,
      changeOrigin: true,
      ws: false,
      filter: (req: any) => !req.url.startsWith('/api'),
    }));
  } else {
    expressApp.use(express.static(path.join(__dirname, '../mobile')));
  }

  expressApp.get('/api/info', (_req, res) => {
    res.json({ ip: getLocalIP(), port: PORT });
  });

  expressApp.get('/api/history', (_req, res) => {
    res.json(loadHistory().slice(0, 20));
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, _req) => {
    wsClient = ws;
    connected = true;
    callbacks.onConnection?.(true);
    serverEvents.emit('connection-changed', true);

    ws.on('message', (data) => {
      try {
        const msg: WebSocketMessage = JSON.parse(data.toString());
        if (msg.type === 'text' && msg.content) {
          callbacks.onText?.(msg.content, msg.execute);
          addHistory(msg.content);
          ws.send(JSON.stringify({ type: 'ack', id: msg.id }));
        }
      } catch (err) {
        console.warn('Failed to parse WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      connected = false;
      wsClient = null;
      callbacks.onConnection?.(false);
      serverEvents.emit('connection-changed', false);
    });
  });

  // 初始化 IP
  currentIP = getLocalIP();

  // 启动 IP 变化检测（每 5 秒检查一次）
  ipCheckInterval = setInterval(checkIPChange, 5000);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://${currentIP}:${PORT}`);
  });
}

export function stopServer(): void {
  if (ipCheckInterval) {
    clearInterval(ipCheckInterval);
    ipCheckInterval = null;
  }
}

export function getState(): ServerState {
  return { ip: currentIP, port: PORT, connected };
}
