import type { ProviderAdapter } from "./adapter";
import { OpenAICompatibleAdapter } from "./openai-compatible";

export interface QwenConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

export class QwenAdapter extends OpenAICompatibleAdapter implements ProviderAdapter {
  readonly name = "qwen";

  constructor(config: QwenConfig) {
    super({
      name: "qwen",
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
      defaultModel: config.defaultModel ?? "qwen-plus",
    });
  }
}
