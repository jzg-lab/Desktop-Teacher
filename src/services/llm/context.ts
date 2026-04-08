/**
 * 线程上下文管理
 *
 * 负责将本地 Turn[] 转换为 LLM ChatMessage[]，
 * 并在上下文过长时按策略截断，保证追问能引用截图和前文。
 *
 * 截断策略（step05）：
 *   1. 始终保留 system prompt
 *   2. 始终保留首条 user 消息（含截图）+ 首条 assistant 回复（作为锚点）
 *   3. 从中间丢弃最旧的 Turn，直到总字符数低于上限
 *   4. 始终保留最近 N 条 Turn
 *   5. 若仍超限，只保留最近 N 条
 */

import type { ChatMessage } from "./types";
import type { Turn } from "../storage/types";
import { buildSystemPrompt, buildUserContent } from "./prompt";

// ---------- 常量 ----------

/** 上下文字符上限（约 4000 tokens，中文约 4 字符/token） */
export const MAX_CONTEXT_CHARS = 16_000;

/** 上下文 Turn 上限（防止 Turn 数过多撑爆 token） */
export const MAX_CONTEXT_TURNS = 20;

/** 始终保留的最近 Turn 数 */
const MIN_RECENT_TURNS = 4;

// ---------- 工具函数 ----------

/** 估算 ChatMessage 的字符数 */
function estimateChars(msg: ChatMessage): number {
  if (typeof msg.content === "string") {
    return msg.content.length;
  }
  // MessageContent 数组
  return (msg.content as Array<{ type: string; text?: string }>).reduce(
    (sum, part) => sum + (part.type === "text" && part.text ? part.text.length : 0),
    0,
  );
}

/** 计算一组消息的总字符数 */
function totalChars(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateChars(m), 0);
}

// ---------- Turn → ChatMessage 转换 ----------

/**
 * 将 Turn 列表转为 ChatMessage 数组（不含 system prompt）。
 *
 * 首条 user Turn 会携带截图（如有）；其余 Turn 仅含文本。
 */
export function turnsToMessages(
  turns: Turn[],
  captureImageData: string | null,
): ChatMessage[] {
  const nonSystemTurns = turns.filter((t) => t.role !== "system" && t.content);
  if (nonSystemTurns.length === 0) return [];

  const messages: ChatMessage[] = [];
  let firstUserTurnHandled = false;

  for (const turn of nonSystemTurns) {
    if (turn.role === "user" && !firstUserTurnHandled) {
      if (captureImageData) {
        const userContent = buildUserContent(captureImageData, turn.content);
        messages.push({ role: "user", content: userContent });
      } else {
        messages.push({ role: "user", content: turn.content });
      }
      firstUserTurnHandled = true;
    } else {
      messages.push({
        role: turn.role as "user" | "assistant",
        content: turn.content,
      });
    }
  }

  return messages;
}

// ---------- 截断策略 ----------

/**
 * 对 ChatMessage 数组应用截断策略。
 *
 * 输入应已包含 system prompt 在首位。
 * 返回截断后的消息数组。
 */
export function truncateMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= 1) return messages;

  const systemMsg = messages[0];
  const rest = messages.slice(1);

  const capped = rest.slice(-MAX_CONTEXT_TURNS);

  const allCapped = [systemMsg, ...capped];
  if (totalChars(allCapped) <= MAX_CONTEXT_CHARS) {
    return allCapped;
  }

  if (capped.length <= MIN_RECENT_TURNS + 2) {
    const recentOnly = capped.slice(-MIN_RECENT_TURNS);
    return [systemMsg, ...recentOnly];
  }

  const anchor: ChatMessage[] = [];
  const firstUserIdx = capped.findIndex((m) => m.role === "user");
  if (firstUserIdx >= 0) {
    anchor.push(capped[firstUserIdx]);
    if (firstUserIdx + 1 < capped.length && capped[firstUserIdx + 1].role === "assistant") {
      anchor.push(capped[firstUserIdx + 1]);
    }
  }

  const recent = capped.slice(-MIN_RECENT_TURNS);


  const anchorIds = new Set(anchor);
  const merged = [...anchor];
  for (const msg of recent) {
    if (!anchorIds.has(msg)) {
      merged.push(msg);
    }
  }

  const result = [systemMsg, ...merged];
  if (totalChars(result) <= MAX_CONTEXT_CHARS) {
    return result;
  }

  return [systemMsg, ...recent];
}

// ---------- 统一构建入口 ----------

export interface BuildContextOptions {
  /** 已有的 Turn 列表（不含即将追加的新消息） */
  turns: Turn[];
  /** 当前会话关联的截图 base64（可为 null 表示纯文本追问） */
  captureImageData: string | null;
  /** 本次用户输入 */
  userText: string;
  /** 本次是否附带新截图（首次截图提问时为 true） */
  hasNewImage: boolean;
  /** 是否包含截图（用于系统指令构建） */
  hasImage: boolean;
  /** 用户是否输入了文本问题 */
  hasQuestion: boolean;
}

/**
 * 构建完整的 LLM 请求消息数组。
 *
 * 包含 system prompt + 历史上下文（已截断）+ 当前用户消息。
 */
export function buildContextMessages(options: BuildContextOptions): ChatMessage[] {
  const {
    turns,
    captureImageData,
    userText,
    hasNewImage,
    hasImage,
    hasQuestion,
  } = options;

  const systemPrompt = buildSystemPrompt(hasImage, hasQuestion);

  const historyMessages = turnsToMessages(turns, captureImageData);

  const currentUserMsg: ChatMessage = hasNewImage
    ? { role: "user", content: buildUserContent(captureImageData, userText || undefined) }
    : { role: "user", content: userText };

  const allMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    currentUserMsg,
  ];

  return truncateMessages(allMessages);
}
