import { describe, it, expect } from "vitest";
import {
  turnsToMessages,
  truncateMessages,
  buildContextMessages,
  MAX_CONTEXT_CHARS,
  MAX_CONTEXT_TURNS,
} from "../services/llm/context";
import type { ChatMessage } from "../services/llm/types";
import type { Turn } from "../services/storage/types";

function makeTurn(role: "user" | "assistant", content: string, index: number): Turn {
  return {
    id: `turn-${index}`,
    conversation_id: "conv-1",
    role,
    content,
    route_type: null,
    created_at: new Date(Date.now() + index * 1000).toISOString(),
  };
}

function makeMessages(count: number, charPerMsg: number = 100): ChatMessage[] {
  const sys: ChatMessage = { role: "system", content: "system prompt" };
  const msgs: ChatMessage[] = [sys];
  for (let i = 0; i < count; i++) {
    const role = i % 2 === 0 ? "user" : "assistant";
    const content = "x".repeat(charPerMsg) + `-${i}`;
    msgs.push({ role, content });
  }
  return msgs;
}

// ---------- turnsToMessages ----------

describe("turnsToMessages", () => {
  it("returns empty array for empty turns", () => {
    expect(turnsToMessages([], null)).toEqual([]);
  });

  it("converts turns to ChatMessage array", () => {
    const turns: Turn[] = [
      makeTurn("user", "你好", 0),
      makeTurn("assistant", "你好！有什么可以帮助你的？", 1),
    ];
    const messages = turnsToMessages(turns, null);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[1].role).toBe("assistant");
  });

  it("includes image in first user message when captureImageData is provided", () => {
    const turns: Turn[] = [
      makeTurn("user", "解释截图", 0),
      makeTurn("assistant", "这是...", 1),
    ];
    const messages = turnsToMessages(turns, "base64imagedata");
    expect(messages[0].role).toBe("user");
    expect(Array.isArray(messages[0].content)).toBe(true);
    const parts = messages[0].content as Array<{ type: string }>;
    expect(parts.some((p) => p.type === "image_url")).toBe(true);
  });

  it("does not include image in subsequent user messages", () => {
    const turns: Turn[] = [
      makeTurn("user", "解释截图", 0),
      makeTurn("assistant", "这是...", 1),
      makeTurn("user", "继续追问", 2),
    ];
    const messages = turnsToMessages(turns, "base64imagedata");
    expect(messages[2].role).toBe("user");
    expect(typeof messages[2].content).toBe("string");
    expect(messages[2].content).toBe("继续追问");
  });

  it("filters out system turns", () => {
    const turns: Turn[] = [
      makeTurn("system", "system instruction", 0),
      makeTurn("user", "hello", 1),
    ];
    const messages = turnsToMessages(turns, null);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
  });
});

// ---------- truncateMessages ----------

describe("truncateMessages", () => {
  it("returns messages as-is when under limit", () => {
    const msgs = makeMessages(4, 100);
    const result = truncateMessages(msgs);
    expect(result).toEqual(msgs);
  });

  it("preserves system prompt", () => {
    const msgs = makeMessages(30, 100);
    const result = truncateMessages(msgs);
    expect(result[0].role).toBe("system");
  });

  it("caps at MAX_CONTEXT_TURNS", () => {
    const msgs = makeMessages(30, 100);
    const result = truncateMessages(msgs);
    // system + at most MAX_CONTEXT_TURNS
    expect(result.length).toBeLessThanOrEqual(1 + MAX_CONTEXT_TURNS);
  });

  it("truncates when total chars exceed MAX_CONTEXT_CHARS", () => {
    const largeCharPerMsg = Math.floor(MAX_CONTEXT_CHARS / 5) + 1;
    const msgs = makeMessages(6, largeCharPerMsg);
    const result = truncateMessages(msgs);
    const total = result.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0), 0);
    expect(total).toBeLessThanOrEqual(MAX_CONTEXT_CHARS + 500); // margin for system prompt
  });

  it("preserves first user message as anchor", () => {
    const msgs = makeMessages(10, 100);
    msgs[1] = { role: "user", content: "FIRST-USER-ANCHOR" };
    const result = truncateMessages(msgs);
    const firstUser = result.find(
      (m) => m.role === "user" && typeof m.content === "string" && m.content.includes("FIRST-USER-ANCHOR"),
    );
    expect(firstUser).toBeDefined();
  });

  it("preserves most recent turns", () => {
    const msgs = makeMessages(10, 100);
    const lastMsg = msgs[msgs.length - 1];
    const result = truncateMessages(msgs);
    expect(result[result.length - 1]).toEqual(lastMsg);
  });

  it("handles single message (system only)", () => {
    const msgs: ChatMessage[] = [{ role: "system", content: "system" }];
    const result = truncateMessages(msgs);
    expect(result).toEqual(msgs);
  });
});

