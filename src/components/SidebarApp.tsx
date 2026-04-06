import { useCallback, useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import CaptureConfirm from "./CaptureConfirm";
import HistoryList from "./HistoryList";
import ChatView from "./ChatView";
import {
  ConversationProvider,
  useConversationContext,
} from "../hooks/ConversationContext";
import type { CaptureRequest } from "../types/capture";

type AvatarStatus = "idle" | "processing" | "error";

const STATUS_CONFIG: Record<AvatarStatus, { label: string; color: string }> = {
  idle: { label: "就绪", color: "#34d399" },
  processing: { label: "思考中...", color: "#fbbf24" },
  error: { label: "出错了", color: "#f87171" },
};

function SidebarAppInner() {
  const [status, setStatus] = useState<AvatarStatus>("idle");
  const [captureImage, setCaptureImage] = useState<string | null>(null);
  const config = STATUS_CONFIG[status];

  const {
    viewMode,
    activeConversation,
    startNewConversation,
    appendTurn,
    closeConversation,
    showHistory,
    dismissHistory,
    loading: ctxLoading,
  } = useConversationContext();

  useEffect(() => {
    const unlisten = listen<string>("capture-selected", (event) => {
      setCaptureImage(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  async function handleClose() {
    closeConversation();
    setCaptureImage(null);
    await getCurrentWebviewWindow().hide();
  }

  const handleSubmit = useCallback(
    async (request: CaptureRequest) => {
      setStatus("processing");
      try {
        let convId = activeConversation?.id;

        if (!convId) {
          const meta = await startNewConversation(
            request.textQuestion
              ? request.textQuestion.slice(0, 30)
              : "截图提问",
          );
          convId = meta.id;
        }

        const questionText =
          request.textQuestion ?? "请解释这张截图中的内容";
        await appendTurn("user", questionText, null, convId);
        await appendTurn(
          "assistant",
          "（模型回答将在 step-04 接入后实现）",
          "direct",
          convId,
        );

        setCaptureImage(null);
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    },
    [activeConversation, startNewConversation, appendTurn],
  );

  const handleCancel = useCallback(() => {
    setCaptureImage(null);
  }, []);

  const handleRecapture = useCallback(() => {
    setCaptureImage(null);
    invoke("capture_cancel").catch(() => {});
  }, []);

  const handleChatSend = useCallback(
    async (text: string) => {
      setStatus("processing");
      try {
        await appendTurn("user", text);
        await appendTurn(
          "assistant",
          "（模型回答将在 step-04 接入后实现）",
          "direct",
        );
        setStatus("idle");
      } catch {
        setStatus("error");
      }
    },
    [appendTurn],
  );

  const showCapture = captureImage && viewMode !== "history";

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
            onClick={showHistory}
            aria-label="历史会话"
            title="历史会话"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle
                cx="7"
                cy="7"
                r="5.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M7 4V7.5L9.5 9"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
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
        {showCapture ? (
          <CaptureConfirm
            imageData={captureImage}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onRecapture={handleRecapture}
          />
        ) : viewMode === "history" ? (
          <HistoryList onBack={dismissHistory} />
        ) : viewMode === "chat" ? (
          <ChatView onSend={handleChatSend} loading={ctxLoading} />
        ) : (
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
            <p className="empty-text">按下 Ctrl+Shift+S 截屏提问</p>
            <p className="empty-subtext">或右键点击托盘图标开始</p>
          </div>
        )}
      </main>
    </div>
  );
}

function SidebarApp() {
  return (
    <ConversationProvider>
      <SidebarAppInner />
    </ConversationProvider>
  );
}

export default SidebarApp;
