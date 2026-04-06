import type { ProviderAdapter } from "./adapter";
import { OpenAICompatibleAdapter } from "./openai-compatible";

export interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

export class OpenAIAdapter extends OpenAICompatibleAdapter implements ProviderAdapter {
  readonly name = "openai";

  constructor(config: OpenAIConfig) {
    super({
      name: "openai",
      apiKey: config.apiKey,
      baseUrl: config.baseUrl ?? "https://api.openai.com/v1",
      defaultModel: config.defaultModel ?? "gpt-4o",
    });
  }
}
