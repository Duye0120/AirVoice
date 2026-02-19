export interface ServerState {
  ip: string;
  port: number;
  connected: boolean;
}

export interface ServerCallbacks {
  onText?: (text: string, execute?: boolean) => void;
  onImage?: (imageBuffer: Buffer, execute?: boolean) => boolean;
  onConnection?: (connected: boolean) => void;
}

export interface AgentStepInfo {
  type: 'tool-call' | 'tool-result' | 'text';
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  text?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  steps?: AgentStepInfo[];
  streaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export type WebSocketMessageType =
  | 'text' | 'image' | 'ack' | 'error'
  | 'optimize' | 'optimized' | 'confirm'
  | 'ai-config' | 'history' | 'clear-history'
  | 'agent' | 'agent-step' | 'agent-done'
  | 'chat-input' | 'chat-delta' | 'chat-tool-call'
  | 'chat-tool-result' | 'chat-done' | 'chat-error';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  content?: string;
  id?: number;
  execute?: boolean;
  imageId?: string;
  imageName?: string;
  notice?: string;
  original?: string;
  optimized?: string;
  error?: string;
  aiEnabled?: boolean;
  agentEnabled?: boolean;
  history?: HistoryItem[];
  step?: AgentStepInfo;
  steps?: AgentStepInfo[];
  typedText?: string;
  replyMessage?: string;
  chatId?: string;
  delta?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  chatMessages?: ChatMessage[];
}

export interface HistoryItem {
  text?: string;
  kind?: 'text' | 'image';
  imageName?: string;
  time: number;
}
