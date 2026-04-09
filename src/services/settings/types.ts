export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface TavilyConfig {
  apiKey: string;
}

export interface AppSettings {
  defaultProvider: string;
  openai: ProviderConfig | null;
  qwen: ProviderConfig | null;
  tavily: TavilyConfig | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultProvider: "openai",
  openai: null,
  qwen: null,
  tavily: null,
};