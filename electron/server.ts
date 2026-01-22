import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import http from 'http';
import os from 'os';
import fs from 'fs';
import { EventEmitter } from 'events';
import { app } from 'electron';
import type { ServerState, ServerCallbacks, WebSocketMessage } from './types';
import { optimizeText } from './ai';
import { getConfig } from './config';

const PORT = 23456;
const DEV_PORT = 8081;
const isDev = process.env.NODE_ENV === 'development';

let connected = false;
let wsClient: WebSocket | null = null;
let callbacks: ServerCallbacks = {};
let currentIP = '127.0.0.1';
let ipCheckInterval: NodeJS.Timeout | null = null;

export const serverEvents = new EventEmitter();

const historyPath = path.join(app.getPath('userData'), 'history.json');

interface HistoryItem {
  text: string;
  time: number;
}

let historyCache: HistoryItem[] | null = null;
let saveTimer: NodeJS.Timeout | null = null;

export function loadHistory(): HistoryItem[] {
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

export function saveHistory(history: HistoryItem[]): void {
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

function isAIEnabled(): boolean {
  const config = getConfig();
  const providerConfig = config.providers[config.provider];
  return config.optimizeMode !== 'off' && !!providerConfig.apiKey;
}

function sendToClient(msg: WebSocketMessage): void {
  if (wsClient?.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify(msg));
  }
}

export function startServer(cbs: ServerCallbacks): void {
  callbacks = cbs;
  const expressApp = express();
  const server = http.createServer(expressApp);

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

  wss.on('connection', (ws) => {
    wsClient = ws;
    connected = true;
    callbacks.onConnection?.(true);
    serverEvents.emit('connection-changed', true);

    // Send AI config status on connection
    sendToClient({ type: 'ai-config', aiEnabled: isAIEnabled() });
    // Send history on connection
    sendToClient({ type: 'history', history: loadHistory().slice(0, 20) });

    ws.on('message', async (data) => {
      try {
        const msg: WebSocketMessage = JSON.parse(data.toString());
        
        if (msg.type === 'text' && msg.content) {
          // Direct send (AI off or auto mode)
          const config = getConfig();
          const providerConfig = config.providers[config.provider];
          let finalText = msg.content;
          
          if (config.optimizeMode === 'auto' && providerConfig.apiKey) {
            finalText = await optimizeText(msg.content);
          }
          
          callbacks.onText?.(finalText, msg.execute);
          addHistory(finalText);
          sendToClient({ type: 'ack', id: msg.id });
        }
        
        else if (msg.type === 'optimize' && msg.content) {
          // Request AI optimization, return result for preview
          try {
            const optimized = await optimizeText(msg.content);
            sendToClient({
              type: 'optimized',
              id: msg.id,
              original: msg.content,
              optimized,
              execute: msg.execute
            });
          } catch (err) {
            // On error, return original text
            sendToClient({
              type: 'optimized',
              id: msg.id,
              original: msg.content,
              optimized: msg.content,
              execute: msg.execute
            });
          }
        }
        
        else if (msg.type === 'confirm' && msg.content) {
          // User confirmed, execute paste
          callbacks.onText?.(msg.content, msg.execute);
          addHistory(msg.content);
          sendToClient({ type: 'ack', id: msg.id });
        }
        
        else if (msg.type === 'clear-history') {
          // Clear history
          saveHistory([]);
          sendToClient({ type: 'history', history: [] });
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

  currentIP = getLocalIP();
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

// Notify client when AI config changes
export function notifyAIConfigChanged(): void {
  sendToClient({ type: 'ai-config', aiEnabled: isAIEnabled() });
}
