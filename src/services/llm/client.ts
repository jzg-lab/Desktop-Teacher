/**
 * UnifiedLLMClient — 统一 LLM 调用入口
 *
 * 上层业务通过此类发送请求，无需知道底层用的是 OpenAI 还是 Qwen。
 * 支持多 provider 注册、默认 provider 切换、以及按需路由。
 * chatWithTools 支持完整的工具调用循环：LLM 返回 tool_calls → 执行 → 继续生成。
 */

import type {
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  ChatMessage,
  RouteMetadata,
  ChatWithToolsResult,
  ToolCall,
} from "./types";
import type { ProviderAdapter } from "./adapter";
import { OpenAIAdapter, type OpenAIConfig } from "./openai";
import { QwenAdapter, type QwenConfig } from "./qwen";
import { executeToolCall } from "../skills/executor";
import type { SourceRef } from "../skills/types";

export interface LLMClientConfig {
  defaultProvider: string;
  openai?: OpenAIConfig;
  qwen?: QwenConfig;
  tavilyApiKey?: string;
}

export type SkillStatusCallback = (status: {
  type: "searching" | "extracting" | "done" | "error";
  query?: string;
  url?: string;
  error?: string;
}) => void;

export class UnifiedLLMClient {
  private readonly providers = new Map<string, ProviderAdapter>();
  private defaultProvider: string;
  private tavilyApiKey: string;

  constructor(config: LLMClientConfig) {
    this.defaultProvider = config.defaultProvider;
    this.tavilyApiKey = config.tavilyApiKey ?? "";

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

  setTavilyApiKey(key: string): void {
    this.tavilyApiKey = key;
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

  async chatWithTools(
    req: ChatRequest,
    onStatus?: SkillStatusCallback,
    maxIterations = 3,
  ): Promise<ChatWithToolsResult> {
    const start = performance.now();
    const providerName = this.defaultProvider;
    const allSources: SourceRef[] = [];
    let routeType: RouteMetadata["route_type"] = "direct";
    let skillInvoked = false;
    let currentMessages = [...req.messages];

    const tools = req.tools;

    for (let i = 0; i < maxIterations; i++) {
      const response = await this.chat({
        ...req,
        messages: currentMessages,
        tools,
        stream: false,
      });

      const choice = response.response.choices[0];
      if (!choice) break;

      const assistantMessage = choice.message;

      const toolCalls = assistantMessage.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        const text = typeof assistantMessage.content === "string"
          ? assistantMessage.content
          : "";
        return {
          text,
          route: {
            route_type: routeType,
            provider: providerName,
            model: response.response.model,
            latency_ms: Math.round(performance.now() - start),
            skill_invoked: skillInvoked,
          },
          sources: allSources,
        };
      }

      currentMessages.push(assistantMessage);

      for (const tc of toolCalls) {
        const fn = tc.function;
        if (fn.name === "web_search") {
          onStatus?.({ type: "searching", query: JSON.parse(fn.arguments).query });
        } else if (fn.name === "web_extract") {
          onStatus?.({ type: "extracting", url: JSON.parse(fn.arguments).urls });
        }

        const result = await executeToolCall(this.tavilyApiKey, fn);

        if (result.success) {
          skillInvoked = true;
          routeType = result.routeType;
          allSources.push(...result.sources);
        }

        const resultContent = result.resultContent
          ?? (result.success ? "工具调用成功" : `工具调用失败: ${result.error}`);

        currentMessages.push({
          role: "tool",
          content: resultContent,
          tool_call_id: tc.id,
        });
      }
    }

    const finalResponse = await this.chat({
      ...req,
      messages: currentMessages,
      tools: [],
      stream: false,
    });

    const finalText = typeof finalResponse.response.choices[0]?.message.content === "string"
      ? finalResponse.response.choices[0].message.content as string
      : "";

    return {
      text: finalText,
      route: {
        route_type: routeType,
        provider: providerName,
        model: finalResponse.response.model,
        latency_ms: Math.round(performance.now() - start),
        skill_invoked: skillInvoked,
      },
      sources: allSources,
    };
  }

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

import type { SkillExecutionResult } from "../skills/types";