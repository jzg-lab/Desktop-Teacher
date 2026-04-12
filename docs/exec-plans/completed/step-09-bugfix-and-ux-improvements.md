# 步骤 09：Bug 修复与 UX 改进

状态：Completed  
目标版本：V0 / MVP  
关联文档：

- [docs/architecture.md](../architecture.md) — 系统架构与数据流
- [docs/srs-v0.md](../srs-v0.md) — 系统需求规格

## 目标

修复 3 个 Bug 并实现 2 个 UX 优化，使侧边栏聊天体验达到可用水平。

## 依赖

- step-02 截图与提交（截图数据流基础）
- step-05 多轮追问与上下文保持（threadImageData 逻辑）
- step-07 错误与可观测性

---

## 问题分析与修复方案

### Bug 1：有对话信息时上边栏消失

**根因分析：**

`ChatView` 渲染在 `.sidebar-body` 内部。`.sidebar-body` 的 CSS 设置了 `flex: 1; display: flex; align-items: center; justify-content: center`，但缺少 `overflow: hidden` 和 `min-height: 0`。当 `.chat-view` 内容很长时：

1. `.sidebar-body` 因为 `align-items: center` 和没有高度约束，会将其内容高度扩张到超过视口。
2. `.sidebar-body` 没有设置 `overflow: hidden`，内容不在此处被裁剪，而是继续撑开。
3. `.sidebar` 是 `height: 100vh` 的 flex column 容器，`.sidebar-header` 有 `flex-shrink: 0`，但当 `.sidebar-body` 内部内容超出时，header 被 flex 布局挤到视口外不可见。

本质上这是 flex 子元素高度溢出导致 header 被挤掉的典型问题。

**修复方案：**

1. `.sidebar-body` 添加 `overflow: hidden; min-height: 0`，确保不会超出父容器。
2. `.sidebar-body` 移除 `align-items: center; justify-content: center`（这两个值让空状态居中，但阻碍了 chat-view 的高度约束）。空状态居中改为 `.empty-state` 自身 `margin: auto` 实现。
3. `.chat-view` 确保有 `min-height: 0; overflow: hidden`。
4. `.chat-turns` 确保有 `min-height: 0`（flex 子内容区域需要此属性才能正确收缩和滚动）。

**涉及的文件：**

| 文件 | 改动 |
|------|------|
| `src/App.css` | `.sidebar-body` 加 `overflow: hidden; min-height: 0`，移除居中属性；`.chat-view` 加 `min-height: 0; overflow: hidden`；`.chat-turns` 加 `min-height: 0` |

---

### Bug 2：截图后历史记录串图 — 会话管理问题

**根因分析：**

用户反馈关闭窗口后继续截图，在同一个对话中出现了串图问题。经过深入分析，核心问题在于**会话生命周期与截图数据的关联设计缺陷**：

1. **`closeConversation()` 重置全部状态**：点击关闭按钮时 `handleClose()` 调用 `closeConversation()`，这会 `setState(INITIAL_STATE)` 清空所有运行时状态（包括 `activeConversation`、`turns`、`threadImageData`）。
2. **新截图绑定新会话**：窗口隐藏后再次截图，`handleSubmit` 检测到 `activeConversation === null`，会调用 `startNewConversation()` 创建新会话。这段逻辑本身是正确的。
3. **同一会话中追加截图才是问题所在**：当用户从历史记录打开一个旧会话，然后截图追问时（`handleChatSend` 路径），`setThreadImageData(request.imageData)` 更新了全局状态，但旧 turn 中没有存储截图数据。`context.ts` 的 `turnsToMessages()` 用全局 `threadImageData` 为第一条 user turn 嵌入图片，导致所有后续追问的上下文都用的是最新截图而非各条 turn 对应的截图。
4. **存储层不存图片**：`Turn` 类型没有 `image_data` 字段，截图数据只存在运行时全局状态中，会话关闭后即丢失。

**修复方案：**

1. **`Turn` 类型扩展**：在 `src/services/storage/types.ts` 新增 `image_data?: string | null` 字段。

2. **存储层适配 — 图片存附件目录**：
   - Rust 后端 `storage_append_turn` 新增 `image_data` 参数。
   - 如果 `image_data` 非空，将 base64 解码后写入 `attachments/{turn_id}.png`，`Turn.image_data` 存 `"attachments/{turn_id}.png"` 引用路径。
   - 加载 turns 时，将图片路径读回为 base64 填入 `Turn.image_data`（或由前端按需加载）。
   - 前端 `appendTurn` 传入 `imageData`（base64 字符串或 null）。

