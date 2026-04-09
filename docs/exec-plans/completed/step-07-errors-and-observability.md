# 步骤 07：错误处理、状态反馈与可观测性

状态：✅ 已完成  
目标版本：V0 / MVP

## 目标

避免产品在失败时看起来像"没反应"，并让后续排查有抓手。

## 依赖

- step-01-desktop-shell-and-avatar
- step-04-model-adapter-and-answering
- step-06-search-skills-and-routing

## 任务

1. ✅ 为模型失败提供显式错误提示。
2. ✅ 为搜索和来源提取失败提供显式错误提示。
3. ✅ 实现重试入口。
4. ✅ 让角色图标和侧边窗联动显示处理中 / 错误状态。
5. ✅ 记录最小诊断信息：
   - 请求时间
   - 路由方式
   - 是否调用 skill
   - 成功 / 失败状态
6. ✅ 明确网络不可用时的反馈。

## 产出

- ✅ 错误分类与提示（`errors.ts` → `classifyError` 统一入口 + 侧边栏底部错误横幅）
- ✅ 状态反馈联动（AvatarStatus 已有，扩展了错误分类）
- ✅ 请求链路诊断日志（`logger.ts` 环形缓冲区 + 便捷方法）
- ✅ 重试机制（`handleRetry` 基于 `lastRequestRef` 重放最近一次请求）
- ✅ 网络预检（`checkNetworkAvailability` + `handleNetworkCheck`）

## 完成标准

- ✅ 任一失败场景下，用户都知道发生了什么
- ✅ 开发者可区分 provider 错误、网络错误和路由错误

## 验证

- 人工模拟 provider 失败
- 人工模拟网络失败
- 检查诊断信息是否足够排查

## 实现详情

### 架构设计：单一错误入口

`classifyError()` 是唯一的错误分类 + 日志写入入口。throw 站（tavily.ts / conversation.ts）不记日志，只抛出类型化错误；catch 端（SidebarApp.tsx）调用 `classifyError` 完成分类、生成用户消息、写入诊断日志。网络错误优先于 `LLMProviderError` / `SkillError` 检测，因为后两者可能包装了 fetch 失败。

### 新增模块

- **`src/services/logger.ts`**：诊断日志模块（NFR-030）。内存环形缓冲区（200 条），开发模式输出到控制台。分类 `LogCategory`（llm/skill/storage/network/ui/system）+ `LogLevel`（info/warn/error）。提供 `logInfo`/`logWarn`/`logError` 通用方法和 `logRequestDiagnostic`/`logSkillDiagnostic`/`logNetworkStatus` 便捷方法，以及 `exportLogAsText` 导出。
- **`src/services/errors.ts`**：错误分类模块。`isNetworkLikeError()` 优先检测网络错误（避免 LLMProviderError/SkillError 包装 fetch 失败被错误归类）。`classifyError()` 返回 `ClassifiedError`（kind/userMessage/retryable/originalError），同时写入诊断日志。`checkNetworkAvailability()` 基于 `navigator.onLine`。

### 修改模块

- **`src/hooks/ConversationContext.tsx`**：状态新增 `lastError: ClassifiedError | null`，action 新增 `setLastError` 和 `clearError`。使用 `INITIAL_STATE` 常量统一所有状态重置场景（beforeunload / closeConversation / removeConversation / createConversation / openConversation）。
- **`src/components/SidebarApp.tsx`**：
  - 提取 `handleNetworkCheck()`：网络预检 + 设置错误状态，三个提交入口复用。
  - 提取 `handleSkillStatus()`：skill 状态回调，三个入口复用。
  - 重试：`handleRetry` 基于 `lastRequestRef` 重放最近一次请求，重试前清空 `skillCallInfo` 和 `sources`。
  - 错误横幅：侧边栏底部显示 `lastError`，含用户消息、重试按钮（仅 retryable）、关闭按钮。
- **`src/services/llm/client.ts`**：`chatWithTools` 中为每个 `executeToolCall` 添加 `logSkillDiagnostic`。
- **`src/services/llm/openai-compatible.ts`**：HTTP 错误路径 `logError`，流式解析失败 `logWarn`。
- **`src/components/ChatView.tsx`**：接收 `sources` 和 `skillCallInfo` props。
- **`src/App.css`**：错误横幅样式（`.error-banner` 及子元素），亮色/暗色模式。
