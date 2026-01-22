// 共享类型定义，供 mobile 和 electron 使用

export interface WebSocketMessage {
  type: 'text' | 'ack' | 'optimize' | 'optimized' | 'confirm' | 'ai-config' | 'history' | 'clear-history';
  content?: string;
  id?: number;
  execute?: boolean;
  // optimize response
  original?: string;
  optimized?: string;
  // ai-config
  aiEnabled?: boolean;
  // history
  history?: HistoryItem[];
}

export interface HistoryItem {
  text: string;
  time: number;
}
