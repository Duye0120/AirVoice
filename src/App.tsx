import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Minus, X, Square, Bot, Plus, MessageSquare, Settings as SettingsIcon, Smartphone, Trash2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

import { Thread } from '@/components/thread';
import { AirVoiceRuntimeProvider } from '@/components/assistant-runtime-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

// Type definitions
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

interface ChatSession {
  id: string;
  title: string;
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

export default function App() {
  const [connected, setConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState({ ip: '--', port: 0 });

  // Chat sessions
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

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

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const list = await window.electronAPI.getChatSessions();
      setSessions(list);
    } catch (e) {
      console.error('Failed to load sessions:', e);
    }
  }, []);

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

        // Load chat sessions
        await loadSessions();
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
  }, [loadSessions]);

  const handleNewChat = async () => {
    try {
      const session = await window.electronAPI.createChatSession();
      setSessions(prev => [session, ...prev]);
      setActiveSessionId(session.id);
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await window.electronAPI.deleteChatSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };

  const handleSessionChange = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };

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

  const currentProvider = PROVIDER_OPTIONS.find(p => p.id === config.provider)!;
  const currentProviderConfig = config.providers[config.provider];
  const aiEnabled = config.optimizeMode !== 'off';

  return (
    <TooltipProvider>
    <div className="desktop-root h-screen">
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
            className="control-btn"
            onClick={() => window.electronAPI.windowMaximize()}
            aria-label="Maximize"
          >
            <Square className="w-3.5 h-3.5" />
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
          {/* Header + New Chat */}
          <div className="sidebar-header">
            <div className="brand-badge">A</div>
            <div className="flex-1 min-w-0">
              <div className="sidebar-brand-title">AirVoice</div>
              <div className="sidebar-brand-subtitle">Agent</div>
            </div>
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground"
              onClick={handleNewChat}
              title="新建对话"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Session List */}
          <div className="sidebar-sessions">
            {sessions.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                暂无对话
              </div>
            ) : (
              sessions.map(session => (
                <div
                  key={session.id}
                  className={`session-item group ${activeSessionId === session.id ? 'active' : ''}`}
                  onClick={() => handleSessionChange(session.id)}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  <span className="flex-1 min-w-0 truncate text-[13px]">
                    {session.title || '新对话'}
                  </span>
                  <button
                    className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                    title="删除对话"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Bottom Bar */}
          <div className="sidebar-bottom">
            {/* Settings Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <button className="sidebar-bottom-btn" title="设置">
                  <SettingsIcon className="w-4 h-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogTitle>设置</DialogTitle>
                <SettingsContent
                  config={config}
                  setConfig={setConfig}
                  currentProvider={currentProvider}
                  currentProviderConfig={currentProviderConfig}
                  updateProviderConfig={updateProviderConfig}
                  handleSave={handleSave}
                  saving={saving}
                  saveStatus={saveStatus}
                  roles={roles}
                  setRoles={setRoles}
                  activeRoleId={activeRoleId}
                  setActiveRoleId={setActiveRoleId}
                  roleDraft={roleDraft}
                  setRoleDraft={setRoleDraft}
                  addingRole={addingRole}
                  setAddingRole={setAddingRole}
                  newRoleName={newRoleName}
                  setNewRoleName={setNewRoleName}
                  imageSettings={imageSettings}
                  setImageSettings={setImageSettings}
                  handleSaveImageSettings={handleSaveImageSettings}
                  savingImageSettings={savingImageSettings}
                  imageSettingsSaveStatus={imageSettingsSaveStatus}
                  handlePickImageCacheDir={handlePickImageCacheDir}
                />
              </DialogContent>
            </Dialog>

            {/* Mobile Connect Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <button className="sidebar-bottom-btn" title="手机连接">
                  <Smartphone className="w-4 h-4" />
                  {connected && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500" />}
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogTitle>手机连接</DialogTitle>
                <MobileConnectContent
                  qrCode={qrCode}
                  serverInfo={serverInfo}
                  connected={connected}
                  aiEnabled={aiEnabled}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Content — always Chat */}
        <AirVoiceRuntimeProvider sessionId={activeSessionId} onSessionChange={handleSessionChange}>
          <main className="main-content flex flex-col h-full p-0 overflow-hidden">
            <div className="h-full">
              <Thread />
            </div>
          </main>
        </AirVoiceRuntimeProvider>
      </div>
    </div>
    </TooltipProvider>
  );
}

