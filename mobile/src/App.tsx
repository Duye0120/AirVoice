import { useState, useEffect, useRef, useCallback } from "react";
import "./App.scss";

const token = new URLSearchParams(window.location.search).get("token");

interface WebSocketMessage {
  type: "text" | "ack";
  content?: string;
  id?: number;
  execute?: boolean;
}

interface Message {
  id: number;
  text: string;
  status: "sending" | "sent" | "history";
}

interface HistoryItem {
  text: string;
  time: number;
}

function useWebSocket(onMessage: (msg: WebSocketMessage) => void) {
  const [connected, setConnected] = useState(false);
  const [serverInfo, setServerInfo] = useState({ ip: "", port: 0 });
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 获取服务器信息
    fetch("/api/info")
      .then((r) => r.json())
      .then((info) => setServerInfo({ ip: info.ip, port: info.port }))
      .catch(() => {});

    const connect = () => {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${location.host}?token=${token}`);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        setConnectedAt(Date.now());
      };
      ws.onclose = () => {
        setConnected(false);
        setConnectedAt(null);
        setTimeout(connect, 3000);
      };
      ws.onmessage = (e) => {
        try {
          onMessage(JSON.parse(e.data));
        } catch {}
      };
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  const send = useCallback((data: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  return { connected, send, serverInfo, connectedAt };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}小时${minutes % 60}分钟`;
  if (minutes > 0) return `${minutes}分${seconds % 60}秒`;
  return `${seconds}秒`;
}

// 图标组件
const Icons = {
  Send: () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  ),
  Keyboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
    </svg>
  ),
  Copy: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 4v6h6M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
  Enter: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 10l-5 5 5 5" />
      <path d="M20 4v7a4 4 0 01-4 4H4" />
    </svg>
  ),
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem("twm_history");
    if (!saved) return [];
    const history: HistoryItem[] = JSON.parse(saved);
    return history
      .slice(0, 5)
      .map((h, i) => ({ id: -i - 1, text: h.text, status: "history" as const }));
  });
  const [input, setInput] = useState("");
  const [showPanel, setShowPanel] = useState(false);
  const [duration, setDuration] = useState("");
  const [menuMsg, setMenuMsg] = useState<{ msg: Message; x: number; y: number } | null>(null);

  const msgIdRef = useRef(0);
  const messagesRef = useRef<HTMLDivElement>(null);

  const { connected, send, serverInfo, connectedAt } = useWebSocket((msg) => {
    if (msg.type === "ack" && msg.id !== undefined) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: "sent" } : m))
      );
    }
  });

  // 更新连接时长
  useEffect(() => {
    if (!connectedAt) return;
    const timer = setInterval(() => {
      setDuration(formatDuration(Date.now() - connectedAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [connectedAt]);

  const handleSend = (text?: string, execute?: boolean) => {
    const content = (text || input).trim();
    if (!content) return;
    const id = ++msgIdRef.current;
    if (send({ type: "text", content, id, execute })) {
      setMessages((prev) => [...prev, { id, text: content, status: "sending" }]);
      const history: HistoryItem[] = JSON.parse(
        localStorage.getItem("twm_history") || "[]"
      );
      history.unshift({ text: content, time: Date.now() });
      localStorage.setItem("twm_history", JSON.stringify(history.slice(0, 20)));
      if (!text) setInput("");
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setMenuMsg(null);
  };

  const handleResend = (text: string) => {
    handleSend(text);
    setMenuMsg(null);
  };

  const handleDelete = (id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setMenuMsg(null);
  };

  const handleClearAll = () => {
    setMessages([]);
    localStorage.removeItem("twm_history");
  };

  const handleLongPress = (msg: Message, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setMenuMsg({
      msg,
      x: Math.min(rect.left, window.innerWidth - 180),
      y: rect.top - 10,
    });
  };

  useEffect(() => {
    messagesRef.current?.scrollTo(0, messagesRef.current.scrollHeight);
  }, [messages]);

  return (
    <div className="app">
      {/* Header */}
      <header className="header safe-top">
        <div className="header-content">
          <h1 className="header-title">TypeWithMobile</h1>
          <div className="header-status" onClick={() => setShowPanel(!showPanel)}>
            <span className={`dot ${connected ? "connected" : "disconnected"}`} />
            <span>{connected ? "已连接" : "连接中"}</span>
          </div>
        </div>
      </header>

      {/* 连接信息面板 */}
      <div className={`connection-panel ${showPanel ? "open" : ""}`}>
        <div className="connection-panel-content">
          <div className="connection-panel-row">
            <span className="label">服务器地址</span>
            <span className="value">{serverInfo.ip}:{serverInfo.port}</span>
          </div>
          <div className="connection-panel-row">
            <span className="label">连接状态</span>
            <span className="value" style={{ color: connected ? "#34C759" : "#FF9500" }}>
              {connected ? `已连接 ${duration}` : "未连接"}
            </span>
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="messages" ref={messagesRef}>
        {messages.length === 0 ? (
          <div className="messages-empty">
            <div className="icon">⌨️</div>
            <h3>发送文字到电脑</h3>
            <p>输入或使用语音输入文字</p>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <div
                key={m.id}
                className="message"
                onContextMenu={(e) => handleLongPress(m, e)}
                onTouchStart={(e) => {
                  const timer = setTimeout(() => handleLongPress(m, e), 500);
                  const clear = () => clearTimeout(timer);
                  e.currentTarget.addEventListener("touchend", clear, { once: true });
                  e.currentTarget.addEventListener("touchmove", clear, { once: true });
                }}
              >
                <div className={`message-bubble ${m.status === "history" ? "history" : ""}`}>
                  <p className="message-text">{m.text}</p>
                  <p className={`message-status ${m.status}`}>
                    {m.status === "sent" ? "已输入 ✓" : m.status === "history" ? "历史" : "发送中..."}
                  </p>
                </div>
              </div>
            ))}
            {messages.length > 0 && (
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <button
                  onClick={handleClearAll}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#8E8E93",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  清空历史
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 消息菜单 */}
      {menuMsg && (
        <>
          <div className="message-overlay" onClick={() => setMenuMsg(null)} />
          <div
            className="message-menu"
            style={{ left: menuMsg.x, top: menuMsg.y, transform: "translateY(-100%)" }}
          >
            <div className="message-menu-item" onClick={() => handleCopy(menuMsg.msg.text)}>
              <Icons.Copy /> 复制
            </div>
            <div className="message-menu-divider" />
            <div className="message-menu-item" onClick={() => handleResend(menuMsg.msg.text)}>
              <Icons.Refresh /> 重新发送
            </div>
            <div className="message-menu-divider" />
            <div className="message-menu-item danger" onClick={() => handleDelete(menuMsg.msg.id)}>
              <Icons.Trash /> 删除
            </div>
          </div>
        </>
      )}

      {/* 底部输入区域 */}
      <div className="bottom-area">
        <div className="input-area">
          <div className="input-area-container">
          <div className="input-area-wrapper">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入文字..."
              rows={1}
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
          </div>
          <button
            className="input-area-send"
            onClick={() => handleSend()}
            disabled={!input.trim() || !connected}
          >
            <Icons.Send />
          </button>
          <button
            className="input-area-send execute"
            onClick={() => handleSend(undefined, true)}
            disabled={!input.trim() || !connected}
            title="发送并执行"
          >
            <Icons.Enter />
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
