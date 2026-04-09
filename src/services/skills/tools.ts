/**
 * OpenAI function calling 工具定义 — 白名单
 *
 * V0 仅允许两个工具：联网搜索和网页来源提取。
 * 这些定义直接传给 LLM API 的 tools 参数。
 * 类型复用 llm/types.ts 中的 ToolDefinition，消除重复定义。
 */

import type { ToolDefinition } from "../llm/types";

export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "联网搜索。当用户要求搜索、查找资料、获取最新信息、或问题需要实时数据时使用。搜索结果会附带来源 URL。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词，应精准描述需要查找的内容",
        },
      },
      required: ["query"],
    },
  },
};

export const WEB_EXTRACT_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "web_extract",
    description:
      "从指定网页 URL 提取正文内容。当需要从搜索结果中深入阅读某个页面，或用户提供了具体 URL 要求总结页面内容时使用。",
    parameters: {
      type: "object",
      properties: {
        urls: {
          type: "string",
          description: "要提取内容的网页 URL，多个 URL 用逗号分隔",
        },
      },
      required: ["urls"],
    },
  },
};

export const ALLOWED_TOOLS: ToolDefinition[] = [WEB_SEARCH_TOOL, WEB_EXTRACT_TOOL];