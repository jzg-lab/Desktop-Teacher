/**
 * 统一 LLM 适配层类型定义
 *
 * 所有 provider 通过这套类型与上层业务交互，
 * 上层代码不依赖任何具体 provider 的 SDK 类型。
 */

// ---------- 消息 ----------

export type Role = "system" | "user" | "assistant";

export type TextContent = { type: "text"; text: string };

export type ImageContent = {
  type: "image_url";
  image_url: { url: string };
};

export type MessageContent = string | Array<TextContent | ImageContent>;

export interface ChatMessage {
  role: Role;
  content: MessageContent;
}

// ---------- 请求 ----------

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

// ---------- 响应 ----------

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: Usage;
}

// ---------- 流式响应 ----------

export interface StreamDelta {
  role?: Role;
  content?: string;
}

export interface StreamChoice {
  index: number;
  delta: StreamDelta;
  finish_reason: string | null;
}

export interface ChatStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: StreamChoice[];
}

// ---------- 路由元数据（SRS FR-048） ----------

export type RouteType =
  | "direct"          // 纯模型直答
  | "search"          // 搜索增强
  | "extraction";     // 来源提取增强

export interface RouteMetadata {
  route_type: RouteType;
  provider: string;
  model: string;
  latency_ms: number;
  skill_invoked: boolean;
}

// ---------- 错误 ----------

export interface LLMError {
  code: string;
  message: string;
  provider: string;
  retryable: boolean;
}