// ---------- buildContextMessages ----------

describe("buildContextMessages", () => {
  it("builds messages for initial screenshot question", () => {
    const turns: Turn[] = [];
    const messages = buildContextMessages({
      turns,
      captureImageData: "imgdata",
      userText: "这是什么？",
      hasNewImage: true,
      hasImage: true,
      hasQuestion: true,
    });

    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(Array.isArray(messages[1].content)).toBe(true);
  });

  it("builds messages for text-only follow-up", () => {
    const turns: Turn[] = [
      makeTurn("user", "截图问题", 0),
      makeTurn("assistant", "这是解释...", 1),
    ];
    const messages = buildContextMessages({
      turns,
      captureImageData: "imgdata",
      userText: "继续追问",
      hasNewImage: false,
      hasImage: true,
      hasQuestion: true,
    });

    expect(messages[0].role).toBe("system");
    expect(messages.length).toBeGreaterThanOrEqual(4); // system + 2 history + new user
    const lastMsg = messages[messages.length - 1];
    expect(lastMsg.role).toBe("user");
    expect(lastMsg.content).toBe("继续追问");
  });

  it("includes image in first user message of history when captureImageData exists", () => {
    const turns: Turn[] = [
      makeTurn("user", "解释这个截图", 0),
      makeTurn("assistant", "这是...", 1),
    ];
    const messages = buildContextMessages({
      turns,
      captureImageData: "imgdata",
      userText: "继续",
      hasNewImage: false,
      hasImage: true,
      hasQuestion: true,
    });

    const firstUserInHistory = messages[1];
    expect(firstUserInHistory.role).toBe("user");
    expect(Array.isArray(firstUserInHistory.content)).toBe(true);
  });

  it("works with no capture image for pure text conversations", () => {
    const turns: Turn[] = [
      makeTurn("user", "hello", 0),
      makeTurn("assistant", "hi", 1),
    ];
    const messages = buildContextMessages({
      turns,
      captureImageData: null,
      userText: "how are you",
      hasNewImage: false,
      hasImage: false,
      hasQuestion: true,
    });

    expect(messages.length).toBeGreaterThanOrEqual(4);
    const allContentStrings = messages.every(
      (m) => typeof m.content === "string",
    );
    expect(allContentStrings).toBe(true);
  });

  it("system prompt includes follow-up instructions when hasImage is false", () => {
    const messages = buildContextMessages({
      turns: [],
      captureImageData: null,
      userText: "test",
      hasNewImage: false,
      hasImage: false,
      hasQuestion: true,
    });

    const systemContent = messages[0].content as string;
    expect(systemContent).toContain("追问");
  });

  it("system prompt does not include follow-up section when hasImage is true", () => {
    const messages = buildContextMessages({
      turns: [],
      captureImageData: "img",
      userText: "test",
      hasNewImage: true,
      hasImage: true,
      hasQuestion: true,
    });

    const systemContent = messages[0].content as string;
    expect(systemContent).not.toContain("关于追问");
  });
});