// ============================================================
// Settings Content (extracted for Dialog)
// ============================================================
function SettingsContent({
  config, setConfig, currentProvider, currentProviderConfig, updateProviderConfig,
  handleSave, saving, saveStatus,
  roles, setRoles, activeRoleId, setActiveRoleId, roleDraft, setRoleDraft,
  addingRole, setAddingRole, newRoleName, setNewRoleName,
  imageSettings, setImageSettings, handleSaveImageSettings, savingImageSettings, imageSettingsSaveStatus,
  handlePickImageCacheDir,
}: {
  config: AIConfig;
  setConfig: React.Dispatch<React.SetStateAction<AIConfig>>;
  currentProvider: typeof PROVIDER_OPTIONS[number];
  currentProviderConfig: ProviderConfig;
  updateProviderConfig: (provider: AIProvider, field: keyof ProviderConfig, value: string) => void;
  handleSave: () => void;
  saving: boolean;
  saveStatus: 'idle' | 'success';
  roles: RolePrompt[];
  setRoles: React.Dispatch<React.SetStateAction<RolePrompt[]>>;
  activeRoleId: string;
  setActiveRoleId: React.Dispatch<React.SetStateAction<string>>;
  roleDraft: string;
  setRoleDraft: React.Dispatch<React.SetStateAction<string>>;
  addingRole: boolean;
  setAddingRole: React.Dispatch<React.SetStateAction<boolean>>;
  newRoleName: string;
  setNewRoleName: React.Dispatch<React.SetStateAction<string>>;
  imageSettings: ImageSettings;
  setImageSettings: React.Dispatch<React.SetStateAction<ImageSettings>>;
  handleSaveImageSettings: () => void;
  savingImageSettings: boolean;
  imageSettingsSaveStatus: 'idle' | 'success';
  handlePickImageCacheDir: () => void;
}) {
  return (
    <div className="space-y-6 pt-2">
      {/* AI Config */}
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
          <Select value={config.optimizeMode} onValueChange={(v) => setConfig({ ...config, optimizeMode: v as OptimizeMode })}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
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
            <div key={p.id} className={`provider-card ${config.provider === p.id ? 'active' : ''}`} onClick={() => setConfig({ ...config, provider: p.id })}>
              <div className="provider-icon">{p.icon}</div>
              <div className="provider-name">{p.name}</div>
              <div className="provider-status">{config.provider === p.id ? '已选择' : '点击选择'}</div>
            </div>
          ))}
        </div>
        <div className="space-y-4 mt-4">
          <div className="form-group">
            <Label className="form-label">API Key</Label>
            <Input type="password" value={currentProviderConfig.apiKey} onChange={(e) => updateProviderConfig(config.provider, 'apiKey', e.target.value)} placeholder="输入 API Key" />
          </div>
          <div className="form-group">
            <Label className="form-label">Base URL（可选）</Label>
            <Input value={currentProviderConfig.baseURL || ''} onChange={(e) => updateProviderConfig(config.provider, 'baseURL', e.target.value)} placeholder={currentProvider.defaultURL} />
          </div>
          <div className="form-group">
            <Label className="form-label">模型</Label>
            <Input value={currentProviderConfig.model} onChange={(e) => updateProviderConfig(config.provider, 'model', e.target.value)} placeholder="模型名称" list={`models-${config.provider}`} />
            <datalist id={`models-${config.provider}`}>
              {currentProvider.models.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saveStatus === 'success' ? '已保存' : saving ? '保存中...' : '保存 AI 设置'}
          </Button>
        </div>
      </div>

      {/* Role Config */}
      <div className="settings-section">
        <div className="section-header">
          <Bot className="section-icon" />
          <span>角色设定</span>
        </div>
        <div className="px-4 pb-4 pt-2 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">当前角色</Label>
            <Select value={activeRoleId} onValueChange={(value) => {
              setActiveRoleId(value);
              const selected = roles.find((role) => role.id === value);
              setRoleDraft(selected?.prompt || '');
              window.electronAPI.saveRoleConfig({ activeRoleId: value });
            }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="选择角色" /></SelectTrigger>
              <SelectContent>
                {roles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {addingRole ? (
            <div className="flex items-center gap-2 p-1">
              <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="新角色名称" className="h-10 text-base font-sans flex-1" autoFocus />
              <Button size="sm" className="h-10 px-4" onClick={() => {
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
              }}>保存</Button>
              <Button variant="ghost" size="sm" className="h-10 w-10 p-0" onClick={() => { setAddingRole(false); setNewRoleName(''); }}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full h-8 text-xs border-dashed text-muted-foreground hover:text-primary transition-colors" onClick={() => setAddingRole(true)}>
              + 新增角色
            </Button>
          )}
          <div className="space-y-3 pt-2 border-t border-border/40">
            <Label className="text-xs font-medium text-muted-foreground">提示词 (System Prompt)</Label>
            <Textarea value={roleDraft} onChange={(e) => setRoleDraft(e.target.value)} placeholder="输入角色的详细设定和指令..." className="min-h-[200px] font-sans text-base leading-relaxed resize-none bg-muted/20 focus:bg-background transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground opacity-70">{roleDraft.length} 字符</span>
              <Button size="sm" onClick={() => {
                if (!activeRoleId) return;
                const nextRoles = roles.map((role) => role.id === activeRoleId ? { ...role, prompt: roleDraft } : role);
                setRoles(nextRoles);
                window.electronAPI.saveRoleConfig({ activeRoleId, roles: nextRoles });
              }}>保存提示词</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Settings */}
      <div className="settings-section">
        <div className="section-header"><span>图片设置</span></div>
        <div className="space-y-4 px-4 pb-4 pt-2">
          <div className="form-group">
            <Label className="form-label">缓存目录</Label>
            <div className="flex gap-2">
              <Input value={imageSettings.cacheDir} onChange={(e) => setImageSettings((prev) => ({ ...prev, cacheDir: e.target.value }))} placeholder="选择图片缓存目录" />
              <Button variant="outline" onClick={handlePickImageCacheDir}>选择</Button>
            </div>
          </div>
          <div className="form-group">
            <Label className="form-label">自动清理间隔</Label>
            <Select value={String(imageSettings.cleanupIntervalMinutes)} onValueChange={(value) => {
              const minutes = Number(value);
              setImageSettings((prev) => ({ ...prev, cleanupIntervalMinutes: Number.isFinite(minutes) ? minutes : prev.cleanupIntervalMinutes }));
            }}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {IMAGE_CLEANUP_OPTIONS.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="settings-row">
            <div className="settings-label">
              <span className="settings-label-title">粘贴失败自动降级路径</span>
              <span className="settings-label-desc">目标应用不支持图片时，自动发送图片文件路径</span>
            </div>
            <Switch checked={imageSettings.fallbackToPathWhenPasteFails} onCheckedChange={(checked) => setImageSettings((prev) => ({ ...prev, fallbackToPathWhenPasteFails: checked }))} />
          </div>
          <Button className="w-full" onClick={handleSaveImageSettings} disabled={savingImageSettings}>
            {imageSettingsSaveStatus === 'success' ? '已保存' : savingImageSettings ? '保存中...' : '保存图片设置'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Mobile Connect Content (extracted for Dialog)
// ============================================================
function MobileConnectContent({
  qrCode, serverInfo, connected, aiEnabled,
}: {
  qrCode: string | null;
  serverInfo: { ip: string; port: number };
  connected: boolean;
  aiEnabled: boolean;
}) {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
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
  );
}
