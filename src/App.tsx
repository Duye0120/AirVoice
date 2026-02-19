import { useState, useEffect, useRef } from 'react';
import { Sparkles, Minus, X, Bot, MessageSquare, Settings as SettingsIcon, Smartphone, Send, Loader2, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Type definitions (redefined for safety)
type AIProvider = 'openai' | 'anthropic' | 'google';
type OptimizeMode = 'off' | 'auto' | 'manual' | 'agent';

interface ProviderConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
}

interface AIConfig {
  provider: AIProvider;
  optimizeMode: OptimizeMode;
  providers: {
    openai: ProviderConfig;
    anthropic: ProviderConfig;
    google: ProviderConfig;
  };
}

interface RolePrompt {
  id: string;
  name: string;
  prompt: string;
  builtIn?: boolean;
}

interface RoleConfig {
  activeRoleId: string;
  roles: RolePrompt[];
}

interface ImageSettings {
  cacheDir: string;
  cleanupIntervalMinutes: number;
  fallbackToPathWhenPasteFails: boolean;
}

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

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const PROVIDER_OPTIONS = [
  {
    id: 'openai' as AIProvider,
    name: 'OpenAI',
    icon: '⚡️',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
    defaultURL: 'https://api.openai.com/v1'
  },
  {
    id: 'anthropic' as AIProvider,
    name: 'Claude',
    icon: '🧠',
    models: ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest', 'claude-3-opus-latest'],
    defaultURL: 'https://api.anthropic.com'
  },
  {
    id: 'google' as AIProvider,
    name: 'Gemini',
    icon: '✨',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
    defaultURL: 'https://generativelanguage.googleapis.com'
  }
];

