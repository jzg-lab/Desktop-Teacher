import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import CaptureConfirm from "./CaptureConfirm";
import HistoryList from "./HistoryList";
import ChatView from "./ChatView";
import SettingsModal from "./SettingsModal";
import {
  ConversationProvider,
  useConversationContext,
} from "../hooks/ConversationContext";
import { SettingsProvider } from "../hooks/SettingsContext";
import type { CaptureRequest } from "../types/capture";
import { getLLMClient } from "../services/llm";
import { buildContextMessages } from "../services/llm/context";
import { getSearchTools } from "../services/llm/prompt";
import type { ChatMessage, RouteType } from "../services/llm";
import type { SkillCallInfo } from "../services/skills/types";
import type { SourceRef } from "../services/storage";
import { classifyError, checkNetworkAvailability } from "../services/errors";
import type { ClassifiedError } from "../services/errors";
import { logRequestDiagnostic } from "../services/logger";

type AvatarStatus = "idle" | "processing" | "searching" | "extracting" | "error";

const STATUS_CONFIG: Record<AvatarStatus, { label: string; color: string }> = {
  idle: { label: "就绪", color: "#34d399" },
  processing: { label: "思考中...", color: "#fbbf24" },
  searching: { label: "搜索中...", color: "#60a5fa" },
  extracting: { label: "提取中...", color: "#a78bfa" },
  error: { label: "出错了", color: "#f87171" },
};

async function togglePinned(): Promise<boolean> {
  return invoke<boolean>("toggle_always_on_top");
}

