import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import os from 'os';
import type { ServerState, ServerCallbacks, WebSocketMessage } from './types';

const PORT = 23456;
let token = crypto.randomBytes(16).toString('hex');
let connected = false;
let wsClient: WebSocket | null = null;
let callbacks: ServerCallbacks = {};

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
  const app = express();
  const server = http.createServer(app);

  app.use(express.static(path.join(__dirname, '../mobile')));

  app.get('/api/verify', (req, res) => {
    if (req.query.token === token) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false });
    }
  });

  app.get('/api/info', (_req, res) => {
    res.json({ ip: getLocalIP(), port: PORT, token });
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    if (url.searchParams.get('token') !== token) {
      ws.close(1008, 'Invalid token');
      return;
    }

    wsClient = ws;
    connected = true;
    callbacks.onConnection?.(true);

    ws.on('message', (data) => {
      try {
        const msg: WebSocketMessage = JSON.parse(data.toString());
        if (msg.type === 'text' && msg.content) {
          callbacks.onText?.(msg.content, msg.execute);
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
  return { ip: getLocalIP(), port: PORT, token, connected };
}
