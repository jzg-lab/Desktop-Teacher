import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { useConversationContext } from "../hooks/ConversationContext";
import type { Turn } from "../services/storage";
import type { SkillCallInfo } from "../services/skills/types";
import type { SourceRef } from "../services/storage";

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function SkillStatusBar({ skillCallInfo }: { skillCallInfo: SkillCallInfo | null }) {
  if (!skillCallInfo || skillCallInfo.status === "idle") return null;

  const statusConfig: Record<string, { icon: string; text: string; color: string }> = {
    searching: { icon: "🔍", text: skillCallInfo.query ? `正在搜索: ${skillCallInfo.query}` : "正在联网搜索...", color: "#60a5fa" },
    extracting: { icon: "📄", text: skillCallInfo.url ? `正在提取: ${new URL(skillCallInfo.url).hostname}` : "正在提取网页内容...", color: "#a78bfa" },
    done: { icon: "✓", text: "搜索完成", color: "#34d399" },
    error: { icon: "✗", text: skillCallInfo.error ?? "搜索失败", color: "#f87171" },
  };

  const cfg = statusConfig[skillCallInfo.status];
  if (!cfg) return null;

  return (
    <div
      className="skill-status-bar"
      style={{
        padding: "6px 12px",
        margin: "4px 0",
        borderRadius: "6px",
        background: `${cfg.color}15`,
        border: `1px solid ${cfg.color}40`,
        fontSize: "13px",
        color: cfg.color,
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}
    >
      <span>{cfg.icon}</span>
      <span>{cfg.text}</span>
    </div>
  );
}

function SourceLinks({ sources }: { sources: SourceRef[] }) {
  if (sources.length === 0) return null;

  return (
    <div className="source-links" style={{ marginTop: "8px" }}>
      <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>来源：</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {sources.map((s) => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "12px",
              color: "#60a5fa",
              textDecoration: "none",
              background: "#1e3a5f20",
              padding: "2px 8px",
              borderRadius: "4px",
              maxWidth: "200px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={s.title}
          >
            {s.title || s.url}
          </a>
        ))}
      </div>
    </div>
  );
}

interface ChatViewProps {
  onSend: (text: string, searchMode?: boolean) => void;
  loading: boolean;
  sources?: SourceRef[];
  skillCallInfo?: SkillCallInfo | null;
}

function ChatView({ onSend, loading, sources = [], skillCallInfo }: ChatViewProps) {
  const { turns, streamingText, closeConversation, activeConversation } =
    useConversationContext();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, streamingText]);

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput("");
  }

  function handleSearchSend() {
    const text = input.trim();
    if (!text || loading) return;
    onSend(text, true);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="chat-view">
      <div className="chat-header">
        <h2 className="chat-title">{activeConversation?.title ?? "对话"}</h2>
        <button
          className="header-btn"
          onClick={closeConversation}
          aria-label="关闭对话"
          title="关闭当前对话"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 2L12 12M2 12L12 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <SkillStatusBar skillCallInfo={skillCallInfo ?? null} />

      <div className="chat-turns">
        {turns
          .filter((t) => t.role !== "system" && t.role !== "tool")
          .map((turn: Turn) => (
            <div key={turn.id} className={`chat-turn chat-turn-${turn.role}`}>
              <div className="chat-turn-content">
                {turn.role === "assistant" ? (
                  <Markdown>{turn.content}</Markdown>
                ) : (
                  turn.content
                )}
              </div>
              {turn.role === "assistant" && turn.route_type && turn.route_type !== "direct" && (
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                  {turn.route_type === "search" ? "🔍 联网搜索" : "📄 网页提取"}
                </div>
              )}
              <div className="chat-turn-time">{formatTime(turn.created_at)}</div>
            </div>
          ))}
        {streamingText && (
          <div className="chat-turn chat-turn-assistant">
            <div className="chat-turn-content">
              <Markdown>{streamingText}</Markdown>
            </div>
          </div>
        )}
        <SourceLinks sources={sources} />
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="继续追问…"
          rows={2}
          disabled={loading}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            aria-label="发送"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8L14 2L10 14L8 9L2 8Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            className="chat-send-btn search-btn"
            onClick={handleSearchSend}
            disabled={loading || !input.trim()}
            aria-label="搜索"
            title="联网搜索"
            style={{ background: "#1e3a5f", fontSize: "11px" }}
          >
            🔍
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatView;