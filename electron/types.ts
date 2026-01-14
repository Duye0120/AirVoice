export interface ServerState {
  ip: string;
  port: number;
  connected: boolean;
}

export interface ServerCallbacks {
  onText?: (text: string, execute?: boolean) => void;
  onConnection?: (connected: boolean) => void;
}

// 从共享类型导入
export type { WebSocketMessage, HistoryItem } from '../shared/types';
