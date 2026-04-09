import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

export async function loadSettings(): Promise<AppSettings> {
  const raw = await invoke<AppSettings>("settings_load");
  return {
    defaultProvider: raw.defaultProvider || DEFAULT_SETTINGS.defaultProvider,
    openai: raw.openai ?? null,
    qwen: raw.qwen ?? null,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await invoke("settings_save", { settings });
}

export type { AppSettings, ProviderConfig } from "./types";