/**
 * UnifiedLLMClient — 统一 LLM 调用入口
 *
 * 上层业务通过此类发送请求，无需知道底层用的是 OpenAI 还是 Qwen。
 * 支持多 provider 注册、默认 provider 切换、以及按需路由。
 */

import type { ChatRequest, ChatResponse, ChatStreamChunk, RouteMetadata } from "./types";
import type { ProviderAdapter } from "./adapter";
import { OpenAIAdapter, type OpenAIConfig } from "./openai";
import { QwenAdapter, type QwenConfig } from "./qwen";

export interface LLMClientConfig {
  defaultProvider: string;
  openai?: OpenAIConfig;
  qwen?: QwenConfig;
}

export class UnifiedLLMClient {
  private readonly providers = new Map<string, ProviderAdapter>();
  private defaultProvider: string;

  constructor(config: LLMClientConfig) {
    this.defaultProvider = config.defaultProvider;

    if (config.openai) {
      this.registerProvider(new OpenAIAdapter(config.openai));
    }
    if (config.qwen) {
      this.registerProvider(new QwenAdapter(config.qwen));
    }
  }

  registerProvider(adapter: ProviderAdapter): void {
    this.providers.set(adapter.name, adapter);
  }

  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider "${name}" not registered`);
    }
    this.defaultProvider = name;
  }

  async chat(
    req: ChatRequest,
    providerName?: string,
  ): Promise<{ response: ChatResponse; route: RouteMetadata }> {
    const start = performance.now();
    const name = providerName ?? this.defaultProvider;
    const adapter = this.getAdapter(name);

    const response = await adapter.chat(req);

    const route: RouteMetadata = {
      route_type: "direct",
      provider: name,
      model: response.model,
      latency_ms: Math.round(performance.now() - start),
      skill_invoked: false,
    };

    return { response, route };
  }

  async *chatStream(
    req: ChatRequest,
    providerName?: string,
  ): AsyncIterable<ChatStreamChunk> {
    const name = providerName ?? this.defaultProvider;
    const adapter = this.getAdapter(name);
    yield* adapter.chatStream(req);
  }

  // ---- private ----

  private getAdapter(name: string): ProviderAdapter {
    const adapter = this.providers.get(name);
    if (!adapter) {
      throw new Error(
        `Provider "${name}" not registered. Available: ${[...this.providers.keys()].join(", ")}`,
      );
    }
    return adapter;
  }
}
