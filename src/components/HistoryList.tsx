import { useEffect, useState } from "react";
import { listConversations } from "../services/storage";
import { useConversationContext } from "../hooks/ConversationContext";
import type { ConversationMeta } from "../services/storage";

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 2) return "昨天";
  return `${diffDay}天前`;
}

interface HistoryListProps {
  onBack: () => void;
}

function HistoryList({ onBack }: HistoryListProps) {
  const { openConversation, removeConversation } = useConversationContext();
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listConversations()
      .then((list) => {
        if (!cancelled) {
          setConversations(
            [...list].sort(
              (a, b) =>
                new Date(b.updated_at).getTime() -
                new Date(a.updated_at).getTime(),
            ),
          );
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleOpen(meta: ConversationMeta) {
    await openConversation(meta);
  }

  async function handleDelete(id: string, title: string) {
    const ok = confirm(`确定删除会话「${title}」？此操作不可撤销。`);
    if (!ok) return;
    await removeConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }

  if (loading) {
    return (
      <div className="history-panel">
        <div className="history-header">
          <button className="header-btn" onClick={onBack} aria-label="返回">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M9 1L3 7L9 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h2 className="history-title">历史会话</h2>
        </div>
        <div className="history-loading">加载中…</div>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div className="history-header">
        <button className="header-btn" onClick={onBack} aria-label="返回">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M9 1L3 7L9 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h2 className="history-title">历史会话</h2>
      </div>

      {conversations.length === 0 ? (
        <div className="history-empty">
          <p className="history-empty-text">暂无历史会话</p>
          <p className="history-empty-subtext">开始一次截图提问后将自动保存</p>
        </div>
      ) : (
        <ul className="history-list">
          {conversations.map((conv) => (
            <li key={conv.id} className="history-item">
              <button
                className="history-item-main"
                onClick={() => handleOpen(conv)}
              >
                <span className="history-item-title">{conv.title}</span>
                <span className="history-item-time">
                  {formatRelativeTime(conv.updated_at)}
                </span>
              </button>
              <button
                className="history-item-delete"
                onClick={() => handleDelete(conv.id, conv.title)}
                aria-label={`删除 ${conv.title}`}
                title="删除"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 2L10 10M2 10L10 2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default HistoryList;
