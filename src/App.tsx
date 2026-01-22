import { useState, useEffect } from 'react';
import { QrCode, Sparkles, Minus, X, Clock, Bot } from 'lucide-react';
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

type AIProvider = 'openai' | 'anthropic' | 'google';
type OptimizeMode = 'off' | 'auto' | 'manual';

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

type Page = 'connection' | 'history' | 'ai' | 'role';

interface HistoryItem {
  text: string;
  time: number;
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

export default function App() {
  const [activePage, setActivePage] = useState<Page>('connection');
  const [connected, setConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState({ ip: '--', port: 0 });
  
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
  const [history, setHistory] = useState<HistoryItem[]>([]);

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
        
        const historyData = await window.electronAPI.getHistory() as HistoryItem[];
        setHistory(historyData || []);
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

  const currentProvider = PROVIDER_OPTIONS.find(p => p.id === config.provider)!;
  const currentProviderConfig = config.providers[config.provider];

  return (
    <div className="h-screen flex flex-col">
      {/* Titlebar */}
      <div className="titlebar">
        <span className="titlebar-title">AirVoice</span>
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
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activePage === 'connection' ? 'active' : ''}`}
              onClick={() => setActivePage('connection')}
            >
              <QrCode className="nav-icon" />
              <span>连接</span>
            </button>
            <button
              className={`nav-item ${activePage === 'history' ? 'active' : ''}`}
              onClick={async () => {
                setActivePage('history');
                const historyData = await window.electronAPI.getHistory();
                setHistory(historyData || []);
              }}
            >
              <Clock className="nav-icon" />
              <span>历史记录</span>
            </button>
            <button
              className={`nav-item ${activePage === 'ai' ? 'active' : ''}`}
              onClick={() => setActivePage('ai')}
            >
              <Sparkles className="nav-icon" />
              <span>AI 设置</span>
            </button>
            <button
              className={`nav-item ${activePage === 'role' ? 'active' : ''}`}
              onClick={() => setActivePage('role')}
            >
              <Bot className="nav-icon" />
              <span>角色设定</span>
            </button>
          </nav>
        </div>

        {/* Content */}
        <main className="main-content">
          {activePage === 'connection' ? (
            <div className="connection-page font-sans">
              <h1 className="page-title">连接</h1>
              
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
          ) : activePage === 'history' ? (
            <div>
              <h1 className="page-title">历史记录</h1>
              
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Clock className="w-12 h-12 mb-4 opacity-50" />
                  <p>暂无历史记录</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {history.reduce((acc, item, index) => {
                    const dateLabel = getDateLabel(item.time);
                    const prevItem = history[index - 1];
                    const prevDateLabel = prevItem ? getDateLabel(prevItem.time) : null;
                    
                    if (dateLabel !== prevDateLabel) {
                      acc.push(
                        <div key={`date-${item.time}`} className="text-sm font-medium text-muted-foreground pt-2">
                          {dateLabel}
                        </div>
                      );
                    }
                    
                    acc.push(
                      <div key={item.time} className="flex items-start gap-4 py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground w-20 flex-shrink-0 tabular-nums">
                          {formatTime(item.time)}
                        </span>
                        <p className="text-sm flex-1 break-words">{item.text}</p>
                      </div>
                    );
                    
                    return acc;
                  }, [] as React.ReactElement[])}
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      if (confirm('确定清空所有历史记录？')) {
                        await window.electronAPI.clearHistory();
                        setHistory([]);
                      }
                    }}
                  >
                    清空历史记录
                  </Button>
                </div>
              )}
            </div>
          ) : activePage === 'ai' ? (
            <div>
              <h1 className="page-title">AI 设置</h1>

              {/* Text Optimization Section */}
              <div className="settings-section">
                <div className="section-header">
                  <Sparkles className="section-icon" />
                  <span>文字优化</span>
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
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Provider Section */}
              <div className="settings-section">
                <div className="section-header">
                  <span>AI 服务商</span>
                </div>

                <div className="providers-grid">
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

                {/* Provider Config */}
                <div className="space-y-4">
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
                    <p className="form-hint">留空使用默认地址</p>
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
                </div>
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full"
              >
                {saveStatus === 'success' ? '已保存' : saving ? '保存中...' : '保存设置'}
              </Button>
            </div>
          ) : (
            <div>
              <h1 className="page-title">角色设定</h1>

              <div className="settings-section">
                <div className="section-header">
                  <Bot className="section-icon" />
                  <span>角色设定</span>
                </div>

                <div className="px-4 pb-4 pt-2 space-y-4">
                  {/* Role Selector */}
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

                  {/* Compact Add Role Row */}
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

                  {/* Prompt Textarea */}
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
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
