import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { ChatMessage, ChatSession } from './types';

const CHAT_FILE = () => path.join(app.getPath('userData'), 'chat-sessions.json');
const MAX_SESSIONS = 50;

let sessions: ChatSession[] = [];
let currentSessionId: string | null = null;

export function loadSessions(): ChatSession[] {
  try {
    const data = fs.readFileSync(CHAT_FILE(), 'utf-8');
    sessions = JSON.parse(data) ?? [];
  } catch {
    sessions = [];
  }
  return sessions;
}

function saveSessions(): void {
  try {
    fs.writeFileSync(CHAT_FILE(), JSON.stringify(sessions, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save chat sessions:', err);
  }
}

export function createSession(title?: string): ChatSession {
  const session: ChatSession = {
    id: crypto.randomUUID(),
    title: title || `对话 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.unshift(session);
  // 限制总数
  if (sessions.length > MAX_SESSIONS) {
    sessions = sessions.slice(0, MAX_SESSIONS);
  }
  currentSessionId = session.id;
  saveSessions();
  return session;
}

export function getCurrentSession(): ChatSession {
  if (currentSessionId) {
    const session = sessions.find((s) => s.id === currentSessionId);
    if (session) return session;
  }
  // 没有当前会话，创建一个
  return createSession();
}

export function getSession(sessionId: string): ChatSession | undefined {
  return sessions.find((s) => s.id === sessionId);
}

export function setCurrentSession(sessionId: string): ChatSession | undefined {
  const session = sessions.find((s) => s.id === sessionId);
  if (session) {
    currentSessionId = session.id;
  }
  return session;
}

export function addMessage(sessionId: string, message: ChatMessage): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  session.messages.push(message);
  session.updatedAt = Date.now();
  // 用第一条用户消息作为标题
  if (session.messages.length === 1 && message.role === 'user') {
    session.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '');
  }
  saveSessions();
}

export function updateMessage(sessionId: string, messageId: string, updates: Partial<ChatMessage>): void {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  const msg = session.messages.find((m) => m.id === messageId);
  if (!msg) return;
  Object.assign(msg, updates);
  session.updatedAt = Date.now();
  saveSessions();
}

export function getSessions(): ChatSession[] {
  return sessions.map((s) => ({
    ...s,
    messages: [], // 列表不返回消息内容，减少传输量
  }));
}

export function deleteSession(sessionId: string): void {
  sessions = sessions.filter((s) => s.id !== sessionId);
  if (currentSessionId === sessionId) {
    currentSessionId = sessions[0]?.id ?? null;
  }
  saveSessions();
}

export function clearAllSessions(): void {
  sessions = [];
  currentSessionId = null;
  saveSessions();
}
