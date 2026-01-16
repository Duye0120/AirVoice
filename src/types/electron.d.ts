interface ServerState {
  ip: string;
  port: number;
  token: string;
  connected: boolean;
}

interface ElectronAPI {
  onConnectionStatus: (callback: (status: boolean) => void) => () => void;
  onIPChanged: (callback: (data: { ip: string; port: number; qrCode: string }) => void) => () => void;
  getServerInfo: () => Promise<ServerState>;
  generateQRCode: (url: string) => Promise<string>;
  windowMinimize: () => void;
  windowClose: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
