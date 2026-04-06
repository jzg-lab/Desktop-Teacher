import test from "node:test";
import assert from "node:assert/strict";

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 2) return "昨天";
  return `${diffDay}天前`;
}

test.describe("formatRelativeTime", () => {
  test.it("returns 刚刚 for less than 1 minute", () => {
    assert.equal(formatRelativeTime(new Date().toISOString()), "刚刚");
  });

  test.it("returns X分钟前 for minutes", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    assert.equal(formatRelativeTime(fiveMinAgo), "5分钟前");
  });

  test.it("returns X小时前 for hours", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    assert.equal(formatRelativeTime(twoHoursAgo), "2小时前");
  });

  test.it("returns 昨天 for 1-2 days", () => {
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    assert.equal(formatRelativeTime(thirtyHoursAgo), "昨天");
  });

  test.it("returns X天前 for older dates", () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(formatRelativeTime(fiveDaysAgo), "5天前");
  });
});

test.describe("Storage types module", () => {
  test.it("imports successfully (types are TS interfaces, erased at runtime)", async () => {
    const types = await import("../services/storage/types.ts");
    assert.ok(types);
  });
});

test.describe("ConversationContext module exports", () => {
  test.it("exports ConversationProvider and useConversationContext", async () => {
    const mod = await import("../hooks/ConversationContext.tsx");
    assert.equal(typeof mod.ConversationProvider, "function");
    assert.equal(typeof mod.useConversationContext, "function");
  });
});
