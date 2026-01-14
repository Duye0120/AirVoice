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
  type: 'text' | 'ack';
  content?: string;
  id?: number;
  execute?: boolean;
}