3. **上下文构建修正**：
   - `context.ts` 的 `turnsToMessages()` 改为从每条 `Turn.image_data` 读取截图，而非全局 `threadImageData`。
   - 如果某条 user turn 有 `image_data`，就用它自己的图片；如果没有 `image_data`，就不嵌入图片。
   - 全局 `threadImageData` 仅用于**当前新截图的即时发送**场景（`hasNewImage === true` 时的当前消息），不用于复写历史 turn。

4. **会话管理关键修正 — 关闭窗口 ≠ 关闭会话**：
   - `handleClose()` 当前调用 `closeConversation()` 清空状态。应改为仅隐藏窗口，不清空当前会话。
   - 下次截图时，如果已有 `activeConversation`，应在同一会话中追加 turn（当前逻辑已支持：`handleSubmit` 检测 `activeConversation` 存在就直接追加）。
   - 只有用户主动点击 ChatView 关闭按钮时才真正关闭会话回到空状态。

5. **ChatView 截图预览**：
   - 对有 `image_data` 的 user turn 显示缩略图预览。
   - 点击可放大查看。

**涉及的文件：**

| 文件 | 改动 |
|------|------|
| `src/services/storage/types.ts` | `Turn` 新增 `image_data?: string \| null` |
| `src/services/storage/conversation.ts` | `appendTurn` 新增 `imageData` 参数 |
| `src/hooks/ConversationContext.tsx` | `appendTurn` 签名扩展；`handleClose` 行为调整 |
| `src/services/llm/context.ts` | `turnsToMessages` 从 `Turn.image_data` 读取截图 |
| `src/components/SidebarApp.tsx` | `handleSubmit` 传递 `request.imageData`；`handleClose` 改为仅隐藏 |
| `src/components/ChatView.tsx` | 有 `image_data` 的 user turn 渲染缩略图 |
| `src-tauri/src/lib.rs` | `Turn` struct 新增 `image_data`，`storage_append_turn` 命令适配，附件文件存取 |
| `src/App.css` | 截图缩略图样式 |

---

### Bug 3：无法用滚轮操作界面 / AI 回复完成后看不到全部回复

**根因分析：**

1. `.sidebar-body` 缺少 `overflow: hidden`（Bug 1 的同一根因），导致内容溢出时拖走 header。
2. `.sidebar-body` 的 `align-items: center; justify-content: center` 使 `.chat-view` 无法正确填充可用高度。
3. `.chat-turns` 缺少 `min-height: 0`，flex 子元素默认 `min-height: auto`，导致内容撑开而非滚动。
4. `body { user-select: none }` 在某些 WebView 环境下可能干扰文本区域的滚轮交互。
5. `ChatView.tsx` 的 `scrollIntoView` 仅在 `turns.length` 或 `streamingText` 变化时触发，不处理用户手动滚动后新消息到达的场景。

**修复方案：**

1. 与 Bug 1 合并修复 CSS 布局问题（`.sidebar-body`、`.chat-view`、`.chat-turns` 的 overflow 和 min-height）。
2. `body { user-select: none }` 改为 `.sidebar-header, .sidebar-header button, .header-btn { user-select: none }`，聊天区域保留文本选择和滚轮交互。
3. 自动滚动增强：新增 `isNearBottom` Ref，仅在用户位于底部时自动滚动到最新消息，流式回复结束后强制滚动到底部一次。

**涉及的文件：**

| 文件 | 改动 |
|------|------|
| `src/App.css` | `.sidebar-body`、`.chat-view`、`.chat-turns` 布局与滚动修复（合并 Bug 1） |
| `src/index.css` | 缩小 `user-select: none` 作用域 |
| `src/components/ChatView.tsx` | 底部检测 + 条件自动滚动 |

---

### 优化 1：去除固定占位提示 + 截图提交后不再显示"已提交"

**当前状态：**

1. `viewMode === "empty"` 时显示固定占位文字："按下 Ctrl+Shift+S 截屏提问"。这不是聊天式体验。
2. `CaptureConfirm` 提交后显示 `submitted === true` 状态的确认卡片："截图已提交，等待 AI 老师回答…"。这是固定提示，不符合流式聊天的自然过渡。
3. 聊天输入框 placeholder 是"继续追问…"，暗示追问而非自由输入。

**实现方案：**

1. **移除 CaptureConfirm 的 submitted 状态**：
   - 提交后不再显示确认卡片，直接切到 ChatView 开始流式输出。
   - `handleSubmit` 完成后 `setPendingCaptureImage(null)` 已在现有逻辑中，只需移除 `CaptureConfirm` 的 `submitted` 分支。

