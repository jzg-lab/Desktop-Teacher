import { useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

type AvatarStatus = 'idle' | 'processing' | 'error';

const STATUS_CONFIG: Record<AvatarStatus, { label: string; color: string }> = {
  idle: { label: '就绪', color: '#34d399' },
  processing: { label: '思考中...', color: '#fbbf24' },
  error: { label: '出错了', color: '#f87171' },
};

function SidebarApp() {
  // TODO: connect to real state from app store
  const [status] = useState<AvatarStatus>('idle');
  const config = STATUS_CONFIG[status];

  async function handleClose() {
    await getCurrentWebviewWindow().hide();
  }

  return (
    <div className="sidebar">
      <header className="sidebar-header" data-tauri-drag-region>
        <div className="header-left">
          <span
            className="status-dot"
            style={{ backgroundColor: config.color }}
          />
          <div className="header-text">
            <h1 className="header-title">Desktop Teacher</h1>
            <span className="header-status">{config.label}</span>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="header-btn"
            onClick={handleClose}
            aria-label="关闭侧边栏"
            title="关闭"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 1L13 13M1 13L13 1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <main className="sidebar-body">
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect
                x="4"
                y="8"
                width="40"
                height="32"
                rx="4"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                opacity="0.4"
              />
              <path
                d="M16 24L22 30L32 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.6"
              />
            </svg>
          </div>
          <p className="empty-text">按下快捷键截屏提问</p>
          <p className="empty-subtext">
            或右键点击托盘图标开始
          </p>
        </div>
      </main>
    </div>
  );
}

export default SidebarApp;
