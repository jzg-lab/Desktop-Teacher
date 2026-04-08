import { UnifiedLLMClient, type LLMClientConfig } from "./client";
import type { AppSettings } from "../settings/types";

function envStr(key: string): string | undefined {
  return import.meta.env[key] as string | undefined;
}

function configFromEnv(): LLMClientConfig {
  const config: LLMClientConfig = {
    defaultProvider: envStr("VITE_LLM_DEFAULT_PROVIDER") ?? "openai",
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

  return config;
}

function configFromSettings(settings: AppSettings): LLMClientConfig {
  const config: LLMClientConfig = {
    defaultProvider: settings.defaultProvider,
  };

  if (settings.openai) {
    config.openai = {
      apiKey: settings.openai.apiKey,
      baseUrl: settings.openai.baseUrl || undefined,
      defaultModel: settings.openai.model || undefined,
    };
  }

  if (settings.qwen) {
    config.qwen = {
      apiKey: settings.qwen.apiKey,
      baseUrl: settings.qwen.baseUrl || undefined,
      defaultModel: settings.qwen.model || undefined,
    };
  }

  return config;
}

function mergeConfig(settings: AppSettings): LLMClientConfig {
  const envConfig = configFromEnv();
  const uiConfig = configFromSettings(settings);

  return {
    defaultProvider: uiConfig.defaultProvider || envConfig.defaultProvider,
    openai: uiConfig.openai?.apiKey ? uiConfig.openai : envConfig.openai,
    qwen: uiConfig.qwen?.apiKey ? uiConfig.qwen : envConfig.qwen,
  };
}

let _client: UnifiedLLMClient | null = null;

export function getLLMClient(): UnifiedLLMClient {
  if (!_client) {
    _client = new UnifiedLLMClient(configFromEnv());
  }
  return _client;
}

export function rebuildLLMClient(settings: AppSettings): void {
  const config = mergeConfig(settings);
  _client = new UnifiedLLMClient(config);
}