2. **空状态改造 — 欢迎卡片**：
   - `SidebarApp` 中 `viewMode === "empty"` 不再显示独立 empty-state 组件，改为让 ChatView 在 `turns.length === 0` 时显示欢迎卡片。
   - 欢迎卡片居中显示：👋 图标 + "欢迎使用 Desktop Teacher" + "截屏提问或直接输入文字"。
   - 视觉风格：圆角卡片、柔和背景、融入聊天流而非独立页面。

3. **输入框 placeholder 更新**：
   - `"继续追问…"` → `"输入问题…"`，更自然的聊天式提示。

**涉及的文件：**

| 文件 | 改动 |
|------|------|
| `src/components/CaptureConfirm.tsx` | 移除 `submitted` 状态和对应的确认卡片 UI |
| `src/components/SidebarApp.tsx` | 移除 empty-state，`viewMode === "empty"` 也渲染 ChatView |
| `src/components/ChatView.tsx` | 新增欢迎卡片：`turns.length === 0` 时显示 |
| `src/App.css` | 欢迎卡片样式；移除/migrate empty-state 样式 |

---

### 优化 2：流式输出体验 — AI 正在思考指示器

**当前状态：**

代码已实现流式输出（`client.chatStream()` + `setStreamingText`），ChatView 已渲染 `streamingText`。但在用户提交到流式文本开始返回之间有一段空白时间，用户看不到任何反馈。用户期望：
- 提交后立即看到"AI 正在思考"的指示器
- 然后流式输出自然过渡，不要突然跳变

**实现方案：**

1. **思考中指示器**：
   - 在 ChatView 中，当 `loading === true && !streamingText` 时，显示动画指示器（脉冲点或旋转图标 + "AI 正在思考…"）。
   - 指示器样式与 assistant 气泡一致，视觉上属于同一条消息。
   - 一旦 `streamingText` 有内容，指示器平滑过渡为流式文字。

2. **流式气泡样式**：
   - 流式文字气泡添加右侧闪烁光标效果（可选，CSS animation）。
   - 指示器和流式文字使用同一个 `.chat-turn-assistant` 容器，避免切换时布局跳动。

3. **Header 状态联动**：
   - `SidebarApp` 的 `status` 已有 `processing: { label: "思考中...", color: "#fbbf24" }` 状态。
   - 目前的 `streamingText` 仅在 `SidebarApp` 的 `streamAndSave` 中设置。在 streaming 开始前，status 就是 "processing"，对应 header 状态点变黄。
   - 确保在 ChatView 中也可见这个状态（当前 ChatView 不显示 status，只在 SidebarApp header）。

**涉及的文件：**

| 文件 | 改动 |
|------|------|
| `src/components/ChatView.tsx` | 新增 `loading && !streamingText` 时的思考中指示器 |
| `src/App.css` | 指示器动画样式；流式光标样式 |

---

## 执行顺序

按优先级和依赖关系排列：

1. **Bug 1 + Bug 3 修复**（header 消失 + 滚动）— 最紧迫，CSS 布局根因相同，一起修
2. **Bug 2 修复**（截图串图 / 会话管理）— 数据正确性，涉及前后端联动
3. **优化 1**（去除固定提示 / 聊天式对话流）— UX 改进
4. **优化 2**（流式输出指示器）— 可独立完成

每一步都应独立可测、可提交。

## ~~优化 1（已移除）：侧边窗口可拖动调整大小~~

> 用户确认窗口已经可以移动和调整大小，此优化不再需要。

## 产出

- Bug 1+3 修复后 header 始终可见、滚动正常
- Bug 2 修复后截图不再串图、会话管理正确
- 优化 1 后的聊天式体验（无固定占位提示、无提交确认卡片）
- 优化 2 后的流式输出 + 思考中指示器
- 所有改动通过手动冒烟测试

## 完成标准

- 有对话信息时 header 始终可见，不消失
- 可正常使用鼠标滚轮在聊天区域上下滚动
- AI 长回复完全可见，滚动顺畅
- 关闭窗口后截图在正确会话中追加，历史截图不串图
- 截图提交后不显示"已提交"固定提示，直接进入流式输出
- 空状态展示欢迎卡片而非固定占位文字
- 流式输出开始前显示"AI 正在思考"指示器

## 验证

1. 截图提问 + 继续追问 → header 始终可见，不消失
2. AI 长回复 → 滚轮可上下滚动，自动定位到最新内容
3. 关闭窗口 → 再次截图 → 新截图加入同一会话（如果会话仍在），或创建新会话
4. 从历史打开旧会话 → 截图追问 → 旧截图保持各自内容
5. 截图提交 → 不显示"已提交"卡片，直接看到"AI 正在思考"
6. 流式输出 → 文字逐步出现，无跳动
7. 空状态 → 显示欢迎卡片，输入框可聚焦