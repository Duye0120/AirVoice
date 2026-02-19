// 共享类型定义，供 mobile 和 electron 使用

export interface AgentStepInfo {
  type: 'tool-call' | 'tool-result' | 'text';
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  text?: string;
}

/** Chat 消息角色 */
export type ChatRole = 'user' | 'assistant';

/** Chat 消息（PC 端对话历史） */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  /** 工具调用步骤 */
  steps?: AgentStepInfo[];
  /** 是否正在流式输出 */
  streaming?: boolean;
}

/** Chat 会话 */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export type WebSocketMessageType =
  // 现有类型
  | 'text' | 'image' | 'ack' | 'error'
  | 'optimize' | 'optimized' | 'confirm'
  | 'ai-config' | 'history' | 'clear-history'
  | 'agent' | 'agent-step' | 'agent-done'
  // Chat 流式消息（PC IPC + WebSocket 共用）
  | 'chat-input'        // 手机注入文字到 PC Chat
  | 'chat-delta'        // 流式文本片段
  | 'chat-tool-call'    // 工具调用开始
  | 'chat-tool-result'  // 工具调用结果
  | 'chat-done'         // 对话完成
  | 'chat-error';       // 对话错误

export interface WebSocketMessage {
  type: WebSocketMessageType;
  content?: string;
  id?: number;
  execute?: boolean;
  imageId?: string;
  imageName?: string;
  notice?: string;
  // optimize response
  original?: string;
  optimized?: string;
  // error response
  error?: string;
  // ai-config
  aiEnabled?: boolean;
  agentEnabled?: boolean;
  // history
  history?: HistoryItem[];
  // agent
  step?: AgentStepInfo;
  steps?: AgentStepInfo[];
  /** agent 最终输入到 PC 的文字 */
  typedText?: string;
  /** agent 的回复消息（不输入到 PC） */
  replyMessage?: string;
  // chat 流式消息
  /** Chat 消息 ID */
  chatId?: string;
  /** 流式文本增量 */
  delta?: string;
  /** 工具调用信息 */
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  /** Chat 历史 */
  chatMessages?: ChatMessage[];
}

export interface HistoryItem {
  text?: string;
  kind?: 'text' | 'image';
  imageName?: string;
  time: number;
}
