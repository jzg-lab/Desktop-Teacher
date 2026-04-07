import { UnifiedLLMClient, type LLMClientConfig } from "./client";

const DEFAULT_PROVIDER = import.meta.env.VITE_LLM_DEFAULT_PROVIDER ?? "openai";

function envStr(key: string): string | undefined {
  return import.meta.env[key] as string | undefined;
}

export function createLLMClient(): UnifiedLLMClient {
  const config: LLMClientConfig = {
    defaultProvider: DEFAULT_PROVIDER,
  };

  const openaiKey = envStr("VITE_OPENAI_API_KEY");
  if (openaiKey) {
    config.openai = {
      apiKey: openaiKey,
      baseUrl: envStr("VITE_OPENAI_BASE_URL"),
      defaultModel: envStr("VITE_OPENAI_MODEL"),
    };
  }

  const qwenKey = envStr("VITE_QWEN_API_KEY");
  if (qwenKey) {
    config.qwen = {
      apiKey: qwenKey,
      baseUrl: envStr("VITE_QWEN_BASE_URL"),
      defaultModel: envStr("VITE_QWEN_MODEL"),
    };
  }

  return new UnifiedLLMClient(config);
}

let _client: UnifiedLLMClient | null = null;

export function getLLMClient(): UnifiedLLMClient {
  if (!_client) {
    _client = createLLMClient();
  }
  return _client;
}
