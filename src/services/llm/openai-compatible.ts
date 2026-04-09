/**
 * OpenAI-compatible adapter base — shared by OpenAI and Qwen adapters
 *
 * Both providers use identical chat/completions endpoints with SSE streaming.
 * Only name, default base URL, and default model differ.
 */

import type { ChatRequest, ChatResponse, ChatStreamChunk } from "./types";
import type { ProviderAdapter } from "./adapter";
import { wrapHttpError } from "./adapter";
import { logError, logWarn } from "../logger";

export interface OpenAICompatibleConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
}

export abstract class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly name: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: OpenAICompatibleConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.defaultModel = config.defaultModel;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(req, false)),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      logError("llm", `${this.name} chat HTTP error`, { status: res.status, provider: this.name });
      throw wrapHttpError(this.name, res.status, body);
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
      const body = await res.json().catch(() => ({}));
      logError("llm", `${this.name} chatStream HTTP error`, { status: res.status, provider: this.name });
      throw wrapHttpError(this.name, res.status, body);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      logError("llm", `${this.name} stream: no response body`);
      throw new Error("No response body for streaming");
    }

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
        try {
          yield JSON.parse(data) as ChatStreamChunk;
        } catch {
          logWarn("llm", `${this.name} stream: failed to parse chunk`, { data: data.slice(0, 100) });
        }
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
    const body: Record<string, unknown> = {
      model: req.model || this.defaultModel,
      messages: req.messages,
      stream,
      ...(req.temperature != null && { temperature: req.temperature }),
      ...(req.max_tokens != null && { max_tokens: req.max_tokens }),
    };

    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools;
      if (req.tool_choice) {
        body.tool_choice = req.tool_choice;
      }
    }

    return body;
  }
}
