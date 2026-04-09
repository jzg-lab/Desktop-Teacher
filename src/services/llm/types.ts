/**
 * 统一 LLM 适配层类型定义
 *
 * 所有 provider 通过这套类型与上层业务交互，
 * 上层代码不依赖任何具体 provider 的 SDK 类型。
 */

// ---------- 消息 ----------

export type Role = "system" | "user" | "assistant" | "tool";

export type TextContent = { type: "text"; text: string };

export type ImageContent = {
  type: "image_url";
  image_url: { url: string };
};

export type MessageContent = string | Array<TextContent | ImageContent>;

export interface ToolCallFunction {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: ToolCallFunction;
}

export interface ChatMessage {
  role: Role;
  content: MessageContent;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

// ---------- 工具定义（传给 LLM API 的 tools 参数） ----------

export interface ToolFunctionDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

export interface ToolDefinition {
  type: "function";
  function: ToolFunctionDef;
}

// ---------- 请求 ----------

export interface ChatRequest {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: ToolDefinition[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
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
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
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

export type { RouteType } from "../storage/types";
import type { RouteType } from "../storage/types";

export interface RouteMetadata {
  route_type: RouteType;
  provider: string;
  model: string;
  latency_ms: number;
  skill_invoked: boolean;
}

// ---------- 工具调用循环结果 ----------

export interface ChatWithToolsResult {
  text: string;
  route: RouteMetadata;
  sources: Array<{
    id: string;
    title: string;
    url: string;
    snippet: string;
  }>;
}

// ---------- 错误 ----------

export interface LLMError {
  code: string;
  message: string;
  provider: string;
  retryable: boolean;
}
