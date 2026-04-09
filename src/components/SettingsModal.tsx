import { useState } from "react";
import type { AppSettings, ProviderConfig } from "../services/settings/types";
import { useSettings } from "../hooks/SettingsContext";

interface SettingsModalProps {
  onClose: () => void;
}

const OPENAI_DEFAULTS: ProviderConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o",
};

const QWEN_DEFAULTS: ProviderConfig = {
  apiKey: "",
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "qwen-plus",
};

function ProviderSection({
  label,
  config,
  onChange,
}: {
  label: string;
  config: ProviderConfig | null;
  onChange: (config: ProviderConfig | null) => void;
}) {
  const enabled = config !== null;
  const current = config ?? { apiKey: "", baseUrl: "", model: "" };

  return (
    <div className="settings-section">
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            if (e.target.checked) {
              onChange(label === "OpenAI" ? { ...OPENAI_DEFAULTS } : { ...QWEN_DEFAULTS });
            } else {
              onChange(null);
            }
          }}
        />
        <span className="settings-toggle-label">{label}</span>
      </label>
      {enabled && (
        <div className="settings-fields">
          <div className="settings-field">
            <label className="settings-field-label">API Key</label>
            <input
              type="password"
              className="settings-input"
              value={current.apiKey}
              onChange={(e) => onChange({ ...current, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>
          <div className="settings-field">
            <label className="settings-field-label">Base URL</label>
            <input
              type="text"
              className="settings-input"
              value={current.baseUrl}
              onChange={(e) => onChange({ ...current, baseUrl: e.target.value })}
              placeholder={
                label === "OpenAI"
                  ? OPENAI_DEFAULTS.baseUrl
                  : QWEN_DEFAULTS.baseUrl
              }
            />
          </div>
          <div className="settings-field">
            <label className="settings-field-label">Model</label>
            <input
              type="text"
              className="settings-input"
              value={current.model}
              onChange={(e) => onChange({ ...current, model: e.target.value })}
              placeholder={
                label === "OpenAI"
                  ? OPENAI_DEFAULTS.model
                  : QWEN_DEFAULTS.model
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettings();
  const [form, setForm] = useState<AppSettings>({
    defaultProvider: settings.defaultProvider,
    openai: settings.openai
      ? { ...settings.openai }
      : null,
    qwen: settings.qwen
      ? { ...settings.qwen }
      : null,
  });
  const [saving, setSaving] = useState(false);

  function handleSave() {
    setSaving(true);
    updateSettings(form)
      .then(() => {
        onClose();
      })
      .finally(() => {
        setSaving(false);
      });
  }

  const hasProvider = form.openai || form.qwen;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">设置</h2>
          <button className="header-btn" onClick={onClose} aria-label="关闭设置">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 1L13 13M1 13L13 1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          <div className="settings-section">
            <label className="settings-field-label">默认 Provider</label>
            <select
              className="settings-select"
              value={form.defaultProvider}
              onChange={(e) =>
                setForm({ ...form, defaultProvider: e.target.value })
              }
            >
              <option value="openai">OpenAI</option>
              <option value="qwen">Qwen / 通义千问</option>
            </select>
          </div>

          <ProviderSection
            label="OpenAI"
            config={form.openai}
            onChange={(c) => setForm({ ...form, openai: c })}
          />

          <ProviderSection
            label="Qwen"
            config={form.qwen}
            onChange={(c) => setForm({ ...form, qwen: c })}
          />
        </div>

        <div className="settings-footer">
          <button
            className="confirm-btn confirm-btn-secondary"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="confirm-btn confirm-btn-primary"
            onClick={handleSave}
            disabled={saving || !hasProvider}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}