/**
 * 诊断日志模块 (NFR-030, FR-062, NFR-031)
 *
 * 记录请求链路诊断（时间/路由/skill/状态），为错误处理提供结构化日志。
 * 日志不含 API Key、截图等敏感数据。
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogCategory = "llm" | "skill" | "storage" | "network" | "ui" | "system";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  meta?: Record<string, unknown>;
}

const MAX_ENTRIES = 200;
const entries: LogEntry[] = [];

function formatEntry(entry: LogEntry): string {
  const metaStr = entry.meta
    ? " " + Object.entries(entry.meta).map(([k, v]) => `${k}=${v}`).join(" ")
    : "";
  return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}${metaStr}`;
}

function write(level: LogLevel, category: LogCategory, message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    meta,
  };

  if (entries.length >= MAX_ENTRIES) {
    entries.shift();
  }
  entries.push(entry);

  if (import.meta.env.DEV) {
    const formatted = formatEntry(entry);
    switch (level) {
      case "error": console.error(formatted); break;
      case "warn": console.warn(formatted); break;
      case "info": console.info(formatted); break;
      case "debug": console.debug(formatted); break;
    }
  }
}

export function logInfo(category: LogCategory, message: string, meta?: Record<string, unknown>): void {
  write("info", category, message, meta);
}

export function logWarn(category: LogCategory, message: string, meta?: Record<string, unknown>): void {
  write("warn", category, message, meta);
}

export function logError(category: LogCategory, message: string, meta?: Record<string, unknown>): void {
  write("error", category, message, meta);
}

export function getLogEntries(): readonly LogEntry[] {
  return [...entries];
}

export function clearLogEntries(): void {
  entries.length = 0;
}

export function exportLogAsText(): string {
  return entries.map(formatEntry).join("\n");
}

export function logRequestDiagnostic(params: {
  routeType: string;
  provider: string;
  model: string;
  skillInvoked: boolean;
  success: boolean;
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
}): void {
  const { routeType, provider, model, skillInvoked, success, latencyMs, errorCode, errorMessage } = params;
  write(success ? "info" : "error", "llm", success ? "请求完成" : "请求失败", {
    route: routeType,
    provider,
    model,
    skill: skillInvoked ? "yes" : "no",
    latency: `${latencyMs}ms`,
    status: success ? "ok" : "fail",
    ...({ ...(errorCode ? { code: errorCode } : {}), ...(errorMessage ? { error: errorMessage } : {}) }),
  });
}

export function logSkillDiagnostic(params: {
  skill: "web_search" | "web_extract";
  success: boolean;
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
  query?: string;
}): void {
  const { skill, success, latencyMs, errorCode, errorMessage, query } = params;
  write(success ? "info" : "error", "skill", success ? `${skill} 调用成功` : `${skill} 调用失败`, {
    skill,
    status: success ? "ok" : "fail",
    latency: `${latencyMs}ms`,
    ...(query ? { query } : {}),
    ...(errorCode ? { code: errorCode } : {}),
    ...(errorMessage ? { error: errorMessage } : {}),
  });
}

export function logNetworkStatus(params: { online: boolean; message?: string }): void {
  write(params.online ? "info" : "warn", "network", params.online ? "网络已连接" : "网络不可用", {
    online: params.online,
    ...(params.message ? { detail: params.message } : {}),
  });
}