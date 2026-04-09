import { search, extract, SkillError } from "./tavily";
import type { SourceRef } from "../../storage/types";
import type { SkillExecutionResult } from "./types";

type ToolCallFunction = {
  name: string;
  arguments: string;
};

function fail(
  routeType: "search" | "extraction",
  error: string,
  resultContent: string,
): SkillExecutionResult {
  return { routeType, sources: [], success: false, error, resultContent };
}

export function executeToolCall(
  apiKey: string,
  fn: ToolCallFunction,
): Promise<SkillExecutionResult> {
  if (fn.name === "web_search") {
    return executeSearch(apiKey, fn.arguments);
  }
  if (fn.name === "web_extract") {
    return executeExtract(apiKey, fn.arguments);
  }
  return Promise.resolve(fail("search", `Unknown tool: ${fn.name}`, `不支持的工具调用: ${fn.name}`));
}

async function executeSearch(
  apiKey: string,
  argsJson: string,
): Promise<SkillExecutionResult> {
  let query: string;
  try {
    const parsed = JSON.parse(argsJson) as { query?: string };
    query = parsed.query ?? "";
  } catch {
    return fail("search", "Invalid arguments for web_search", "搜索参数解析失败");
  }

  if (!query.trim()) {
    return fail("search", "Empty search query", "搜索关键词为空");
  }

  try {
    const response = await search(apiKey, query);
    const sources: SourceRef[] = response.results.map((r, i) => ({
      id: `src-${i}`,
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 300),
    }));

    const resultContent = formatSearchResult(query, response, sources);
    return {
      routeType: "search",
      sources,
      success: true,
      resultContent,
    };
  } catch (err) {
    const message = err instanceof SkillError ? err.message : String(err);
    return fail("search", message, `搜索失败: ${message}`);
  }
}

async function executeExtract(
  apiKey: string,
  argsJson: string,
): Promise<SkillExecutionResult> {
  let urls: string[];
  try {
    const parsed = JSON.parse(argsJson) as { urls?: string };
    urls = (parsed.urls ?? "").split(",").map((u) => u.trim()).filter(Boolean);
  } catch {
    return fail("extraction", "Invalid arguments for web_extract", "提取参数解析失败");
  }

  if (urls.length === 0) {
    return fail("extraction", "No URLs provided", "未提供有效的网页 URL");
  }

  try {
    const response = await extract(apiKey, urls);
    const sources: SourceRef[] = response.results.map((r, i) => ({
      id: `ext-${i}`,
      title: new URL(r.url).hostname,
      url: r.url,
      snippet: r.content.slice(0, 300),
    }));

    const resultContent = formatExtractResult(response, sources);
    return {
      routeType: "extraction",
      sources,
      success: true,
      resultContent,
    };
  } catch (err) {
    const message = err instanceof SkillError ? err.message : String(err);
    return fail("extraction", message, `网页提取失败: ${message}`);
  }
}

function formatSearchResult(
  query: string,
  response: { answer?: string; results: Array<{ title: string; url: string; content: string }> },
  sources: SourceRef[],
): string {
  const parts: string[] = [];
  if (response.answer) {
    parts.push(`搜索结果摘要：${response.answer}\n`);
  }
  parts.push(`搜索关键词：${query}\n`);
  parts.push("搜索结果：\n");
  for (const r of response.results.slice(0, 5)) {
    parts.push(`- [${r.title}](${r.url})\n  ${r.content.slice(0, 200)}\n`);
  }
  if (sources.length > 0) {
    parts.push("\n来源引用：\n");
    for (const s of sources) {
      parts.push(`- [${s.title}](${s.url})\n`);
    }
  }
  return parts.join("");
}

function formatExtractResult(
  response: { results: Array<{ url: string; content: string }>; failed: Array<{ url: string; error: string }> },
  sources: SourceRef[],
): string {
  const parts: string[] = [];
  parts.push("网页内容提取结果：\n\n");
  for (const r of response.results) {
    parts.push(`## ${new URL(r.url).hostname}\n\n`);
    parts.push(r.content.slice(0, 2000));
    parts.push("\n\n");
  }
  if (response.failed.length > 0) {
    parts.push("提取失败的页面：\n");
    for (const f of response.failed) {
      parts.push(`- ${f.url}: ${f.error}\n`);
    }
  }
  if (sources.length > 0) {
    parts.push("\n来源引用：\n");
    for (const s of sources) {
      parts.push(`- [${s.title}](${s.url})\n`);
    }
  }
  return parts.join("");
}