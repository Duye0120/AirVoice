export interface ServerState {
  ip: string;
  port: number;
  connected: boolean;
}

export interface ServerCallbacks {
  onText?: (text: string, execute?: boolean) => void;
  onConnection?: (connected: boolean) => void;
}

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
