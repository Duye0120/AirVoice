// 共享类型定义，供 mobile 和 electron 使用

export interface WebSocketMessage {
  type: 'text' | 'ack';
  content?: string;
  id?: number;
  execute?: boolean;
}

export interface HistoryItem {
  text: string;
  time: number;
}
