interface ServerState {
  ip: string;
  port: number;
  token: string;
  connected: boolean;
}

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

interface HistoryItem {
  text?: string;
  kind?: 'text' | 'image';
  imageName?: string;
  time: number;
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

interface ElectronAPI {
  onConnectionStatus: (callback: (status: boolean) => void) => () => void;
  onIPChanged: (callback: (data: { ip: string; port: number; qrCode: string }) => void) => () => void;
  getServerInfo: () => Promise<ServerState>;
  generateQRCode: (url: string) => Promise<string>;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  getAIConfig: () => Promise<AIConfig>;
  saveAIConfig: (config: Partial<AIConfig>) => Promise<AIConfig>;
  getRoleConfig: () => Promise<RoleConfig>;
  saveRoleConfig: (config: Partial<RoleConfig>) => Promise<RoleConfig>;
  getImageSettings: () => Promise<ImageSettings>;
  saveImageSettings: (settings: Partial<ImageSettings>) => Promise<ImageSettings>;
  pickImageCacheDir: () => Promise<string | null>;
  optimizeText: (text: string) => Promise<string>;
  getHistory: () => Promise<HistoryItem[]>;
  clearHistory: () => Promise<boolean>;

  // Chat API
  sendChatMessage: (content: string, sessionId?: string) => Promise<{ chatId: string; sessionId: string }>;
  getChatSessions: () => Promise<ChatSession[]>;
  getChatSession: (sessionId: string) => Promise<ChatSession | null>;
  createChatSession: (title?: string) => Promise<ChatSession>;
  deleteChatSession: (sessionId: string) => Promise<void>;
  clearAllChatSessions: () => Promise<void>;
  setCurrentChatSession: (sessionId: string) => Promise<ChatSession | null>;

  // Chat 流式事件
  onChatDelta: (callback: (data: { chatId: string; delta: string }) => void) => () => void;
  onChatToolCall: (callback: (data: { chatId: string; toolName: string; args: Record<string, unknown> }) => void) => () => void;
  onChatToolResult: (callback: (data: { chatId: string; toolName: string; result: unknown }) => void) => () => void;
  onChatDone: (callback: (data: { chatId: string; content: string; steps: AgentStepInfo[] }) => void) => () => void;
  onChatError: (callback: (data: { chatId: string; error: string }) => void) => () => void;
  onChatInputFromMobile: (callback: (content: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
