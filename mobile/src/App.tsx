import { useState, useEffect, useRef } from "react";
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
        Toast.show({ content: "连接断开，正在重连...", position: "bottom", duration: 2000 });
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

  const statusText = connected ? "已连接" : "连接中...";
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
        AirVoice
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
          />
          <div className="send-button-group">
            <Button
              className="send-btn"
              color="primary"
              disabled={!input.trim() || !connected}
              onClick={() => handleSend()}
            >
              {modeLabels[sendMode]}
            </Button>
            <Button
              className="mode-btn"
              color="primary"
              fill="outline"
              onClick={() => setModeVisible(true)}
            >
              <DownOutline />
            </Button>
          </div>
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
