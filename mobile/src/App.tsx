import { useState, useRef, useEffect } from "react";
import "./index.css";
import type { WebSocketMessage } from '@shared/types';
import { useWebSocket } from './hooks/useWebSocket';

interface Message {
  id: number;
  text: string;
  status: "sending" | "sent" | "history" | "optimizing" | "uploading" | "failed";
  kind?: "text" | "image";
  imageId?: string;
  imageName?: string;
  time?: number;
}

interface ImagePreviewData {
  fileName: string;
  mime: string;
  size: number;
  blob: Blob;
  previewUrl: string;
  imageId?: string;
  uploadError?: string;
  uploading?: boolean;
  uploadTask?: Promise<string>;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1920;
const SUPPORTED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getUploadErrorMessage = (err: unknown) => {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return '图片上传超时，请重试';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return '图片上传失败';
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
  const [showImageSourceMenu, setShowImageSourceMenu] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [imagePreview, setImagePreview] = useState<ImagePreviewData | null>(null);

  const msgIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const footerRef = useRef<HTMLElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);

  const { connected, send } = useWebSocket({
    onMessage: (msg) => {
      if (msg.type === "ack" && msg.id !== undefined) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msg.id) return m;
            const nextText = msg.notice && !m.text.includes(msg.notice)
              ? `${m.text}（${msg.notice}）`
              : m.text;
            return { ...m, status: "sent", text: nextText };
          })
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
            text: h?.text ?? `[图片] ${h?.imageName ?? '图片'}`,
            status: "history" as const,
            kind: h?.kind ?? "text",
            imageName: h?.imageName,
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
      else if (msg.type === "error" && msg.id !== undefined) {
        const errorText = msg.error || "发送失败";
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msg.id) return m;
            return {
              ...m,
              status: "failed",
              text: m.text.includes(errorText) ? m.text : `${m.text}（${errorText}）`,
            };
          })
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
        setMessages((prev) => [...prev, { id, text: content, status: "optimizing", kind: 'text', time: Date.now() }]);
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    } else {
      if (send({ type: "text", content, id, execute })) {
        setMessages((prev) => [...prev, { id, text: content, status: "sending", kind: 'text', time: Date.now() }]);
        setInput("");
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
      }
    }
  };

  const compressImageForUpload = async (file: File): Promise<{ blob: Blob; mime: string }> => {
    if (!SUPPORTED_IMAGE_MIMES.has(file.type)) {
      throw new Error('仅支持 JPEG、PNG、WebP 图片');
    }

    if (file.size <= 1.5 * 1024 * 1024) {
      return { blob: file, mime: file.type };
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('图片读取失败'));
        img.src = objectUrl;
      });

      const maxSide = Math.max(image.width, image.height);
      const scale = maxSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / maxSide : 1;
      const targetWidth = Math.max(1, Math.round(image.width * scale));
      const targetHeight = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('图片处理失败');
      }

      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('图片压缩失败'));
            return;
          }
          resolve(blob);
        }, 'image/jpeg', 0.88);
      });

      return { blob: compressedBlob, mime: 'image/jpeg' };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const uploadImage = async (blob: Blob, mime: string, fileName: string): Promise<string> => {
    const apiBase = location.port === '8081'
      ? `${location.protocol}//${location.hostname}:23456`
      : '';

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`${apiBase}/api/images`, {
        method: 'POST',
        headers: {
          'Content-Type': mime,
          'X-Image-Name': encodeURIComponent(fileName),
        },
        body: blob,
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as { imageId?: string; error?: string };
      if (!response.ok || !payload?.imageId) {
        throw new Error(payload?.error || '图片上传失败');
      }

      return payload.imageId;
    } catch (err) {
      throw new Error(getUploadErrorMessage(err));
    } finally {
      window.clearTimeout(timer);
    }
  };

  const handleImageButtonClick = () => {
    setShowImageSourceMenu(true);
  };

  const handleTakePhoto = () => {
    setShowImageSourceMenu(false);
    cameraInputRef.current?.click();
  };

  const handlePickFromGallery = () => {
    setShowImageSourceMenu(false);
    galleryInputRef.current?.click();
  };

  const clearImagePreview = () => {
    setImagePreview((previousPreview) => {
      if (previousPreview?.previewUrl) {
        URL.revokeObjectURL(previousPreview.previewUrl);
      }
      return null;
    });
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setShowImageSourceMenu(false);
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      alert('图片不能超过 10MB');
      return;
    }

    try {
      const { blob, mime } = await compressImageForUpload(file);
      if (blob.size > MAX_IMAGE_BYTES) {
        alert('压缩后图片仍超过 10MB，请选择更小的图片');
        return;
      }

      clearImagePreview();
      const previewUrl = URL.createObjectURL(blob);
      const uploadTask = uploadImage(blob, mime, file.name || 'image');
      setImagePreview({
        fileName: file.name || 'image',
        mime,
        size: blob.size,
        blob,
        previewUrl,
        uploading: true,
        uploadTask,
      });

      uploadTask
        .then((imageId) => {
          setImagePreview((prev) => {
            if (!prev || prev.previewUrl !== previewUrl) return prev;
            return {
              ...prev,
              imageId,
              uploading: false,
              uploadError: undefined,
            };
          });
        })
        .catch((err) => {
          const message = getUploadErrorMessage(err);
          setImagePreview((prev) => {
            if (!prev || prev.previewUrl !== previewUrl) return prev;
            return {
              ...prev,
              uploading: false,
              uploadError: message,
            };
          });
        });
    } catch (err) {
      const message = err instanceof Error ? err.message : '图片处理失败';
      alert(message);
    }
  };

  const handleConfirmImage = async () => {
    if (!imagePreview) return;

    const sendId = ++msgIdRef.current;
    const execute = sendMode === 'execute';
    const pendingText = `[图片] ${imagePreview.fileName}`;
    const currentPreview = imagePreview;

    setMessages((prev) => [...prev, {
      id: sendId,
      text: pendingText,
      status: currentPreview.imageId ? 'sending' : 'uploading',
      kind: 'image',
      imageName: currentPreview.fileName,
      time: Date.now(),
    }]);

    try {
      let imageId = currentPreview.imageId;
      if (!imageId && currentPreview.uploadTask) {
        imageId = await currentPreview.uploadTask;
      }
      if (!imageId) {
        imageId = await uploadImage(currentPreview.blob, currentPreview.mime, currentPreview.fileName);
      }

      clearImagePreview();

      const sent = send({
        type: 'image',
        id: sendId,
        imageId,
        imageName: currentPreview.fileName,
        execute,
      });

      if (!sent) {
        setMessages((prev) => prev.map((item) => item.id === sendId
          ? { ...item, status: 'failed', text: `${pendingText}（连接中断）` }
          : item));
        return;
      }

      setMessages((prev) => prev.map((item) => item.id === sendId
        ? { ...item, status: 'sending', imageId }
        : item));
    } catch (err) {
      const message = getUploadErrorMessage(err);
      setMessages((prev) => prev.map((item) => item.id === sendId
        ? { ...item, status: 'failed', text: `${pendingText}（${message}）` }
        : item));
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

  const handleResend = (message: Message) => {
    const id = ++msgIdRef.current;
    if (message.kind === 'image' && !message.imageId) {
      alert('该图片已过期，请重新拍照或选择图片');
      setShowActionMenu(false);
      return;
    }

    if (message.kind === 'image' && message.imageId) {
      if (send({ type: 'image', id, imageId: message.imageId, imageName: message.imageName, execute: sendMode === 'execute' })) {
        setMessages((prev) => [...prev, {
          id,
          text: message.text,
          status: 'sending',
          kind: 'image',
          imageId: message.imageId,
          imageName: message.imageName,
          time: Date.now(),
        }]);
      }
    } else if (send({ type: "text", content: message.text, id })) {
      setMessages((prev) => [...prev, { id, text: message.text, status: "sending", kind: 'text', time: Date.now() }]);
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
    if (msg.status === 'optimizing' || msg.status === 'uploading') return;
    setSelectedMsg(msg);
    setShowActionMenu(true);
  };

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  useEffect(() => {
    const footerEl = footerRef.current;
    if (!footerEl) return;

    const updateFooterHeight = () => setFooterHeight(footerEl.offsetHeight);
    updateFooterHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(updateFooterHeight);
    resizeObserver.observe(footerEl);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview?.previewUrl) {
        URL.revokeObjectURL(imagePreview.previewUrl);
      }
    };
  }, [imagePreview]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
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
    if (status === "uploading") {
      return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
    }
    if (status === "failed") {
      return (
        <svg className="w-4 h-4 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    }
    return <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="safe-top flex-shrink-0 bg-card/80 backdrop-blur-xl border-b sticky top-0 z-50">
        <div className="flex items-center justify-between px-5 py-2">
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
      <main
        className="flex-1 overflow-y-auto px-4 py-4"
        ref={listRef}
        style={{ paddingBottom: footerHeight > 0 ? footerHeight + 32 : undefined }}
      >
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
                      className="group flex items-start gap-3 py-3 px-1 active:bg-muted/50 rounded-lg transition-colors cursor-pointer"
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
                        m.status === 'sending' || m.status === 'optimizing' || m.status === 'uploading' ? 'border-l-[3px] border-l-primary' : ''
                      } ${
                        m.status === 'failed' ? 'border-l-[3px] border-l-destructive' : ''
                      }`}
                      onClick={() => handleMsgClick(m)}
                    >
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words mb-3">{m.text}</p>
                      <div className="flex items-center gap-2">
                        <StatusIcon status={m.status} />
                        <span className="text-xs text-muted-foreground font-medium">
                          {m.status === 'sent'
                            ? '已发送'
                            : m.status === 'optimizing'
                              ? 'AI 处理中...'
                              : m.status === 'uploading'
                                ? '图片上传中...'
                                : m.status === 'failed'
                                  ? '发送失败'
                                  : '发送中'}
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
      <footer ref={footerRef} className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t safe-bottom z-50">
        <div className="flex items-center gap-1.5 p-4">
          <button
            className="h-11 w-11 flex-shrink-0 bg-muted text-muted-foreground rounded-2xl flex items-center justify-center active:bg-accent transition-colors disabled:opacity-50"
            onClick={handleImageButtonClick}
            disabled={!connected}
            aria-label="拍照或选择图片"
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-2h4l2 2h3a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageChange}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              className="block w-full h-11 min-h-11 bg-muted rounded-2xl px-4 py-2.5 text-base leading-6 font-sans placeholder:text-[15px] placeholder:text-muted-foreground resize-none overflow-y-auto outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
              placeholder="请输入文字…"
              value={input}
              onChange={handleTextareaChange}
              rows={1}
              style={{ maxHeight: '150px' }}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
          <div className="flex h-11 flex-shrink-0">
            <button
              className="h-full px-2.5 text-sm bg-primary text-primary-foreground font-semibold rounded-l-full disabled:opacity-50 active:opacity-80 transition-opacity min-w-[3.25rem]"
              disabled={!input.trim() || !connected}
              onClick={handleSend}
            >
              {sendMode === 'send' ? '发送' : '回车'}
            </button>
            <button
              className="h-full w-9 bg-muted text-muted-foreground rounded-r-full border-l flex items-center justify-center active:bg-accent transition-colors"
              onClick={() => setShowModeMenu(true)}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {/* Image Preview Panel */}
      {imagePreview && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/40" onClick={clearImagePreview} />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl safe-bottom animate-slide-up max-h-[80vh] flex flex-col">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2 flex-shrink-0" />

            <div className="px-5 pb-2 flex-shrink-0">
              <h3 className="text-lg font-semibold">确认发送图片</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {imagePreview.fileName} · {formatSize(imagePreview.size)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                部分目标应用可能不支持图片粘贴。
              </p>
              {imagePreview.uploadError ? (
                <p className="text-xs text-destructive mt-1">
                  预上传失败：{imagePreview.uploadError}
                </p>
              ) : imagePreview.uploading ? (
                <p className="text-xs text-primary mt-1">后台预上传中，确认后会自动继续发送。</p>
              ) : (
                <p className="text-xs text-success mt-1">预上传完成，确认后将快速发送。</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-4">
              <img
                src={imagePreview.previewUrl}
                alt="图片预览"
                className="w-full rounded-xl border border-border object-contain max-h-[46vh] bg-muted/20"
              />
            </div>

            <div className="p-4 flex gap-3 flex-shrink-0 border-t">
              <button className="flex-1 h-11 bg-muted font-medium rounded-xl active:opacity-80" onClick={clearImagePreview}>
                取消
              </button>
              <button className="flex-1 h-11 bg-primary text-primary-foreground font-semibold rounded-xl active:opacity-80 disabled:opacity-50" onClick={handleConfirmImage} disabled={!connected}>
                {sendMode === 'execute'
                  ? (imagePreview.uploading ? '上传中，确认并回车' : '发送并回车')
                  : (imagePreview.uploading ? '上传中，确认发送' : '发送图片')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Source Menu */}
      {showImageSourceMenu && (
        <div className="fixed inset-0 z-[100]" onClick={() => setShowImageSourceMenu(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl safe-bottom animate-slide-up">
            <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-2" />
            <div className="p-2">
              <button className="w-full p-4 text-left rounded-xl active:bg-muted" onClick={handleTakePhoto}>
                <span className="font-medium">拍照</span>
              </button>
              <button className="w-full p-4 text-left rounded-xl active:bg-muted" onClick={handlePickFromGallery}>
                <span className="font-medium">从相册选择</span>
              </button>
            </div>
            <button className="w-full p-4 text-center text-muted-foreground font-medium border-t" onClick={() => setShowImageSourceMenu(false)}>
              取消
            </button>
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
              <button className="w-full p-4 text-left rounded-xl active:bg-muted" onClick={() => handleResend(selectedMsg)}>
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
