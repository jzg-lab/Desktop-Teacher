import { LLMProviderError } from "./llm/adapter";
import { SkillError } from "./skills/tavily";
import { logError, logNetworkStatus } from "./logger";

export type ErrorKind =
  | "network"
  | "provider"
  | "skill"
  | "storage"
  | "unknown";

export interface ClassifiedError {
  kind: ErrorKind;
  userMessage: string;
  retryable: boolean;
  originalError: unknown;
}

const NETWORK_MESSAGES: Record<string, string> = {
  Failed_to_fetch: "无法连接到服务器，请检查网络连接",
  NetworkError: "网络错误，请检查网络设置",
  TypeError_Failed_to_fetch: "无法连接到服务器，请检查网络连接",
};

const PROVIDER_MESSAGES: Record<string, string> = {
  HTTP_401: "API Key 无效，请在设置中检查您的密钥",
  HTTP_403: "访问被拒绝，请检查 API Key 权限",
  HTTP_429: "请求过于频繁，请稍后重试",
  HTTP_500: "服务器内部错误，请稍后重试",
  HTTP_502: "服务器网关错误，请稍后重试",
  HTTP_503: "服务暂时不可用，请稍后重试",
};

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && (err.message === "Failed to fetch" || err.message.includes("NetworkError"))) {
    return true;
  }
  if (err instanceof SkillError && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
    return true;
  }
  if (err instanceof LLMProviderError && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
    return true;
  }
  return false;
}

export function classifyError(err: unknown): ClassifiedError {
  if (err instanceof LLMProviderError) {
    const userMessage = PROVIDER_MESSAGES[err.code]
      ?? (err.retryable ? "请求暂时失败，请稍后重试" : `请求失败（${err.code}）`);
    logError("llm", "LLM 调用失败", {
      code: err.code,
      provider: err.provider,
      retryable: err.retryable,
    });
    return {
      kind: "provider",
      userMessage,
      retryable: err.retryable,
      originalError: err,
    };
  }

  if (err instanceof SkillError) {
    const userMessage = err.retryable
      ? `搜索服务暂时不可用，请稍后重试（${err.code}）`
      : `搜索调用失败（${err.code}）`;
    logError("skill", "Skill 调用失败", {
      code: err.code,
      retryable: err.retryable,
    });
    return {
      kind: "skill",
      userMessage,
      retryable: err.retryable,
      originalError: err,
    };
  }

  if (isNetworkError(err)) {
    logNetworkStatus({ online: false, message: String(err) });
    const key = err instanceof TypeError ? `TypeError_${err.message}` : "Failed_to_fetch";
    const userMessage = NETWORK_MESSAGES[key] ?? NETWORK_MESSAGES.Failed_to_fetch;
    return {
      kind: "network",
      userMessage,
      retryable: true,
      originalError: err,
    };
  }

  if (err instanceof Error) {
    const msg = err.message ?? "";
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("NetworkError") || msg.includes("ERR_INTERNET")) {
      logNetworkStatus({ online: false, message: msg });
      return {
        kind: "network",
        userMessage: NETWORK_MESSAGES.Failed_to_fetch,
        retryable: true,
        originalError: err,
      };
    }
  }

  logError("system", "未分类错误", { error: String(err) });
  return {
    kind: "unknown",
    userMessage: "发生了未知错误，请重试",
    retryable: false,
    originalError: err,
  };
}

export function checkNetworkAvailability(): boolean {
  return navigator.onLine;
}