const IMAGE_CLEANUP_OPTIONS = [
  { value: 0, label: '不自动清理' },
  { value: 10, label: '10 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 60, label: '1 小时' },
  { value: 360, label: '6 小时' },
  { value: 1440, label: '24 小时' },
];

type Page = 'chat' | 'settings' | 'mobile';

const ChatBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}`}>
      <div className={message.streaming ? 'chat-streaming-cursor' : ''}>
        {message.content}
      </div>
      
      {message.role === 'assistant' && message.steps && message.steps.length > 0 && (
        <details className="chat-tool-steps text-muted-foreground cursor-pointer">
          <summary className="hover:text-foreground transition-colors flex items-center gap-1 select-none">
            <ChevronRight className="w-3 h-3 transition-transform" />
            Agent 步骤 ({message.steps.length})
          </summary>
          <div className="pl-4 mt-2 space-y-2 border-l-2 border-muted">
            {message.steps.map((step, idx) => (
              <div key={idx} className="text-xs font-mono">
                {step.type === 'tool-call' && (
                  <div>
                    <span className="text-blue-500">🔧 {step.toolName}</span>
                    <pre className="mt-1 bg-background/50 p-1 rounded overflow-x-auto">
                      {JSON.stringify(step.args, null, 2)}
                    </pre>
                  </div>
                )}
                {step.type === 'tool-result' && (
                  <div className="text-green-600 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>完成</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default function App() {
  const [activePage, setActivePage] = useState<Page>('chat');
  const [connected, setConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState({ ip: '--', port: 0 });
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const chatListRef = useRef<HTMLDivElement>(null);

  // AI & Config State
  const [config, setConfig] = useState<AIConfig>({ 
    provider: 'openai', 
    optimizeMode: 'off',
    providers: {
      openai: { apiKey: '', model: 'gpt-4o-mini', baseURL: '' },
      anthropic: { apiKey: '', model: 'claude-3-5-haiku-latest', baseURL: '' },
      google: { apiKey: '', model: 'gemini-1.5-flash', baseURL: '' }
    }
  });
  const [roles, setRoles] = useState<RolePrompt[]>([]);
  const [activeRoleId, setActiveRoleId] = useState('');
  const [roleDraft, setRoleDraft] = useState('');
  const [addingRole, setAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
  const [imageSettings, setImageSettings] = useState<ImageSettings>({
    cacheDir: '',
    cleanupIntervalMinutes: 60,
    fallbackToPathWhenPasteFails: true,
  });
  const [savingImageSettings, setSavingImageSettings] = useState(false);
  const [imageSettingsSaveStatus, setImageSettingsSaveStatus] = useState<'idle' | 'success'>('idle');

  // Initialization
  useEffect(() => {
    const init = async () => {
      try {
        const info = await window.electronAPI.getServerInfo();
        setServerInfo({ ip: info.ip, port: info.port });
        const url = `http://${info.ip}:${info.port}`;
        const qrDataUrl = await window.electronAPI.generateQRCode(url);
        setQrCode(qrDataUrl);
        
        const aiConfig = await window.electronAPI.getAIConfig() as unknown as AIConfig;
        setConfig(prev => ({
          ...prev,
          ...aiConfig,
          providers: {
            ...prev.providers,
            ...(aiConfig.providers || {})
          }
        }));

        const roleConfig = await window.electronAPI.getRoleConfig() as unknown as RoleConfig;
        setRoles(roleConfig.roles || []);
        setActiveRoleId(roleConfig.activeRoleId || '');
        const active = roleConfig.roles?.find(role => role.id === roleConfig.activeRoleId);
        setRoleDraft(active?.prompt || '');
        
        const imageConfig = await window.electronAPI.getImageSettings() as ImageSettings;
        setImageSettings({
          cacheDir: imageConfig?.cacheDir || '',
          cleanupIntervalMinutes: imageConfig?.cleanupIntervalMinutes ?? 60,
          fallbackToPathWhenPasteFails: imageConfig?.fallbackToPathWhenPasteFails ?? true,
        });

        // Load Chat Sessions
        const sessions = await window.electronAPI.getChatSessions();
        setChatSessions(sessions);
        if (sessions.length > 0) {
          const latest = sessions[0];
          setCurrentSessionId(latest.id);
          const session = await window.electronAPI.getChatSession(latest.id);
          if (session) setChatMessages(session.messages);
        }
      } catch (e) {
        console.error('Failed to init:', e);
      }
    };

    const cleanupConnection = window.electronAPI.onConnectionStatus((status) => {
      setConnected(status);
    });

    const cleanupIP = window.electronAPI.onIPChanged((data) => {
      setServerInfo({ ip: data.ip, port: data.port });
      setQrCode(data.qrCode);
    });

    init();
    return () => {
      cleanupConnection();
      cleanupIP();
    };
  }, []);

  // Chat Event Listeners
  useEffect(() => {
    const cleanups = [
      window.electronAPI.onChatDelta(({ chatId, delta }) => {
        setChatMessages(prev => prev.map(m => 
          m.id === chatId ? { ...m, content: m.content + delta } : m
        ));
      }),
      window.electronAPI.onChatToolCall(({ chatId, toolName, args }) => {
        setChatMessages(prev => prev.map(m => {
          if (m.id !== chatId) return m;
          const steps = [...(m.steps || []), { type: 'tool-call' as const, toolName, args }];
          return { ...m, steps };
        }));
      }),
      window.electronAPI.onChatToolResult(({ chatId, toolName, result }) => {
        setChatMessages(prev => prev.map(m => {
          if (m.id !== chatId) return m;
          const steps = [...(m.steps || []), { type: 'tool-result' as const, toolName, result }];
          return { ...m, steps };
        }));
      }),
      window.electronAPI.onChatDone(({ chatId, content, steps }) => {
        setChatMessages(prev => prev.map(m => 
          m.id === chatId ? { ...m, content, steps, streaming: false } : m
        ));
        setChatSending(false); // Ensure sending state is cleared
      }),
      window.electronAPI.onChatError(({ chatId, error }) => {
        setChatMessages(prev => prev.map(m => 
          m.id === chatId ? { ...m, content: `错误: ${error}`, streaming: false } : m
        ));
        setChatSending(false);
      }),
    ];
    return () => cleanups.forEach(fn => fn());
  }, []);

  // Scroll Chat to Bottom
  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.electronAPI.saveAIConfig(config);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error('Failed to save config:', e);
    }
    setSaving(false);
  };

  const handleSaveImageSettings = async () => {
    setSavingImageSettings(true);
    try {
      const saved = await window.electronAPI.saveImageSettings(imageSettings);
      setImageSettings({
        cacheDir: saved?.cacheDir || imageSettings.cacheDir,
        cleanupIntervalMinutes: saved?.cleanupIntervalMinutes ?? imageSettings.cleanupIntervalMinutes,
        fallbackToPathWhenPasteFails: saved?.fallbackToPathWhenPasteFails ?? imageSettings.fallbackToPathWhenPasteFails,
      });
      setImageSettingsSaveStatus('success');
      setTimeout(() => setImageSettingsSaveStatus('idle'), 2000);
    } catch (e) {
      console.error('Failed to save image settings:', e);
    }
    setSavingImageSettings(false);
  };

  const handlePickImageCacheDir = async () => {
    try {
      const selected = await window.electronAPI.pickImageCacheDir();
      if (!selected) return;
      setImageSettings((prev) => ({ ...prev, cacheDir: selected }));
    } catch (e) {
      console.error('Failed to pick image cache directory:', e);
    }
  };

  const updateProviderConfig = (provider: AIProvider, field: keyof ProviderConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [provider]: {
          ...prev.providers[provider],
          [field]: value
        }
      }
    }));
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || chatSending) return;
    const content = chatInput.trim();
    setChatInput('');
    setChatSending(true);
    
    try {
      const { chatId, sessionId } = await window.electronAPI.sendChatMessage(content, currentSessionId || undefined);
      setCurrentSessionId(sessionId);
      
      setChatMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
      }]);
      
      setChatMessages(prev => [...prev, {
        id: chatId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        streaming: true,
      }]);
    } catch (err) {
      console.error('Chat send failed:', err);
      setChatSending(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  const currentProvider = PROVIDER_OPTIONS.find(p => p.id === config.provider)!;
  const currentProviderConfig = config.providers[config.provider];
  const aiEnabled = config.optimizeMode !== 'off';

  return (
    <div className="desktop-root h-screen flex flex-col">
      {/* Titlebar */}
      <div className="titlebar">
        <span className="titlebar-title">AirVoice Agent</span>
        <div className="window-controls">
          <button
            className="control-btn"
            onClick={() => window.electronAPI.windowMinimize()}
            aria-label="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            className="control-btn close"
            onClick={() => window.electronAPI.windowClose()}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="app-layout">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="brand-badge">A</div>
            <div>
              <div className="sidebar-brand-title">AirVoice</div>
              <div className="sidebar-brand-subtitle">Desktop Console</div>
            </div>
          </div>
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activePage === 'chat' ? 'active' : ''}`}
              onClick={() => setActivePage('chat')}
            >
              <MessageSquare className="nav-icon" />
              <span>Chat</span>
            </button>
            <button
              className={`nav-item ${activePage === 'settings' ? 'active' : ''}`}
              onClick={() => setActivePage('settings')}
            >
              <SettingsIcon className="nav-icon" />
              <span>设置</span>
            </button>
            <button
              className={`nav-item ${activePage === 'mobile' ? 'active' : ''}`}
              onClick={() => setActivePage('mobile')}
            >
              <Smartphone className="nav-icon" />
              <span>手机连接</span>
            </button>
          </nav>
        </div>

        {/* Content */}
        <main className="main-content flex flex-col h-full">
          {activePage === 'chat' && (
            <div className="chat-page h-full">
              <div className="chat-messages" ref={chatListRef}>
                {chatMessages.length === 0 ? (
                  <div className="chat-empty">
                    <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                    <p>开始对话</p>
                  </div>
                ) : (
                  chatMessages.map(msg => <ChatBubble key={msg.id} message={msg} />)
                )}
              </div>
              
              <div className="chat-input-area">
                <Textarea 
                  value={chatInput} 
                  onChange={(e) => setChatInput(e.target.value)} 
                  onKeyDown={handleChatKeyDown} 
                  placeholder="输入消息..." 
                />
                <Button onClick={handleChatSend} disabled={chatSending || !chatInput.trim()}>
                  {chatSending ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
              </div>
            </div>
          )}

          {activePage === 'settings' && (
            <div className="page-shell space-y-6">
              <h1 className="page-title">设置</h1>

              {/* AI Config Section */}
              <div className="settings-section">
                <div className="section-header">
                  <Sparkles className="section-icon" />
                  <span>AI 配置</span>
                </div>

                <div className="settings-row">
                  <div className="settings-label">
                    <span className="settings-label-title">优化模式</span>
                    <span className="settings-label-desc">自动优化语音输入的文字</span>
                  </div>
                  <Select
                    value={config.optimizeMode}
                    onValueChange={(v) => setConfig({ ...config, optimizeMode: v as OptimizeMode })}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="off">关闭</SelectItem>
                      <SelectItem value="auto">自动</SelectItem>
                      <SelectItem value="manual">手动</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="providers-grid mt-4">
                  {PROVIDER_OPTIONS.map(p => (
                    <div
                      key={p.id}
                      className={`provider-card ${config.provider === p.id ? 'active' : ''}`}
                      onClick={() => setConfig({ ...config, provider: p.id })}
                    >
                      <div className="provider-icon">{p.icon}</div>
                      <div className="provider-name">{p.name}</div>
                      <div className="provider-status">
                        {config.provider === p.id ? '已选择' : '点击选择'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 mt-4">
                  <div className="form-group">
                    <Label className="form-label">API Key</Label>
                    <Input
                      type="password"
                      value={currentProviderConfig.apiKey}
                      onChange={(e) => updateProviderConfig(config.provider, 'apiKey', e.target.value)}
                      placeholder="输入 API Key"
                    />
                  </div>

                  <div className="form-group">
                    <Label className="form-label">Base URL（可选）</Label>
                    <Input
                      value={currentProviderConfig.baseURL || ''}
                      onChange={(e) => updateProviderConfig(config.provider, 'baseURL', e.target.value)}
                      placeholder={currentProvider.defaultURL}
                    />
                  </div>

                  <div className="form-group">
                    <Label className="form-label">模型</Label>
                    <Input
                      value={currentProviderConfig.model}
                      onChange={(e) => updateProviderConfig(config.provider, 'model', e.target.value)}
                      placeholder="模型名称"
                      list={`models-${config.provider}`}
                    />
                    <datalist id={`models-${config.provider}`}>
                      {currentProvider.models.map(m => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </div>
                  
                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saveStatus === 'success' ? '已保存' : saving ? '保存中...' : '保存 AI 设置'}
                  </Button>
                </div>
              </div>

              {/* Role Config Section */}
              <div className="settings-section">
                <div className="section-header">
                  <Bot className="section-icon" />
                  <span>角色设定</span>
                </div>

                <div className="px-4 pb-4 pt-2 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">当前角色</Label>
                    <Select
                      value={activeRoleId}
                      onValueChange={(value) => {
                        setActiveRoleId(value);
                        const selected = roles.find((role) => role.id === value);
                        setRoleDraft(selected?.prompt || '');
                        window.electronAPI.saveRoleConfig({ activeRoleId: value });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择角色" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {addingRole ? (
                    <div className="flex items-center gap-2 p-1 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Input
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        placeholder="新角色名称"
                        className="h-10 text-base font-sans flex-1"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-10 px-4"
                        onClick={() => {
                          const name = newRoleName.trim();
                          if (!name) return;
                          const id = `custom-${Date.now()}`;
                          const newRole: RolePrompt = { id, name, prompt: roleDraft || '' };
                          const nextRoles = [...roles, newRole];
                          setRoles(nextRoles);
                          setActiveRoleId(id);
                          setNewRoleName('');
                          setAddingRole(false);
                          window.electronAPI.saveRoleConfig({ activeRoleId: id, roles: nextRoles });
                        }}
                      >
                        保存
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 w-10 p-0"
                        onClick={() => {
                          setAddingRole(false);
                          setNewRoleName('');
                        }}
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-8 text-xs border-dashed text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => setAddingRole(true)}
                    >
                      + 新增角色
                    </Button>
                  )}

                  <div className="space-y-3 pt-2 border-t border-border/40">
                    <Label className="text-xs font-medium text-muted-foreground">
                      提示词 (System Prompt)
                    </Label>
                    <Textarea
                      value={roleDraft}
                      onChange={(e) => setRoleDraft(e.target.value)}
                      placeholder="输入角色的详细设定和指令..."
                      className="min-h-[200px] font-sans text-base leading-relaxed resize-none bg-muted/20 focus:bg-background transition-all"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground opacity-70">
                        {roleDraft.length} 字符
                      </span>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!activeRoleId) return;
                          const nextRoles = roles.map((role) => (
                            role.id === activeRoleId ? { ...role, prompt: roleDraft } : role
                          ));
                          setRoles(nextRoles);
                          window.electronAPI.saveRoleConfig({ activeRoleId, roles: nextRoles });
                        }}
                      >
                        保存提示词
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Image Settings Section */}
              <div className="settings-section">
                <div className="section-header">
                  <span>图片设置</span>
                </div>

                <div className="space-y-4 px-4 pb-4 pt-2">
                  <div className="form-group">
                    <Label className="form-label">缓存目录</Label>
                    <div className="flex gap-2">
                      <Input
                        value={imageSettings.cacheDir}
                        onChange={(e) => setImageSettings((prev) => ({ ...prev, cacheDir: e.target.value }))}
                        placeholder="选择图片缓存目录"
                      />
                      <Button variant="outline" onClick={handlePickImageCacheDir}>选择</Button>
                    </div>
                  </div>

                  <div className="form-group">
                    <Label className="form-label">自动清理间隔</Label>
                    <Select
                      value={String(imageSettings.cleanupIntervalMinutes)}
                      onValueChange={(value) => {
                        const minutes = Number(value);
                        setImageSettings((prev) => ({
                          ...prev,
                          cleanupIntervalMinutes: Number.isFinite(minutes) ? minutes : prev.cleanupIntervalMinutes,
                        }));
                      }}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMAGE_CLEANUP_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="settings-row">
                    <div className="settings-label">
                      <span className="settings-label-title">粘贴失败自动降级路径</span>
                      <span className="settings-label-desc">目标应用不支持图片时，自动发送图片文件路径</span>
                    </div>
                    <Switch
                      checked={imageSettings.fallbackToPathWhenPasteFails}
                      onCheckedChange={(checked) => setImageSettings((prev) => ({ ...prev, fallbackToPathWhenPasteFails: checked }))}
                    />
                  </div>

                  <Button className="w-full" onClick={handleSaveImageSettings} disabled={savingImageSettings}>
                    {imageSettingsSaveStatus === 'success'
                      ? '已保存'
                      : savingImageSettings
                        ? '保存中...'
                        : '保存图片设置'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activePage === 'mobile' && (
            <div className="page-shell connection-page font-sans">
              <div className="page-title-row">
                <h1 className="page-title">手机连接</h1>
                <span className={`status-chip ${aiEnabled ? 'is-on' : 'is-off'}`}>
                  {aiEnabled ? 'AI 已启用' : 'AI 未启用'}
                </span>
              </div>
              
              <div className="qr-container">
                <div className="qr-frame">
                  {qrCode ? (
                    <img src={qrCode} alt="扫码连接" />
                  ) : (
                    <div className="w-[180px] h-[180px] flex items-center justify-center text-muted-foreground">
                      加载中...
                    </div>
                  )}
                </div>
                
                <div className="server-info">
                  {serverInfo.ip}:{serverInfo.port}
                </div>

                <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
                  <span className="status-dot" />
                  <span>{connected ? '设备已连接' : '等待连接...'}</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
