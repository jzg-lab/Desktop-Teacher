/**
 * 本地会话存储 — 数据类型
 *
 * 文件制存储：每条会话一个目录，内含 meta.json、messages.json、attachments/。
 * 根目录维护 conversations-index.json 用于加速历史列表加载。
 */

export interface ConversationMeta {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  status: "active" | "archived";
}

export type Role = "system" | "user" | "assistant";

export interface Turn {
  id: string;
  conversation_id: string;
  role: Role;
  content: string;
  route_type: "direct" | "search" | "extraction" | null;
  created_at: string;
}

export interface Attachment {
  id: string;
  turn_id: string;
  type: "screenshot" | "file";
  local_uri: string;
  metadata: Record<string, unknown>;
}

export interface SourceRef {
  id: string;
  turn_id: string;
  title: string;
  url: string;
  snippet: string;
}

export interface ConversationIndex {
  conversations: ConversationMeta[];
  last_updated: string;
}
