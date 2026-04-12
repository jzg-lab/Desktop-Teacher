import type { MessageContent, TextContent, ImageContent, ToolDefinition } from "./types";

import { ALLOWED_TOOLS } from "../skills/tools";

// 老师式回答系统指令 (SRS FR-033: 这是什么/为什么重要/如何理解)

/** @param hasImage 是否包含截图 @param hasQuestion 用户是否输入了文本问题 */
export function buildSystemPrompt(hasImage: boolean, hasQuestion: boolean): string {
  const base = `你是一位耐心、清晰的 AI 老师。你的职责是帮助学习者理解他们遇到的内容。

回答原则：
1. 使用中文回答
2. 结构清晰，先给出结论或概要，再展开细节
3. 用通俗易懂的语言，避免不必要的术语堆砌
4. 如果涉及技术内容，优先给出排查思路或理解路径，而非仅输出结论
5. 如果你对内容不确定，明确说出来，不要编造
6. 适当使用 Markdown 格式（标题、列表、代码块、粗体）让回答更易读`;

  const withImage = hasImage
    ? `

关于截图：
- 仔细观察截图中所有可见内容（文字、图表、界面、代码、公式等）
- 如果截图中有报错信息，解释含义并给出排查方向
- 如果截图中有代码，逐行或逐段分析关键逻辑`

    : "";

  const noQuestion = hasImage && !hasQuestion
    ? `

当前用户仅提交了截图，没有输入具体问题。请主动对截图内容进行全面解释：
1. **这是什么**：识别并描述截图中的主要内容
2. **为什么重要**：解释这些内容在什么场景下有意义
3. **如何理解**：给出理解该内容的方法或下一步建议`
    : "";

const searchCapability = `
关于联网搜索能力：
- 你可以使用 web_search 工具搜索互联网上的最新信息
- 你可以使用 web_extract 工具提取网页内容
- 当用户要求"搜索"、"查资料"、"最新信息"、"新闻"、"查一下"时，应主动调用 web_search
- 当你需要实时数据、最新事件、或不确定的信息时，也应调用搜索
- 搜索后必须在回答中附带来源链接
- 如果用户没有要求搜索且你有信心直接回答，不要滥用搜索`;

  const followUp = !hasImage
    ? `
关于追问：
- 你可以引用之前对话中讨论过的内容
- 如果用户追问的内容与之前截图有关，结合之前的分析继续回答
- 保持回答的连贯性，不要重复已经解释过的内容`
    : "";

  return base + withImage + noQuestion + searchCapability + followUp;
}

export function getSearchTools(): ToolDefinition[] {
  return ALLOWED_TOOLS;
}

export function buildUserContent(
  imageData: string | null,
  textQuestion?: string,
): MessageContent {
  if (!imageData) {
    return textQuestion ?? "请解释这张截图中的内容";
  }

  const imageUrl = imageData.startsWith("data:") ? imageData : `data:image/png;base64,${imageData}`;

  const parts: Array<TextContent | ImageContent> = [
    { type: "image_url", image_url: { url: imageUrl } },
  ];

  parts.push({ type: "text", text: textQuestion || "请解释这张截图中的内容" });

  return parts;
}
