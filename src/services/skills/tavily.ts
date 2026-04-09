/**
 * Tavily API 客户端 — 搜索 + 提取
 *
 * 提供 search() 和 extract() 两个方法，
 * 分别对应 Tavily 的搜索 API 和提取 API。
 * 错误统一以 SkillError 抛出。
 */

import type { SearchResponse, ExtractResponse } from "./types";

export class SkillError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "SkillError";
    this.code = code;
    this.retryable = retryable;
  }
}

function tavilyBaseUrl(): string {
  return import.meta.env.VITE_TAVILY_BASE_URL || "https://api.tavily.com";
}

export async function search(
  apiKey: string,
  query: string,
  opts?: { maxResults?: number; searchDepth?: "basic" | "advanced" },
): Promise<SearchResponse> {
  const url = `${tavilyBaseUrl()}/search`;
  const body = {
    api_key: apiKey,
    query,
    max_results: opts?.maxResults ?? 5,
    search_depth: opts?.searchDepth ?? "basic",
    include_answer: true,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    const text = await res.text().catch(() => "");
    throw new SkillError(
      `HTTP_${res.status}`,
      `Tavily search failed: ${res.status} ${text}`,
      retryable,
    );
  }

  const data = await res.json() as TavilySearchRaw;

  return {
    query: data.query,
    answer: data.answer ?? undefined,
    results: (data.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: r.content ?? "",
      score: r.score,
    })),
  };
}

export async function extract(
  apiKey: string,
  urls: string[],
): Promise<ExtractResponse> {
  const url = `${tavilyBaseUrl()}/extract`;
  const body = {
    api_key: apiKey,
    urls,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    const text = await res.text().catch(() => "");
    throw new SkillError(
      `HTTP_${res.status}`,
      `Tavily extract failed: ${res.status} ${text}`,
      retryable,
    );
  }

  const data = await res.json() as TavilyExtractRaw;

  return {
    results: (data.results ?? []).map((r) => ({
      url: r.url ?? "",
      content: r.text ?? "",
    })),
    failed: (data.failed ?? []).map((f) => ({
      url: f.url ?? "",
      error: f.error ?? "unknown",
    })),
  };
}

// ---- Tavily 原始响应类型（内部使用） ----

interface TavilySearchRaw {
  query: string;
  answer?: string | null;
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    score?: number;
  }>;
}

interface TavilyExtractRaw {
  results?: Array<{
    url?: string;
    text?: string;
  }>;
  failed?: Array<{
    url?: string;
    error?: string;
  }>;
}