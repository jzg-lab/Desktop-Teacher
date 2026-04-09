/**
 * Skill 层类型定义
 *
 * 定义搜索 skill 和来源提取 skill 的输入输出类型，
 * 以及工具调用状态。来源引用类型统一使用 storage 层定义。
 */

import type { SourceRef } from "../../storage/types";

// ---------- 搜索结果 ----------

export interface SearchResult {
  /** 搜索结果标题 */
  title: string;
  /** 结果网页 URL */
  url: string;
  /** 结果摘要片段 */
  content: string;
  /** 相关度评分（0-1，由搜索 API 返回） */
  score?: number;
}

export interface SearchResponse {
  /** 搜索查询词 */
  query: string;
  /** Tavily 返回的直接回答（如有） */
  answer?: string;
  /** 搜索结果列表 */
  results: SearchResult[];
}

// ---------- 来源提取结果 ----------

export interface ExtractedPage {
  /** 页面 URL */
  url: string;
  /** 提取的文本内容 */
  content: string;
}

export interface ExtractResponse {
  /** 成功提取的页面 */
  results: ExtractedPage[];
  /** 提取失败的页面 */
  failed: Array<{ url: string; error: string }>;
}

// ---------- 工具调用状态（UI 展示用） ----------

export type SkillStatus = "idle" | "searching" | "extracting" | "done" | "error";

export interface SkillCallInfo {
  /** 当前状态 */
  status: SkillStatus;
  /** 搜索查询词（searching 状态时） */
  query?: string;
  /** 提取的 URL（extracting 状态时） */
  url?: string;
  /** 错误信息（error 状态时） */
  error?: string;
}

// ---------- 工具调用循环中的完整结果 ----------

export interface SkillExecutionResult {
  routeType: "search" | "extraction";
  sources: SourceRef[];
  success: boolean;
  error?: string;
  resultContent?: string;
}