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
        const url = `http://${info.ip}:${info.port}?token=${info.token}`;
        const qrDataUrl = await window.electronAPI.generateQRCode(url);
        setQrCode(qrDataUrl);
      } catch (e) {
        console.error('Failed to init:', e);
      }
    };

    window.electronAPI.onConnectionStatus((status) => {
      setConnected(status);
    });

    init();
  }, []);

  return (
    <div className="container">
      <div className="header">
        <span className="title">AirVoice</span>
        <button className="close-btn" onClick={() => window.close()}>✕</button>
      </div>

      <div className="qr-container">
        <div className="qrcode">
          {qrCode ? <img src={qrCode} alt="QR" /> : '加载中...'}
        </div>
      </div>

      <div className="status">
        <span className={`status-dot ${connected ? 'connected' : ''}`} />
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
