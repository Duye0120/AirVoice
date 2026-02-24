import { useState, useEffect, useRef, type ReactNode } from 'react';
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type AppendMessage,
} from '@assistant-ui/react';

interface AgentStepInfo {
  type: 'tool-call' | 'tool-result' | 'text';
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  text?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  steps?: AgentStepInfo[];
  streaming?: boolean;
}

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function convertMessage(msg: ChatMessage): ThreadMessageLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];
  
  const cleanContent = stripThinkTags(msg.content);
  if (cleanContent) {
    content.push({ type: 'text', text: cleanContent });
  }
  
  if (msg.steps) {
    const resultMap = new Map<string, unknown>();
    for (const step of msg.steps) {
      if (step.type === 'tool-result' && step.toolName) {
        resultMap.set(step.toolName, step.result);
      }
    }
    for (const step of msg.steps) {
      if (step.type === 'tool-call' && step.toolName) {
        const toolCallId = `${msg.id}-${step.toolName}`;
        content.push({
          type: 'tool-call',
          toolCallId,
          toolName: step.toolName,
          args: step.args ?? {},
          result: resultMap.get(step.toolName),
        });
      }
    }
  }
  
  if (content.length === 0) {
    content.push({ type: 'text', text: msg.streaming ? '' : '(empty response)' });
  }

  // Build the full object at once to avoid readonly assignment issues
  if (msg.role === 'assistant') {
    return {
      role: msg.role,
      content,
      id: msg.id,
      status: msg.streaming
        ? { type: 'running' as const }
        : { type: 'complete' as const, reason: 'stop' as const },
    };
  }

  return {
    role: msg.role,
    content,
    id: msg.id,
  };
}

interface AirVoiceRuntimeProviderProps {
  children: ReactNode;
  sessionId: string | null;
  onSessionChange?: (sessionId: string) => void;
}

export function AirVoiceRuntimeProvider({ children, sessionId, onSessionChange }: AirVoiceRuntimeProviderProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  const onNewRef = useRef<((message: AppendMessage) => Promise<void>) | null>(null);

  // When sessionId changes externally, reload that session's messages
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    const load = async () => {
      try {
        const session = await window.electronAPI.getChatSession(sessionId);
        if (session) {
          setMessages(session.messages);
        } else {
          setMessages([]);
        }
      } catch (e) {
        console.error('Failed to load session:', e);
        setMessages([]);
      }
    };
    load();
  }, [sessionId]);

  useEffect(() => {
    const cleanups = [
      window.electronAPI.onChatDelta(({ chatId, delta }) => {
        setMessages(prev => prev.map(m => 
          m.id === chatId ? { ...m, content: m.content + delta } : m
        ));
      }),
      window.electronAPI.onChatToolCall(({ chatId, toolName, args }) => {
        setMessages(prev => prev.map(m => {
          if (m.id !== chatId) return m;
          const steps = [...(m.steps || []), { type: 'tool-call' as const, toolName, args }];
          return { ...m, steps };
        }));
      }),
      window.electronAPI.onChatToolResult(({ chatId, toolName, result }) => {
        setMessages(prev => prev.map(m => {
          if (m.id !== chatId) return m;
          const steps = [...(m.steps || []), { type: 'tool-result' as const, toolName, result }];
          return { ...m, steps };
        }));
      }),
      window.electronAPI.onChatDone(({ chatId, content, steps }) => {
        setMessages(prev => prev.map(m =>
          m.id === chatId ? { ...m, content, steps: steps as AgentStepInfo[], streaming: false } : m
        ));
        setIsRunning(false);
      }),
      window.electronAPI.onChatError(({ chatId, error }) => {
        setMessages(prev => prev.map(m =>
          m.id === chatId ? { ...m, content: `错误: ${error}`, streaming: false } : m
        ));
        setIsRunning(false);
      }),
      window.electronAPI.onChatInputFromMobile((content) => {
        if (onNewRef.current) {
          onNewRef.current({
            parentId: null,
            role: 'user',
            content: [{ type: 'text', text: content }],
          } as unknown as AppendMessage);
        }
      }),
    ];
    return () => cleanups.forEach(fn => fn());
  }, []);

  const onNew = async (message: AppendMessage) => {
    const textPart = message.content.find(p => p.type === 'text');
    if (!textPart || textPart.type !== 'text') return;
    
    const userContent = textPart.text;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsRunning(true);
    
    try {
      const { chatId, sessionId: newSessionId } = await window.electronAPI.sendChatMessage(userContent, sessionId ?? undefined);
      
      // Notify parent if session changed (new session created)
      if (onSessionChange && newSessionId !== sessionId) {
        onSessionChange(newSessionId);
      }
      
      setMessages(prev => [...prev, {
        id: chatId,
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now(),
        streaming: true,
      }]);
    } catch (err) {
      console.error('Failed to send:', err);
      setIsRunning(false);
    }
  };
  
  onNewRef.current = onNew;

  const runtime = useExternalStoreRuntime({
    isRunning,
    messages,
    convertMessage,
    onNew,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
