import { UnifiedLLMClient, type LLMClientConfig } from "./client";
import type { AppSettings } from "../settings/types";

function envStr(key: string): string | undefined {
  return import.meta.env[key] as string | undefined;
}

function resolveDefaultProvider(config: LLMClientConfig): string {
  if (config[config.defaultProvider as keyof LLMClientConfig]) {
    return config.defaultProvider;
  }
  if (config.openai) return "openai";
  if (config.qwen) return "qwen";
  return config.defaultProvider;
}

function configFromEnv(): LLMClientConfig {
  const openaiKey = envStr("VITE_OPENAI_API_KEY");
  const qwenKey = envStr("VITE_QWEN_API_KEY");

  const config: LLMClientConfig = {
    defaultProvider: resolveDefaultProvider({
      defaultProvider: envStr("VITE_LLM_DEFAULT_PROVIDER") ?? "openai",
      ...(openaiKey ? { openai: { apiKey: openaiKey, baseUrl: envStr("VITE_OPENAI_BASE_URL"), defaultModel: envStr("VITE_OPENAI_MODEL") } } : {}),
      ...(qwenKey ? { qwen: { apiKey: qwenKey, baseUrl: envStr("VITE_QWEN_BASE_URL"), defaultModel: envStr("VITE_QWEN_MODEL") } } : {}),
    }),
  };

  if (openaiKey) {
    config.openai = { apiKey: openaiKey, baseUrl: envStr("VITE_OPENAI_BASE_URL"), defaultModel: envStr("VITE_OPENAI_MODEL") };
  }
  if (qwenKey) {
    config.qwen = { apiKey: qwenKey, baseUrl: envStr("VITE_QWEN_BASE_URL"), defaultModel: envStr("VITE_QWEN_MODEL") };
  }
  if (envStr("VITE_TAVILY_API_KEY")) {
    config.tavilyApiKey = envStr("VITE_TAVILY_API_KEY");
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
  if (settings.tavily) {
    config.tavilyApiKey = settings.tavily.apiKey;
  }

  return config;
}

function mergeConfig(settings: AppSettings): LLMClientConfig {
  const envConfig = configFromEnv();
  const uiConfig = configFromSettings(settings);

  const merged: LLMClientConfig = {
    defaultProvider: uiConfig.defaultProvider || envConfig.defaultProvider,
    openai: uiConfig.openai?.apiKey ? uiConfig.openai : envConfig.openai,
    qwen: uiConfig.qwen?.apiKey ? uiConfig.qwen : envConfig.qwen,
    tavilyApiKey: uiConfig.tavilyApiKey || envConfig.tavilyApiKey,
  };

  merged.defaultProvider = resolveDefaultProvider(merged);
  return merged;
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