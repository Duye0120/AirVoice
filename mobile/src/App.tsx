import { useState, useEffect, useRef, useCallback } from "react";
import {
  NavBar,
  SafeArea,
  TextArea,
  Button,
  Toast,
  List,
  Tag,
  ActionSheet,
  Dialog,
} from "antd-mobile";
import {
  SendOutline,
  DownOutline,
} from "antd-mobile-icons";
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
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);

  useEffect(() => {
    const connect = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      if (wsRef.current) wsRef.current.close();

      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${location.host}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setTokenInvalid(false);
      };
      ws.onclose = (e) => {
        setConnected(false);
        if (e.code === 1008) {
          setTokenInvalid(true);
          return;
        }
        reconnectTimer.current = window.setTimeout(connect, 1000);
      };
      ws.onmessage = (e) => {
        try {
          onMessage(JSON.parse(e.data));
        } catch {}
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

  return { connected, send, tokenInvalid };
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [actionVisible, setActionVisible] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [sendMode, setSendMode] = useState<"send" | "execute">("send");
  const [modeVisible, setModeVisible] = useState(false);

  const modeLabels = { send: "发送", execute: "回车" };

  const msgIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  // 加载历史记录
  useEffect(() => {
    fetch(`/api/history?token=${token}`)
      .then((r) => r.json())
      .then((history: HistoryItem[]) => {
        setMessages(
          history.slice(0, 10).map((h, i) => ({
            id: -i - 1,
            text: h.text,
            status: "history" as const,
          }))
        );
      })
      .catch(() => {});
  }, []);

  const { connected, send, tokenInvalid } = useWebSocket((msg) => {
    if (msg.type === "ack" && msg.id !== undefined) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: "sent" } : m))
      );
      navigator.vibrate?.(50);
    }
  });

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    const id = ++msgIdRef.current;
    const execute = sendMode === "execute";
    if (send({ type: "text", content, id, execute })) {
      setMessages((prev) => [...prev, { id, text: content, status: "sending" }]);
      setInput("");
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    Toast.show({ content: "已复制", position: "bottom" });
    setActionVisible(false);
  };

  const handleResend = (text: string) => {
    const id = ++msgIdRef.current;
    if (send({ type: "text", content: text, id })) {
      setMessages((prev) => [...prev, { id, text, status: "sending" }]);
    }
    setActionVisible(false);
  };

  const handleDelete = (id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setActionVisible(false);
  };

  const handleClearAll = () => {
    Dialog.confirm({
      content: "确定清空所有消息？",
      onConfirm: () => setMessages([]),
    });
  };

  const handleMsgClick = (msg: Message) => {
    setSelectedMsg(msg);
    setActionVisible(true);
  };

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const statusText = tokenInvalid ? "请重新扫码" : connected ? "已连接" : "连接中...";
  const statusColor = connected ? "#52c41a" : "#faad14";

  return (
    <div className="app">
      <NavBar
        backIcon={null}
        right={
          <Tag color={connected ? "success" : "warning"} fill="outline">
            {statusText}
          </Tag>
        }
      >
        TypeWithMobile
      </NavBar>

      <div className="message-list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">⌨️</div>
            <div className="empty-title">发送文字到电脑</div>
            <div className="empty-desc">输入或使用语音输入文字</div>
          </div>
        ) : (
          <List>
            {messages.map((m) => (
              <List.Item
                key={m.id}
                onClick={() => handleMsgClick(m)}
                description={
                  <span style={{ color: m.status === "sent" ? statusColor : "#999" }}>
                    {m.status === "sent" ? "已输入 ✓" : m.status === "history" ? "历史" : "发送中..."}
                  </span>
                }
                className={m.status === "history" ? "history-item" : ""}
              >
                {m.text}
              </List.Item>
            ))}
            {messages.length > 0 && (
              <List.Item onClick={handleClearAll}>
                <span style={{ color: "#999", fontSize: 14 }}>清空历史</span>
              </List.Item>
            )}
          </List>
        )}
      </div>

      <div className="input-area">
        <div className="input-row">
          <TextArea
            placeholder="输入文字..."
            value={input}
            onChange={setInput}
            autoSize={{ minRows: 1, maxRows: 4 }}
            onEnterPress={() => handleSend()}
          />
          <div className="mode-trigger" onClick={() => setModeVisible(true)}>
            {modeLabels[sendMode]} <DownOutline />
          </div>
          <Button
            color="primary"
            disabled={!input.trim() || !connected}
            onClick={() => handleSend()}
          >
            <SendOutline />
          </Button>
        </div>
        <SafeArea position="bottom" />
      </div>

      <ActionSheet
        visible={modeVisible}
        actions={[
          { text: "发送", key: "send", onClick: () => { setSendMode("send"); setModeVisible(false); } },
          { text: "发送并回车", key: "execute", onClick: () => { setSendMode("execute"); setModeVisible(false); } },
        ]}
        onClose={() => setModeVisible(false)}
      />

      <ActionSheet
        visible={actionVisible}
        actions={[
          { text: "复制", key: "copy", onClick: () => selectedMsg && handleCopy(selectedMsg.text) },
          { text: "重新发送", key: "resend", onClick: () => selectedMsg && handleResend(selectedMsg.text) },
          { text: "删除", key: "delete", danger: true, onClick: () => selectedMsg && handleDelete(selectedMsg.id) },
        ]}
        onClose={() => setActionVisible(false)}
      />
    </div>
  );
}
