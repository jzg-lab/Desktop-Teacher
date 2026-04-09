export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AppSettings {
  defaultProvider: string;
  openai: ProviderConfig | null;
  qwen: ProviderConfig | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultProvider: "openai",
  openai: null,
  qwen: null,
};