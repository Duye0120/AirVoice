import { useState, useEffect, useRef } from "react";
import {
  SafeArea,
  TextArea,
  Button,
  Toast,
  ActionSheet,
  Dialog,
} from "antd-mobile";
import {
  DownOutline,
  ClockCircleOutline,
  CheckCircleFill,
  CloseCircleOutline,
} from "antd-mobile-icons";
import "./App.scss";
import type { WebSocketMessage, HistoryItem } from '@shared/types';
import { useWebSocket } from './hooks/useWebSocket';

interface Message {
  id: number;
  text: string;
  status: "sending" | "sent" | "history";
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
    fetch(`/api/history`)
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
      .catch((err) => {
        console.warn('Failed to load history:', err);
      });
  }, []);

  const prevConnectedRef = useRef<boolean>(false);

  const { connected, send } = useWebSocket({
    onMessage: (msg) => {
      if (msg.type === "ack" && msg.id !== undefined) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, status: "sent" } : m))
        );
        navigator.vibrate?.(50);
      }
    }
  });

  // WebSocket 状态变化提示
  useEffect(() => {
    if (prevConnectedRef.current !== connected) {
      if (connected && prevConnectedRef.current === false) {
        Toast.show({ content: "连接成功", position: "bottom", duration: 2000 });
      } else if (!connected && prevConnectedRef.current === true) {
        Toast.show({ content: "连接断开，正在重连…", position: "bottom", duration: 2000 });
      }
      prevConnectedRef.current = connected;
    }
  }, [connected]);

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
    } catch (err) {
      console.warn('Clipboard API failed, using fallback:', err);
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch (fallbackErr) {
        console.error('Fallback copy method also failed:', fallbackErr);
        Toast.show({ content: "复制失败", position: "bottom" });
        setActionVisible(false);
        return;
      }
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

  const getStatusIcon = (status: Message["status"]) => {
    switch (status) {
      case "sent":
        return <CheckCircleFill className="status-icon success" />;
      case "history":
        return <ClockCircleOutline className="status-icon history" />;
      default:
        return <span className="status-icon sending" />;
    }
  };

  const getStatusText = (status: Message["status"]) => {
    switch (status) {
      case "sent":
        return "已输入";
      case "history":
        return "历史";
      default:
        return "发送中";
    }
  };

  return (
    <div className="app">
      {/* 顶部导航 */}
      <header className="header">
        <div className="header-content">
          <h1 className="app-title">AirVoice</h1>
          <div className={`status-badge ${connected ? 'connected' : 'connecting'}`}>
            <span className="status-dot" aria-hidden="true" />
            <span>{connected ? "已连接" : "连接中"}</span>
          </div>
        </div>
      </header>

      {/* 消息列表 */}
      <main className="message-list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="empty">
            <div className="empty-visual" aria-hidden="true">
              <div className="empty-circle">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <h2 className="empty-title">发送文字到电脑</h2>
            <p className="empty-desc">在下方输入文字，即时同步到 PC</p>
          </div>
        ) : (
          <div className="messages">
            {messages.map((m) => (
              <article
                key={m.id}
                className={`message-card ${m.status}`}
                onClick={() => handleMsgClick(m)}
              >
                <p className="message-text">{m.text}</p>
                <div className="message-meta">
                  {getStatusIcon(m.status)}
                  <span className="message-status">{getStatusText(m.status)}</span>
                </div>
              </article>
            ))}
            {messages.length > 0 && (
              <button className="clear-btn" onClick={handleClearAll}>
                <CloseCircleOutline />
                <span>清空历史</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* 底部输入区 */}
      <footer className="input-area">
        <div className="input-container">
          <TextArea
            placeholder="输入文字…"
            value={input}
            onChange={setInput}
            autoSize={{ minRows: 1, maxRows: 4 }}
            aria-label="输入要发送到电脑的文字"
          />
          <div className="send-group">
            <Button
              className="send-btn"
              disabled={!input.trim() || !connected}
              onClick={() => handleSend()}
              aria-label={`${modeLabels[sendMode]}文字到电脑`}
            >
              {modeLabels[sendMode]}
            </Button>
            <button
              className="mode-btn"
              onClick={() => setModeVisible(true)}
              aria-label="切换发送模式"
            >
              <DownOutline aria-hidden="true" />
            </button>
          </div>
        </div>
        <SafeArea position="bottom" />
      </footer>

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
