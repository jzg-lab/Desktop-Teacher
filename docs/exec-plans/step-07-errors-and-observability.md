# 步骤 07：错误处理、状态反馈与可观测性

状态：Active  
目标版本：V0 / MVP

## 目标

避免产品在失败时看起来像"没反应"，并让后续排查有抓手。

## 依赖

- [step-01-desktop-shell-and-avatar.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-01-desktop-shell-and-avatar.md)
- [step-04-model-adapter-and-answering.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-04-model-adapter-and-answering.md)
- [step-06-search-skills-and-routing.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-06-search-skills-and-routing.md)

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

- ✅ 错误提示与重试能力（`errors.ts` 分类 + SidebarApp 错误横幅）
- ✅ 状态反馈联动（已有 AvatarStatus，扩展了错误分类）
- ✅ 请求链路诊断信息（`logger.ts` 环形缓冲区 + 便捷方法）

## 完成标准

- ✅ 任一失败场景下，用户都知道发生了什么
- ✅ 开发者可区分 provider 错误、网络错误和路由错误

## 验证

- 人工模拟 provider 失败
- 人工模拟网络失败
- 检查诊断信息是否足够排查

## 实现详情

### 新增模块

- **`src/services/logger.ts`**：诊断日志模块（NFR-030），内存环形缓冲区（200条），开发模式输出到控制台。提供 `logRequestDiagnostic`、`logSkillDiagnostic`、`logNetworkStatus` 便捷方法，以及通用 `logInfo/logWarn/logError/logDebug` 和 `exportLogAsText`。
- **`src/services/errors.ts`**：错误分类模块。将 `LLMProviderError`、`SkillError`、网络错误、未知错误统一分类为 `ClassifiedError`（含 kind、userMessage、retryable 标记）。支持中文用户提示，针对 HTTP 401/403/429/5xx 等状态码提供明确消息。提供 `checkNetworkAvailability()` 基于 `navigator.onLine`。

### 修改模块

- **`src/hooks/ConversationContext.tsx`**：状态新增 `lastError: ClassifiedError | null`，action 新增 `setLastError` 和 `clearError`。所有状态重置场景同步清空 `lastError`。
- **`src/components/SidebarApp.tsx`**：
  - 错误处理：try/catch 中使用 `classifyError()` 代替静默 `setStatus("error")`，设置 `lastError` 使错误提示具体化。
  - 重试：新增 `handleRetry`，基于 `lastRequestRef` 保存的请求参数重试最近一次失败请求。
  - 网络预检：提交前使用 `checkNetworkAvailability()` 检查网络，失败时立即提示。
  - 诊断日志：在 `streamAndSave` 中调用 `logRequestDiagnostic` 记录成功请求信息。
  - 错误横幅：在侧边栏底部显示 `lastError`，包含用户可读消息、重试按钮（仅 retryable 错误）、关闭按钮。
- **`src/services/llm/client.ts`**：在 `chatWithTools` 的 skill 调用循环中，为每个 `executeToolCall` 添加 `logSkillDiagnostic` 调用，记录 skill 调用的成功/失败、延迟、错误信息。
- **`src/services/llm/openai-compatible.ts`**：`chat` 和 `chatStream` 的 HTTP 错误路径添加 `logError`。流式解析 `JSON.parse` 失败时添加 `logWarn`。
- **`src/services/skills/tavily.ts`**：`search` 和 `extract` 的 HTTP 错误路径添加 `logError`。
- **`src/services/storage/conversation.ts`**：关键存储操作（`loadIndex`、`createConversation`、`deleteConversation`、`appendTurn`）添加 `logError`/`logInfo` 日志。
- **`src/App.css`**：新增错误横幅样式（`.error-banner` 及子元素），支持亮色/暗色模式。
