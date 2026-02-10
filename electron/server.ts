import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import http from 'http';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { app } from 'electron';
import type { ServerState, ServerCallbacks, WebSocketMessage } from './types';
import { optimizeText } from './ai';
import { getConfig, getImageSettings } from './config';

const PORT = 23456;
const DEV_PORT = 8081;
const isDev = process.env.NODE_ENV === 'development';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOADS_PER_MINUTE = 20;
const IMAGE_CLEANUP_INTERVAL_MS = 60 * 1000;
const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

let connected = false;
let wsClient: WebSocket | null = null;
let callbacks: ServerCallbacks = {};
let currentIP = '127.0.0.1';
let ipCheckInterval: NodeJS.Timeout | null = null;
let imageCleanupTimer: NodeJS.Timeout | null = null;

export const serverEvents = new EventEmitter();

const historyPath = path.join(app.getPath('userData'), 'history.json');

interface HistoryItem {
  text?: string;
  kind?: 'text' | 'image';
  imageName?: string;
  time: number;
}

interface StoredImage {
  id: string;
  buffer: Buffer;
  filePath: string;
  mime: string;
  size: number;
  name: string;
  createdAt: number;
}

let historyCache: HistoryItem[] | null = null;
let saveTimer: NodeJS.Timeout | null = null;
const uploadedImages = new Map<string, StoredImage>();
const uploadRateMap = new Map<string, number[]>();

