import { useCallback, useEffect, useState } from "react";
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

type AvatarStatus = "idle" | "processing" | "searching" | "extracting" | "error";

const STATUS_CONFIG: Record<AvatarStatus, { label: string; color: string }> = {
  idle: { label: "就绪", color: "#34d399" },
  processing: { label: "思考中...", color: "#fbbf24" },
  searching: { label: "搜索中...", color: "#60a5fa" },
  extracting: { label: "提取中...", color: "#a78bfa" },
  error: { label: "出错了", color: "#f87171" },
};

function SidebarAppInner() {
  const [status, setStatus] = useState<AvatarStatus>("idle");
  const [pendingCaptureImage, setPendingCaptureImage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [forceSearch, setForceSearch] = useState(false);
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
  } = useConversationContext();

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

    if (enableTools && client.tavilyApiKey) {
      const result = await client.chatWithTools(
        { messages, tools: getSearchTools(forceSearch) },
        {
          type(status) {
            onSkillStatus?.({
              status: status.type === "searching" ? "searching" : status.type === "extracting" ? "extracting" : status.type === "error" ? "error" : "idle",
              query: status.query,
              url: status.url,
              error: status.error,
            });
          },
        },
      );

      fullText = result.text;

      if (result.sources.length > 0) {
        setSources(result.sources);
      }

      const routeType = result.route.route_type as RouteType;
      await appendTurn("assistant", fullText, routeType, convId);

      for (const source of result.sources) {
        await appendTurn("assistant", `[${source.title}](${source.url})`, routeType, convId);
      }
    } else {
      setStreamingText("");
      for await (const chunk of client.chatStream({ messages })) {
        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        fullText += delta;
        setStreamingText(fullText);
      }
      setStreamingText("");
      await appendTurn("assistant", fullText, "direct", convId);
    }

    return fullText;
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

        await streamAndSave(messages, convId, forceSearch, (info) => {
          if (info.status === "searching") {
            setStatus("searching");
          } else if (info.status === "extracting") {
            setStatus("extracting");
          } else if (info.status === "error") {
            setStatus("error");
          }
        });

        setPendingCaptureImage(null);
        setStatus("idle");
      } catch {
        setStreamingText("");
        setStatus("error");
      }
    },
    [activeConversation, startNewConversation, appendTurn, turns, setStreamingText, setThreadImageData, setSources, forceSearch],
  );

  const handleCancel = useCallback(() => {
    setPendingCaptureImage(null);
  }, []);

  const handleRecapture = useCallback(() => {
    setPendingCaptureImage(null);
    invoke("capture_cancel").catch(() => {});
  }, []);

  const handleChatSend = useCallback(
    async (text: string, searchMode?: boolean) => {
      setStatus("processing");
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

        await streamAndSave(messages, undefined, shouldUseTools, (info) => {
          setSkillCallInfo(info);
          if (info.status === "searching") {
            setStatus("searching");
          } else if (info.status === "extracting") {
            setStatus("extracting");
          } else if (info.status === "error") {
            setStatus("error");
          }
        });

        setStatus("idle");
        setForceSearch(false);
      } catch {
        setStreamingText("");
        setStatus("error");
      }
    },
    [appendTurn, turns, threadImageData, setStreamingText, setSources, setSkillCallInfo, forceSearch],
  );

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