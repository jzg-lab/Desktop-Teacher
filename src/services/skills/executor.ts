import { search, extract, SkillError } from "./tavily";
import type { SourceRef, SkillExecutionResult } from "./types";

type ToolCallFunction = {
  name: string;
  arguments: string;
};

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
  return Promise.resolve({
    routeType: "search",
    sources: [],
    success: false,
    error: `Unknown tool: ${fn.name}`,
  });
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
    return {
      routeType: "search",
      sources: [],
      success: false,
      error: "Invalid arguments for web_search",
    };
  }

  if (!query.trim()) {
    return {
      routeType: "search",
      sources: [],
      success: false,
      error: "Empty search query",
    };
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
    return {
      routeType: "search",
      sources: [],
      success: false,
      error: message,
    };
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
    return {
      routeType: "extraction",
      sources: [],
      success: false,
      error: "Invalid arguments for web_extract",
    };
  }

  if (urls.length === 0) {
    return {
      routeType: "extraction",
      sources: [],
      success: false,
      error: "No URLs provided",
    };
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
    return {
      routeType: "extraction",
      sources: [],
      success: false,
      error: message,
    };
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