export function loadHistory(): HistoryItem[] {
  if (historyCache) return historyCache;
  try {
    if (fs.existsSync(historyPath)) {
      const parsed = JSON.parse(fs.readFileSync(historyPath, 'utf-8')) as unknown;
      if (Array.isArray(parsed)) {
        historyCache = parsed
          .map((item) => normalizeHistoryItem(item))
          .filter((item): item is HistoryItem => item !== null);
      } else {
        historyCache = [];
      }
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

function normalizeHistoryItem(item: unknown): HistoryItem | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const value = item as Partial<HistoryItem>;
  const time = typeof value.time === 'number' ? value.time : Date.now();
  if (value.kind === 'image') {
    const imageName = typeof value.imageName === 'string' && value.imageName.trim()
      ? value.imageName
      : '图片';
    const text = typeof value.text === 'string' && value.text.trim()
      ? value.text
      : `[图片] ${imageName}`;
    return { kind: 'image', imageName, text, time };
  }

  if (typeof value.text === 'string' && value.text.trim()) {
    return { kind: 'text', text: value.text, time };
  }

  return null;
}

function addTextHistory(text: string): void {
  const history = loadHistory();
  history.unshift({ text, kind: 'text', time: Date.now() });
  saveHistory(history);
}

function addImageHistory(imageName?: string): void {
  const normalizedName = typeof imageName === 'string' && imageName.trim() ? imageName.trim() : '图片';
  const history = loadHistory();
  history.unshift({
    kind: 'image',
    imageName: normalizedName,
    text: `[图片] ${normalizedName}`,
    time: Date.now(),
  });
  saveHistory(history);
}

function normalizeClientIP(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function sanitizeImageName(name: string): string {
  const cleaned = name
    .replace(/[\\/]/g, '_')
    .replace(/[<>:"|?*\x00-\x1F]/g, '_')
    .trim();
  return cleaned.slice(0, 100) || 'image';
}

function canUploadImage(ip: string): boolean {
  const now = Date.now();
  const records = uploadRateMap.get(ip) ?? [];
  const recentRecords = records.filter((timestamp) => now - timestamp < 60_000);
  if (recentRecords.length >= MAX_UPLOADS_PER_MINUTE) {
    uploadRateMap.set(ip, recentRecords);
    return false;
  }
  recentRecords.push(now);
  uploadRateMap.set(ip, recentRecords);
  return true;
}

function ensureCacheDir(): string {
  const imageSettings = getImageSettings();
  const fallbackDir = path.join(app.getPath('userData'), 'image-cache');
  const cacheDir = imageSettings?.cacheDir?.trim() || fallbackDir;
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

function getCleanupTTLms(): number {
  const imageSettings = getImageSettings();
  const minutes = imageSettings?.cleanupIntervalMinutes ?? 60;
  if (minutes <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return minutes * 60 * 1000;
}

function getImageExtensionByMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function storeImage(buffer: Buffer, mime: string, name: string): StoredImage {
  const cacheDir = ensureCacheDir();
  const id = crypto.randomUUID();
  const fileName = `${id}-${sanitizeImageName(name)}.${getImageExtensionByMime(mime)}`;
  const filePath = path.join(cacheDir, fileName);
  fs.writeFileSync(filePath, buffer);

  const image: StoredImage = {
    id,
    buffer,
    filePath,
    mime,
    size: buffer.length,
    name,
    createdAt: Date.now(),
  };

  uploadedImages.set(id, image);
  return image;
}

function getStoredImage(imageId: string): StoredImage | null {
  const image = uploadedImages.get(imageId);
  if (!image) {
    return null;
  }

  const ttlMs = getCleanupTTLms();
  if (Number.isFinite(ttlMs) && Date.now() - image.createdAt > ttlMs) {
    uploadedImages.delete(imageId);
    if (fs.existsSync(image.filePath)) {
      fs.unlinkSync(image.filePath);
    }
    return null;
  }

  return image;
}

function cleanupExpiredImages(): void {
  const now = Date.now();
  const ttlMs = getCleanupTTLms();

  uploadedImages.forEach((image, imageId) => {
    if (!Number.isFinite(ttlMs) || now - image.createdAt <= ttlMs) {
      return;
    }
    uploadedImages.delete(imageId);
    if (fs.existsSync(image.filePath)) {
      try {
        fs.unlinkSync(image.filePath);
      } catch (err) {
        console.warn('Failed to remove expired image cache file:', err);
      }
    }
  });

  uploadRateMap.forEach((records, ip) => {
    const recentRecords = records.filter((timestamp) => now - timestamp < 60_000);
    if (recentRecords.length === 0) {
      uploadRateMap.delete(ip);
      return;
    }
    uploadRateMap.set(ip, recentRecords);
  });

  if (!Number.isFinite(ttlMs)) {
    return;
  }

  try {
    const cacheDir = ensureCacheDir();
    const files = fs.readdirSync(cacheDir);
    for (const file of files) {
      const filePath = path.join(cacheDir, file);
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) continue;
      if (now - stats.mtimeMs > ttlMs) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.warn('Failed to cleanup image cache directory:', err);
  }
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
    const viteProxy = createProxyMiddleware({
      target: `http://localhost:${DEV_PORT}`,
      changeOrigin: true,
      ws: false,
    });

    // Keep /api and /ws inside Electron server; only static assets go to Vite.
    expressApp.use((req, res, next) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/ws')) {
        next();
        return;
      }
      viteProxy(req, res, next);
    });
  } else {
    expressApp.use(express.static(path.join(__dirname, '../mobile')));
  }

  expressApp.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Image-Name');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  expressApp.get('/api/info', (_req, res) => {
    res.json({ ip: getLocalIP(), port: PORT });
  });

  expressApp.get('/api/history', (_req, res) => {
    res.json(loadHistory().slice(0, 20));
  });

  expressApp.post('/api/images', express.raw({ type: '*/*', limit: '10mb' }), (req, res) => {
    const clientIP = normalizeClientIP(req.ip || req.socket.remoteAddress || 'unknown');
    if (!canUploadImage(clientIP)) {
      res.status(429).json({ error: '发送过于频繁，请稍后再试' });
      return;
    }

    const mime = (req.headers['content-type'] || '').toString().split(';')[0].trim().toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      res.status(415).json({ error: '仅支持 JPEG / PNG / WebP 图片' });
      return;
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: '图片内容为空' });
      return;
    }

    if (req.body.length > MAX_IMAGE_BYTES) {
      res.status(413).json({ error: '图片大小超出限制' });
      return;
    }

    const rawNameHeader = req.headers['x-image-name'];
    const rawName = typeof rawNameHeader === 'string'
      ? rawNameHeader
      : Array.isArray(rawNameHeader)
        ? rawNameHeader[0]
        : 'image';

    let decodedName = rawName;
    try {
      decodedName = decodeURIComponent(rawName);
    } catch {
      decodedName = rawName;
    }

    try {
      const storedImage = storeImage(req.body, mime, sanitizeImageName(decodedName));
      res.json({
        imageId: storedImage.id,
        mime: storedImage.mime,
        size: storedImage.size,
      });
    } catch (err) {
      console.warn('Failed to store image:', err);
      res.status(500).json({ error: '图片上传失败' });
    }
  });

  expressApp.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    const error = err as { type?: string };
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ error: '图片大小超出限制' });
      return;
    }
    next(err);
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
          addTextHistory(finalText);
          sendToClient({ type: 'ack', id: msg.id });
        }

        else if (msg.type === 'image' && msg.imageId) {
          const storedImage = getStoredImage(msg.imageId);
          if (!storedImage) {
            sendToClient({ type: 'error', id: msg.id, error: '图片已过期或不存在，请重新上传' });
            return;
          }

          const pasted = callbacks.onImage?.(storedImage.buffer, msg.execute) ?? false;
          if (!pasted) {
            const imageSettings = getImageSettings();
            if (imageSettings?.fallbackToPathWhenPasteFails) {
              callbacks.onText?.(storedImage.filePath, msg.execute);
              addImageHistory(`${msg.imageName || storedImage.name}（路径降级）`);
              sendToClient({ type: 'ack', id: msg.id, notice: '图片粘贴失败，已自动发送文件路径' });
              return;
            }

            sendToClient({ type: 'error', id: msg.id, error: '图片粘贴失败，请切换到可粘贴图片的目标应用' });
            return;
          }

          addImageHistory(msg.imageName || storedImage.name);
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
          addTextHistory(msg.content);
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
  imageCleanupTimer = setInterval(cleanupExpiredImages, IMAGE_CLEANUP_INTERVAL_MS);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://${currentIP}:${PORT}`);
  });
}

export function stopServer(): void {
  if (ipCheckInterval) {
    clearInterval(ipCheckInterval);
    ipCheckInterval = null;
  }
  if (imageCleanupTimer) {
    clearInterval(imageCleanupTimer);
    imageCleanupTimer = null;
  }

  uploadedImages.clear();
  uploadRateMap.clear();
}

export function getState(): ServerState {
  return { ip: currentIP, port: PORT, connected };
}

// Notify client when AI config changes
export function notifyAIConfigChanged(): void {
  sendToClient({ type: 'ai-config', aiEnabled: isAIEnabled() });
}
