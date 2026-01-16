import { useState, useEffect } from 'react';

export default function App() {
  const [connected, setConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [serverInfo, setServerInfo] = useState({ ip: '--', port: 0 });

  useEffect(() => {
    const init = async () => {
      try {
        const info = await window.electronAPI.getServerInfo();
        setServerInfo({ ip: info.ip, port: info.port });
        const url = `http://${info.ip}:${info.port}`;
        const qrDataUrl = await window.electronAPI.generateQRCode(url);
        setQrCode(qrDataUrl);
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

  return (
    <div className="container">
      <div className="titlebar">
        <span className="title">TypeWithMobile</span>
        <div className="window-controls">
          <button
            className="control-btn minimize"
            onClick={() => window.electronAPI.windowMinimize()}
            aria-label="最小化窗口"
          >−</button>
          <button
            className="control-btn close"
            onClick={() => window.electronAPI.windowClose()}
            aria-label="关闭窗口"
          >×</button>
        </div>
      </div>

      <div className="qr-container">
        <div className="qrcode">
          {qrCode ? <img src={qrCode} alt="扫描此二维码连接手机" width={180} height={180} /> : '加载中…'}
        </div>
      </div>

      <div className="status" role="status" aria-live="polite">
        <span className={`status-dot ${connected ? 'connected' : ''}`} aria-hidden="true" />
        <span className="status-text">{connected ? '已连接' : '等待连接'}</span>
      </div>

      <div className="info">
        <p className="info-main">使用手机扫描二维码连接</p>
        <span className="info-url">{serverInfo.ip}:{serverInfo.port}</span>
      </div>

      <p className="tip">按 <kbd>Ctrl+Shift+V</kbd> 重复输入</p>
    </div>
  );
}
