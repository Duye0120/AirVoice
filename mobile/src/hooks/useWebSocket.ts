import { useState, useEffect, useRef, useCallback } from "react";
import type { WebSocketMessage } from '@shared/types';

interface UseWebSocketOptions {
  onMessage?: (msg: WebSocketMessage) => void;
}

export function useWebSocket({ onMessage }: UseWebSocketOptions = {}) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const connect = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      if (wsRef.current) wsRef.current.close();

      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${location.host}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };
      ws.onclose = () => {
        setConnected(false);
        reconnectTimer.current = window.setTimeout(connect, 1000);
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as WebSocketMessage;
          onMessageRef.current?.(msg);
        } catch (err) {
          console.warn('Failed to parse WebSocket message:', err);
        }
      };
      ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
      };
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") connect();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    connect();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((data: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  return { connected, send };
}
