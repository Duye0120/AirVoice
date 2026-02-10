// 共享类型定义，供 mobile 和 electron 使用

export interface WebSocketMessage {
  type: 'text' | 'image' | 'ack' | 'error' | 'optimize' | 'optimized' | 'confirm' | 'ai-config' | 'history' | 'clear-history';
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
  // history
  history?: HistoryItem[];
}

export interface HistoryItem {
  text?: string;
  kind?: 'text' | 'image';
  imageName?: string;
  time: number;
}
