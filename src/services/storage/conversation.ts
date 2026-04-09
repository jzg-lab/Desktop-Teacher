/**
 * 会话存储服务
 *
 * 通过 Tauri 命令（Rust 侧 fs 操作）实现本地文件读写。
 * 前端通过 @tauri-apps/api 的 invoke 调用。
 *
 * 目录结构约定：
 *   data/conversations/
 *     ├── conversations-index.json     # 轻量索引
 *     ├── {conversation-id}/
 *     │   ├── meta.json
 *     │   ├── messages.json
 *     │   └── attachments/
 *     │       └── {attachment-id}.png
 *     └── ...
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  ConversationMeta,
  Turn,
  ConversationIndex,
} from "./types";

// ---------- Index ----------

export async function loadIndex(): Promise<ConversationIndex> {
  return invoke<ConversationIndex>("storage_load_index");
}

// ---------- Conversation ----------

export async function listConversations(): Promise<ConversationMeta[]> {
  const index = await loadIndex();
  return index.conversations;
}

export async function createConversation(
  title: string,
): Promise<ConversationMeta> {
  return invoke<ConversationMeta>("storage_create_conversation", { title });
}

export async function getConversation(
  id: string,
): Promise<ConversationMeta | null> {
  return invoke<ConversationMeta | null>("storage_get_conversation", { id });
}

export async function updateConversationTitle(
  id: string,
  title: string,
): Promise<void> {
  await invoke("storage_update_conversation_title", { id, title });
}

export async function deleteConversation(id: string): Promise<void> {
  await invoke("storage_delete_conversation", { id });
}

// ---------- Turns ----------

export async function loadTurns(conversationId: string): Promise<Turn[]> {
  return invoke<Turn[]>("storage_load_turns", { conversationId });
}

export async function appendTurn(
  conversationId: string,
  turn: Omit<Turn, "id" | "conversation_id" | "created_at">,
): Promise<Turn> {
  return invoke<Turn>("storage_append_turn", {
    conversationId,
    role: turn.role,
    content: turn.content,
    routeType: turn.route_type,
    toolCalls: turn.tool_calls ?? null,
    toolCallId: turn.tool_call_id ?? null,
  });
}
