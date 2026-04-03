/**
 * ProviderAdapter — 所有 LLM provider 必须实现的统一接口
 *
 * 设计原则：
 * - 上层业务只调用这个接口，不感知具体 provider
 * - 每个 provider 的差异（base URL、认证方式、请求格式微调）封装在具体实现里
 * - 基于 OpenAI-compatible 格式，因为 Qwen/DashScope 和 OpenAI 都支持
 */

import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  LLMError,
} from "./types";

export interface ProviderAdapter {
  /** provider 唯一标识，如 "openai"、"qwen" */
  readonly name: string;

  /** 非流式聊天 */
  chat(req: ChatRequest): Promise<ChatResponse>;

  /** 流式聊天，返回 AsyncIterable */
  chatStream(req: ChatRequest): AsyncIterable<ChatStreamChunk>;
}

/** 从 provider 抛出的可识别错误 */
export class LLMProviderError extends Error {
  readonly code: string;
  readonly provider: string;
  readonly retryable: boolean;

  constructor(error: LLMError) {
    super(error.message);
    this.name = "LLMProviderError";
    this.code = error.code;
    this.provider = error.provider;
    this.retryable = error.retryable;
  }
}

/**
 * 将 HTTP 响应中的错误统一转换为 LLMProviderError
 * 子类在 catch 块里调用此方法即可
 */
export function wrapHttpError(
  provider: string,
  status: number,
  body: Record<string, unknown>,
): LLMProviderError {
  const retryable = status === 429 || status >= 500;
  const message =
    (body.error as Record<string, string>)?.message ??
    `HTTP ${status} from ${provider}`;

  return new LLMProviderError({
    code: `HTTP_${status}`,
    message,
    provider,
    retryable,
  });
}
