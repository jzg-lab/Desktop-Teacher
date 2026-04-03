/**
 * Qwen / DashScope provider 适配器
 *
 * DashScope 提供 OpenAI-compatible 端点，
 * 因此实现与 OpenAIAdapter 几乎一致，仅默认 base URL 和认证方式不同。
 *
 * 参考：https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope
 */

import type { ChatRequest, ChatResponse, ChatStreamChunk } from "./types";
import type { ProviderAdapter } from "./adapter";
import { wrapHttpError } from "./adapter";

export interface QwenConfig {
  apiKey: string;
  /**
   * DashScope OpenAI-compatible base URL。
   * 国内默认 https://dashscope.aliyuncs.com/compatible-mode/v1
   * 国际默认 https://dashscope-intl.aliyuncs.com/compatible-mode/v1
   */
  baseUrl?: string;
  /** 默认使用的模型 */
  defaultModel?: string;
}

export class QwenAdapter implements ProviderAdapter {
  readonly name = "qwen";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: QwenConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (
      config.baseUrl ??
      "https://dashscope.aliyuncs.com/compatible-mode/v1"
    ).replace(/\/$/, "");
    this.defaultModel = config.defaultModel ?? "qwen-plus";
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(req, false)),
    });

    if (!res.ok) {
      throw wrapHttpError(this.name, res.status, await res.json());
    }
    return (await res.json()) as ChatResponse;
  }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatStreamChunk> {
    const url = `${this.baseUrl}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(req, true)),
    });

    if (!res.ok) {
      throw wrapHttpError(this.name, res.status, await res.json());
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body for streaming");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") return;
        yield JSON.parse(data) as ChatStreamChunk;
      }
    }
  }

  // ---- private ----

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private buildBody(req: ChatRequest, stream: boolean) {
    return {
      model: req.model ?? this.defaultModel,
      messages: req.messages,
      stream,
      ...(req.temperature != null && { temperature: req.temperature }),
      ...(req.max_tokens != null && { max_tokens: req.max_tokens }),
    };
  }
}
