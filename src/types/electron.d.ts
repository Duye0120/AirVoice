interface ServerState {
  ip: string;
  port: number;
  token: string;
  connected: boolean;
}

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

interface HistoryItem {
  text: string;
  time: number;
}

interface ElectronAPI {
  onConnectionStatus: (callback: (status: boolean) => void) => () => void;
  onIPChanged: (callback: (data: { ip: string; port: number; qrCode: string }) => void) => () => void;
  getServerInfo: () => Promise<ServerState>;
  generateQRCode: (url: string) => Promise<string>;
  windowMinimize: () => void;
  windowClose: () => void;
  getAIConfig: () => Promise<AIConfig>;
  saveAIConfig: (config: Partial<AIConfig>) => Promise<AIConfig>;
  getRoleConfig: () => Promise<RoleConfig>;
  saveRoleConfig: (config: Partial<RoleConfig>) => Promise<RoleConfig>;
  optimizeText: (text: string) => Promise<string>;
  getHistory: () => Promise<HistoryItem[]>;
  clearHistory: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
