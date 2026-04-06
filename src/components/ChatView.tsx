import { useEffect, useRef, useState } from "react";
import { useConversationContext } from "../hooks/ConversationContext";
import type { Turn } from "../services/storage";

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

interface ChatViewProps {
  onSend: (text: string) => void;
  loading: boolean;
}

function ChatView({ onSend, loading }: ChatViewProps) {
  const { turns, closeConversation, activeConversation } =
    useConversationContext();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length]);

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
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

      <div className="chat-turns">
        {turns
          .filter((t) => t.role !== "system")
          .map((turn: Turn) => (
            <div key={turn.id} className={`chat-turn chat-turn-${turn.role}`}>
              <div className="chat-turn-content">{turn.content}</div>
              <div className="chat-turn-time">{formatTime(turn.created_at)}</div>
            </div>
          ))}
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
      </div>
    </div>
  );
}

export default ChatView;
