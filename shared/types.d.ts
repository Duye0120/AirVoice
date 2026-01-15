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