function SidebarAppInner() {
  const [status, setStatus] = useState<AvatarStatus>("idle");
  const [pendingCaptureImage, setPendingCaptureImage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [forceSearch, setForceSearch] = useState(false);
  const [pinned, setPinned] = useState(false);
  const config = STATUS_CONFIG[status];

  const {
    viewMode,
    activeConversation,
    turns,
    threadImageData,
    startNewConversation,
    appendTurn,
    closeConversation,
    showHistory,
    dismissHistory,
    loading: ctxLoading,
    setStreamingText,
    setThreadImageData,
    setSkillCallInfo,
    setSources,
    sources,
    skillCallInfo,
    lastError,
    setLastError,
    clearError,
  } = useConversationContext();

  const lastRequestRef = useRef<{
    messages: ChatMessage[];
    convId?: string;
    enableTools?: boolean;
  } | null>(null);

  function handleNetworkCheck(): ClassifiedError | null {
    if (checkNetworkAvailability()) return null;
    const classified = classifyError(new TypeError("Failed to fetch"));
    setLastError(classified);
    setStatus("error");
    return classified;
  }

  function handleSkillStatus(info: SkillCallInfo) {
    if (info.status === "searching") {
      setStatus("searching");
    } else if (info.status === "extracting") {
      setStatus("extracting");
    } else if (info.status === "error") {
      setStatus("error");
    }
  }

  useEffect(() => {
    const unlisten = listen<string>("capture-selected", (event) => {
      setPendingCaptureImage(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  async function handleClose() {
    closeConversation();
    setPendingCaptureImage(null);
    await getCurrentWebviewWindow().hide();
  }

  async function streamAndSave(
    messages: ChatMessage[],
    convId?: string,
    enableTools?: boolean,
    onSkillStatus?: (info: SkillCallInfo) => void,
  ): Promise<string> {
    let fullText = "";
    const client = getLLMClient();
    const startTime = performance.now();

    if (enableTools && client.tavilyApiKey) {
      const result = await client.chatWithTools(
        { messages, tools: getSearchTools() },
        onSkillStatus,
      );

      fullText = result.text;

      if (result.sources.length > 0) {
        setSources(result.sources);
      }

      const routeType = result.route.route_type as RouteType;
      await appendTurn("assistant", fullText, routeType, convId);

      logRequestDiagnostic({
        routeType: routeType,
        provider: result.route.provider,
        model: result.route.model,
        skillInvoked: result.route.skill_invoked,
        success: true,
        latencyMs: result.route.latency_ms,
      });

      for (const source of result.sources) {
        await appendTurn("assistant", `[${source.title}](${source.url})`, routeType, convId);
      }
    } else {
      setStreamingText("");
      let routeModel = "";
      for await (const chunk of client.chatStream({ messages })) {
        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        fullText += delta;
        setStreamingText(fullText);
        if (!routeModel && chunk.model) {
          routeModel = chunk.model;
        }
      }
      setStreamingText("");
      await appendTurn("assistant", fullText, "direct", convId);

      const latencyMs = Math.round(performance.now() - startTime);
      logRequestDiagnostic({
        routeType: "direct",
        provider: client["defaultProvider"],
        model: routeModel || "unknown",
        skillInvoked: false,
        success: true,
        latencyMs,
      });
    }

    return fullText;
  }

  const handleSubmit = useCallback(
    async (request: CaptureRequest) => {
      setStatus("processing");
      clearError();

      if (handleNetworkCheck()) return;

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

        const hasQuestion = !!request.textQuestion;
        const questionText = request.textQuestion ?? "请解释这张截图中的内容";
        await appendTurn("user", questionText, null, convId);

        setThreadImageData(request.imageData);

        const messages = buildContextMessages({
          turns,
          captureImageData: request.imageData,
          userText: questionText,
          hasNewImage: true,
          hasImage: true,
          hasQuestion,
        });

        lastRequestRef.current = { messages, convId, enableTools: forceSearch };

        await streamAndSave(messages, convId, forceSearch, handleSkillStatus);

        setPendingCaptureImage(null);
        setStatus("idle");
      } catch (err) {
        setStreamingText("");
        setLastError(classifyError(err));
        setStatus("error");
      }
    },
    [activeConversation, startNewConversation, appendTurn, turns, setStreamingText, setThreadImageData, setSources, forceSearch, clearError, setLastError],
  );

  const handleChatSend = useCallback(
    async (text: string, searchMode?: boolean) => {
      setStatus("processing");
      clearError();

      if (handleNetworkCheck()) return;

      try {
        await appendTurn("user", text);

        setSkillCallInfo(null);
        setSources([]);

        const messages = buildContextMessages({
          turns,
          captureImageData: threadImageData,
          userText: text,
          hasNewImage: false,
          hasImage: !!threadImageData,
          hasQuestion: true,
        });

        const shouldUseTools = searchMode || forceSearch;

        lastRequestRef.current = { messages, enableTools: shouldUseTools };

        await streamAndSave(messages, undefined, shouldUseTools, (info) => {
          setSkillCallInfo(info);
          handleSkillStatus(info);
        });

        setStatus("idle");
        setForceSearch(false);
      } catch (err) {
        setStreamingText("");
        setLastError(classifyError(err));
        setStatus("error");
      }
    },
    [appendTurn, turns, threadImageData, setStreamingText, setSources, setSkillCallInfo, forceSearch, clearError, setLastError],
  );

  const handleRetry = useCallback(async () => {
    const last = lastRequestRef.current;
    if (!last) return;

    setStatus("processing");
    clearError();
    setSkillCallInfo(null);
    setSources([]);

    if (handleNetworkCheck()) return;

    try {
      await streamAndSave(last.messages, last.convId, last.enableTools, handleSkillStatus);
      setStatus("idle");
    } catch (err) {
      setStreamingText("");
      setLastError(classifyError(err));
      setStatus("error");
    }
  }, [clearError, setLastError, setSkillCallInfo, setSources]);

  const handleCancel = useCallback(() => {
    setPendingCaptureImage(null);
  }, []);

  const handleRecapture = useCallback(() => {
    setPendingCaptureImage(null);
    invoke("capture_cancel").catch(() => {});
  }, []);

  const showCapture = pendingCaptureImage && viewMode !== "history";

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
            title={forceSearch ? "关闭搜索模式" : "搜索模式"}
            aria-label={forceSearch ? "关闭搜索模式" : "搜索模式"}
            onClick={() => setForceSearch((prev) => !prev)}
            style={forceSearch ? { color: "#60a5fa" } : undefined}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M9 9L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className="header-btn"
            onClick={() => setShowSettings(true)}
            aria-label="设置"
            title="设置"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M5.8 1.4l-.3 1.5c-.4.2-.8.4-1.1.7l-1.5-.5-.8 1.4 1.1 1.1c0 .2 0 .4 0 .6s0 .4 0 .6l-1.1 1.1.8 1.4 1.5-.5c.3.3.7.5 1.1.7l.3 1.5h1.6l.3-1.5c.4-.2.8-.4 1.1-.7l1.5.5.8-1.4-1.1-1.1c0-.2 0-.4 0-.6s0-.4 0-.6l1.1-1.1-.8-1.4-1.5.5c-.3-.3-.7-.5-1.1-.7L7.4 1.4H5.8z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <circle cx="6.6" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
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
            className={`header-btn${pinned ? " header-btn-active" : ""}`}
            onClick={async () => {
              const newState = await togglePinned();
              setPinned(newState);
            }}
            aria-label={pinned ? "取消置顶" : "置顶"}
            title={pinned ? "取消置顶" : "置顶"}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill={pinned ? "currentColor" : "none"}>
              <path
                d="M7 1L8.5 5.5L13 7L8.5 8.5L7 13L5.5 8.5L1 7L5.5 5.5L7 1Z"
                stroke="currentColor"
                strokeWidth="1.2"
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
            imageData={pendingCaptureImage}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onRecapture={handleRecapture}
          />
        ) : viewMode === "history" ? (
          <HistoryList onBack={dismissHistory} />
        ) : viewMode === "chat" ? (
          <ChatView onSend={handleChatSend} loading={ctxLoading} sources={sources} skillCallInfo={skillCallInfo} />
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

      {lastError && (
        <div className="error-banner">
          <div className="error-banner-content">
            <span className="error-banner-icon">⚠</span>
            <span className="error-banner-message">{lastError.userMessage}</span>
            {lastError.retryable && (
              <button className="error-banner-retry" onClick={handleRetry}>
                重试
              </button>
            )}
            <button className="error-banner-close" onClick={clearError} aria-label="关闭错误提示">
              ✕
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function SidebarApp() {
  return (
    <SettingsProvider>
      <ConversationProvider>
        <SidebarAppInner />
      </ConversationProvider>
    </SettingsProvider>
  );
}

export default SidebarApp;