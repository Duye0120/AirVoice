import { useState, useRef, useEffect } from "react";
import "./index.css";
import type { WebSocketMessage } from '@shared/types';
import { useWebSocket } from './hooks/useWebSocket';

interface Message {
  id: number;
  text: string;
  status: "sending" | "sent" | "history" | "optimizing";
  time?: number;
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
};

const getDateLabel = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (msgDate.getTime() === today.getTime()) {
    return "Today";
  } else if (msgDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
};

interface PreviewData {
  id: number;
  original: string;
  optimized: string;
  execute?: boolean;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sendMode, setSendMode] = useState<"send" | "execute">("send");
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewText, setPreviewText] = useState("");

  const msgIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { connected, send } = useWebSocket({
    onMessage: (msg) => {
      if (msg.type === "ack" && msg.id !== undefined) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, status: "sent" } : m))
        );
        navigator.vibrate?.(50);
      }
      else if (msg.type === "ai-config") {
        setAiEnabled(!!msg.aiEnabled);
      }
      else if (msg.type === "history" && msg.history) {
        setMessages((prev) => {
          const nonHistory = prev.filter((m) => m.status !== "history");
          const historyMsgs = msg.history!.slice(0, 10).map((h, i) => ({
            id: -i - 1,
            text: h.text,
            status: "history" as const,
            time: h.time,
          }));
          return [...historyMsgs, ...nonHistory];
        });
      }
      else if (msg.type === "optimized" && msg.id !== undefined) {
        setPreview({
          id: msg.id,
          original: msg.original || "",
          optimized: msg.optimized || "",
          execute: msg.execute
        });
        setPreviewText(msg.optimized || "");
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, status: "sent" } : m))
        );
      }
    }
  });

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    const id = ++msgIdRef.current;
    const execute = sendMode === "execute";
    
    if (aiEnabled) {
      if (send({ type: "optimize", content, id, execute })) {
        setMessages((prev) => [...prev, { id, text: content, status: "optimizing", time: Date.now() }]);
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    } else {
      if (send({ type: "text", content, id, execute })) {
        setMessages((prev) => [...prev, { id, text: content, status: "sending", time: Date.now() }]);
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleConfirmPreview = () => {
    if (!preview) return;
    send({ type: "confirm", content: previewText, id: preview.id, execute: preview.execute });
    setMessages((prev) =>
      prev.map((m) => (m.id === preview.id ? { ...m, text: previewText, status: "sending" } : m))
    );
    setPreview(null);
  };

  const handleUseOriginal = () => {
    if (!preview) return;
    send({ type: "confirm", content: preview.original, id: preview.id, execute: preview.execute });
    setMessages((prev) =>
      prev.map((m) => (m.id === preview.id ? { ...m, text: preview.original, status: "sending" } : m))
    );
    setPreview(null);
  };

  const handleCancelPreview = () => {
    if (!preview) return;
    setMessages((prev) => prev.filter((m) => m.id !== preview.id));
    setPreview(null);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setShowActionMenu(false);
  };

  const handleResend = (text: string) => {
    const id = ++msgIdRef.current;
    if (send({ type: "text", content: text, id })) {
      setMessages((prev) => [...prev, { id, text, status: "sending", time: Date.now() }]);
    }
    setShowActionMenu(false);
  };

  const handleDelete = (id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setShowActionMenu(false);
  };

  const handleClearAll = () => {
    if (confirm("确定清空所有消息？")) {
      send({ type: "clear-history" });
      setMessages([]);
    }
  };

  const handleMsgClick = (msg: Message) => {
    if (msg.status === 'optimizing') return;
    setSelectedMsg(msg);
    setShowActionMenu(true);
  };

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 300) + 'px';
  };

  const StatusIcon = ({ status }: { status: Message["status"] }) => {
    if (status === "sent") {
      return (
        <svg className="w-4 h-4 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    if (status === "history") {
      return (
        <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
      );
    }
    if (status === "optimizing") {
      return (
        <svg className="w-4 h-4 text-primary animate-pulse-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/>
        </svg>
      );
    }
    return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="safe-top flex-shrink-0 bg-card/80 backdrop-blur-xl border-b sticky top-0 z-50">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">AirVoice</h1>
            {aiEnabled && (
              <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">AI</span>
            )}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            connected ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
          }`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-warning animate-pulse-slow'}`} />
            <span>{connected ? "已连接" : "连接中"}</span>
          </div>
        </div>
      </header>

      {/* Message List */}
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-36" ref={listRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">发送文字到电脑</h2>
            <p className="text-muted-foreground text-sm">
              {aiEnabled ? "AI 会自动优化你的文字" : "在下方输入，即时同步"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((m, index) => {
              const dateLabel = getDateLabel(m.time || Date.now());
              const prevM = messages[index - 1];
              const prevDateLabel = prevM ? getDateLabel(prevM.time || Date.now()) : null;
              const showHeader = dateLabel !== prevDateLabel;

              return (
                <div key={m.id} className="w-full">
                  {showHeader && (
                    <div className="relative flex items-center justify-center py-4 mt-2 mb-2">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border/40"></div>
                      </div>
                      <span className="relative bg-background px-3 text-xs font-medium text-muted-foreground">
                        {dateLabel}
                      </span>
                    </div>
                  )}

                  {m.status === 'history' ? (
                    <div 
                      className="group flex items-start gap-3 py-2 px-1 active:bg-muted/50 rounded-lg transition-colors cursor-pointer"
                      onClick={() => handleMsgClick(m)}
                    >
                      <span className="text-xs font-medium text-muted-foreground/60 w-[4.5rem] flex-shrink-0 text-right tabular-nums pt-1">
                        {m.time ? formatTime(m.time) : ''}
                      </span>
                      <p className="text-[15px] text-foreground/90 leading-relaxed whitespace-pre-wrap break-words flex-1 pt-[2px]">
                        {m.text}
                      </p>
                    </div>
                  ) : (
                    <div
                      className={`bg-card rounded-2xl p-4 border cursor-pointer active:scale-[0.98] transition-transform mb-3 ${
                        m.status === 'sent' ? 'border-l-[3px] border-l-success' : ''
                      } ${
                        m.status === 'sending' || m.status === 'optimizing' ? 'border-l-[3px] border-l-primary' : ''
                      }`}
                      onClick={() => handleMsgClick(m)}
                    >
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words mb-3">{m.text}</p>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={m.status} />
                        <span className="text-xs text-muted-foreground font-medium">
                          {m.status === 'sent' ? '已发送' : m.status === 'optimizing' ? 'AI 处理中...' : '发送中'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            
            {messages.length > 0 && (
              <button
                className="w-full py-3 mt-4 text-sm text-muted-foreground border border-dashed rounded-xl flex items-center justify-center gap-2 active:bg-muted transition-colors"
                onClick={handleClearAll}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
                </svg>
                清空历史
              </button>
            )}
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t safe-bottom z-50">
        <div className="flex items-end gap-2 p-4">
          <textarea
            ref={textareaRef}
            className="flex-1 bg-muted rounded-2xl px-6 py-4 text-[17px] font-sans placeholder:text-muted-foreground resize-none outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
            placeholder={aiEnabled ? "输入文字，AI 会优化..." : "输入文字..."}
            value={input}
            onChange={handleTextareaChange}
            rows={7}
            style={{ maxHeight: '300px', minHeight: '140px' }}
          />
          <div className="flex flex-shrink-0">
            <button
              className="h-14 px-5 bg-primary text-primary-foreground font-semibold rounded-l-full disabled:opacity-50 active:opacity-80 transition-opacity"
              disabled={!input.trim() || !connected}
              onClick={handleSend}
            >
              {sendMode === 'send' ? '发送' : '回车'}
            </button>
            <button
              className="h-14 w-10 bg-muted text-muted-foreground rounded-r-full border-l flex items-center justify-center active:bg-accent transition-colors"
              onClick={() => setShowModeMenu(true)}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
          </div>
        </div>
      </footer>

      {/* AI Preview Panel */}
      {preview && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/40" onClick={handleCancelPreview} />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl safe-bottom animate-slide-up max-h-[80vh] flex flex-col">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />
            
            <div className="px-5 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"/>
                </svg>
                <h3 className="text-lg font-semibold">AI 已优化</h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5">
              <textarea
                className="w-full bg-muted rounded-xl px-5 py-4 text-[17px] font-sans resize-none outline-none focus:ring-2 focus:ring-ring/30 min-h-[120px]"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                rows={4}
              />
              
              {preview.original !== preview.optimized && (
                <details className="mt-3">
                  <summary className="text-sm text-muted-foreground cursor-pointer">查看原文</summary>
                  <p className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">
                    {preview.original}
                  </p>
                </details>
              )}
            </div>

            <div className="p-4 flex gap-3 flex-shrink-0 border-t">
              <button className="flex-1 h-11 bg-muted font-medium rounded-xl active:opacity-80" onClick={handleUseOriginal}>
                使用原文
              </button>
              <button className="flex-1 h-11 bg-primary text-primary-foreground font-semibold rounded-xl active:opacity-80" onClick={handleConfirmPreview}>
                确认发送
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode Menu */}
      {showModeMenu && (
        <div className="fixed inset-0 z-[100]" onClick={() => setShowModeMenu(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl safe-bottom animate-slide-up">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2" />
            <div className="p-2">
              <button className={`w-full p-4 text-left rounded-xl ${sendMode === 'send' ? 'bg-muted' : ''}`}
                onClick={() => { setSendMode('send'); setShowModeMenu(false); }}>
                <span className="font-medium">发送</span>
              </button>
              <button className={`w-full p-4 text-left rounded-xl ${sendMode === 'execute' ? 'bg-muted' : ''}`}
                onClick={() => { setSendMode('execute'); setShowModeMenu(false); }}>
                <span className="font-medium">发送并回车</span>
              </button>
            </div>
            <button className="w-full p-4 text-center text-muted-foreground font-medium border-t" onClick={() => setShowModeMenu(false)}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* Action Menu */}
      {showActionMenu && selectedMsg && (
        <div className="fixed inset-0 z-[100]" onClick={() => setShowActionMenu(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl safe-bottom animate-slide-up">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2" />
            <div className="p-2">
              <button className="w-full p-4 text-left rounded-xl active:bg-muted" onClick={() => handleCopy(selectedMsg.text)}>
                <span className="font-medium">复制</span>
              </button>
              <button className="w-full p-4 text-left rounded-xl active:bg-muted" onClick={() => handleResend(selectedMsg.text)}>
                <span className="font-medium">重新发送</span>
              </button>
              <button className="w-full p-4 text-left rounded-xl active:bg-muted" onClick={() => handleDelete(selectedMsg.id)}>
                <span className="font-medium text-destructive">删除</span>
              </button>
            </div>
            <button className="w-full p-4 text-center text-muted-foreground font-medium border-t" onClick={() => setShowActionMenu(false)}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
