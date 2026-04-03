/**
 * OpenAI provider 适配器
 *
 * 使用标准 OpenAI-compatible chat/completions 端点。
 * 默认 base URL 指向 OpenAI，但可通过构造参数指向任何兼容端点。
 */

import type { ChatRequest, ChatResponse, ChatStreamChunk } from "./types";
import type { ProviderAdapter } from "./adapter";
import { wrapHttpError } from "./adapter";

export interface OpenAIConfig {
  apiKey: string;
  /** 默认 https://api.openai.com/v1 */
  baseUrl?: string;
  /** 默认使用的模型，可被 ChatRequest.model 覆盖 */
  defaultModel?: string;
}

export class OpenAIAdapter implements ProviderAdapter {
  readonly name = "openai";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: OpenAIConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    this.defaultModel = config.defaultModel ?? "gpt-4o";
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
