import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import http from 'http';
import os from 'os';
import fs from 'fs';
import { app } from 'electron';
import type { ServerState, ServerCallbacks, WebSocketMessage } from './types';

const PORT = 23456;
const DEV_PORT = 5173; // vite dev server port
const isDev = process.env.NODE_ENV === 'development';

let connected = false;
let wsClient: WebSocket | null = null;
let callbacks: ServerCallbacks = {};

// 历史记录存储
const historyPath = path.join(app.getPath('userData'), 'history.json');

interface HistoryItem {
  text: string;
  time: number;
}

function loadHistory(): HistoryItem[] {
  try {
    if (fs.existsSync(historyPath)) {
      return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveHistory(history: HistoryItem[]): void {
  fs.writeFileSync(historyPath, JSON.stringify(history.slice(0, 50)));
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

    ws.on('message', (data) => {
      try {
        const msg: WebSocketMessage = JSON.parse(data.toString());
        if (msg.type === 'text' && msg.content) {
          callbacks.onText?.(msg.content, msg.execute);
          addHistory(msg.content);
          ws.send(JSON.stringify({ type: 'ack', id: msg.id }));
        }
      } catch {}
    });

    ws.on('close', () => {
      connected = false;
      wsClient = null;
      callbacks.onConnection?.(false);
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://${getLocalIP()}:${PORT}`);
  });
}

export function getState(): ServerState {
  return { ip: getLocalIP(), port: PORT, connected };
}
