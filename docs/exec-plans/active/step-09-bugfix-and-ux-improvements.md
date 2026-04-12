# 步骤 09：Bug 修复与 UX 改进

状态：Planned  
目标版本：V0 / MVP  
关联文档：

- [docs/architecture.md](../architecture.md) — 系统架构与数据流
- [docs/srs-v0.md](../srs-v0.md) — 系统需求规格

## 目标

修复 2 个已知 Bug 并实现 2 个 UX 优化，使侧边栏聊天体验达到可用水平。

## 依赖

- step-02 截图与提交（截图数据流基础）
- step-05 多轮追问与上下文保持（threadImageData 逻辑）
- step-07 错误与可观测性

---

## 问题分析与修复方案

### Bug 1：截图后所有历史记录的截图变成同一张

**根因分析：**

`ConversationContext` 维护了全局单例状态 `threadImageData: string | null`，每次截图命中 `setThreadImageData(request.imageData)` 时会覆盖此值为最新截图。而在 `context.ts` 的 `turnsToMessages()` 中，构建 LLM 上下文时只对 `firstUserTurn` 嵌入当前 `threadImageData`，这意味着：

1. 截图数据从未持久化到 `Turn` 记录中，只保存在运行时全局状态。
2. 当加载旧会话时，`threadImageData` 可能为 `null` 或最新截图，导致第一条 user 消息挂载了错误的图片。
3. 如果一张截图的 base64 占数百 KB，每条 Turn 都存一份不现实，但当前完全不存就导致历史截图丢失。

此外，`ChatView.tsx` 渲染 user turn 时只展示 `turn.content` 纯文本，并不渲染历史截图。但 LLM 上下文构建中出现错图就是 Bug。

**修复方案：**

1. **`Turn` 类型扩展**：在 `src/services/storage/types.ts` 的 `Turn` 接口新增 `image_data?: string | null` 字段，用于持久化每条 user turn 关联的截图 base64。

2. **存储层适配**：
   - `src/services/storage/conversation.ts` 的 `appendTurn` 传入 `imageData` 参数。
   - Rust 后端 `src-tauri/src/lib.rs` 的 `Turn` struct 和 `storage_append_turn` 命令新增 `image_data` 字段。
   - 存储时将 `imageData` 写入独立文件 `attachments/{turn_id}.png`（base64 解码后），`Turn` 记录中仅存 `image_data: "{turn_id}.png"` 作为引用路径，避免 JSON 膨胀。

3. **截图保存逻辑**：
   - `SidebarApp.tsx` 的 `handleSubmit` 调用 `appendTurn` 时传入 `imageData`。
   - `ConversationContext.tsx` 的 `appendTurn` 签名扩展以接收并传递 `imageData`。

4. **上下文构建修正**：
   - `context.ts` 的 `turnsToMessages()` 改为从每条 `Turn.image_data` 读取关联截图，而非依赖全局 `threadImageData`。
   - `firstUserTurnHandled` 逻辑调整为：如果某条 user turn 自带 `image_data`，则用其自身的截图；否则不嵌入图片。
   - `threadImageData` 全局状态仍保留用于**新截图追问时**作为当前线程图片（`hasNewImage` 场景），但不用于复写历史 turn。

5. **ChatView 截图预览（可选增强）**：
   - 在 `ChatView.tsx` 中，对有 `image_data` 的 user turn 展示缩略图（复用 `CaptureConfirm` 的 `confirm-thumb` 样式），点击可放大。
   - 图片数据从 `Turn.image_data` 加载，而非全局状态。

**涉及的文件：**

| 文件 | 改动 |
|------|------|
| `src/services/storage/types.ts` | `Turn` 新增 `image_data?: string \| null` |
| `src/services/storage/conversation.ts` | `appendTurn` 新增 `imageData` 参数 |
| `src/hooks/ConversationContext.tsx` | `appendTurn` 签名扩展，传递 `imageData` |
| `src/services/llm/context.ts` | `turnsToMessages` 从 `Turn.image_data` 读取截图 |
| `src/components/SidebarApp.tsx` | `handleSubmit` 传递 `request.imageData` 给 `appendTurn` |
| `src/components/ChatView.tsx` | 有 `image_data` 的 user turn 渲染缩略图 |
| `src-tauri/src/lib.rs` | `Turn` struct 新增 `image_data`，`storage_append_turn` 命令适配 |
| `src/App.css` | 截图缩略图样式 |

---

### Bug 2：无法用滚轮操作界面 / AI 回复完成后看不到全部回复

**根因分析：**

1. `src/index.css` 设置 `body { overflow: hidden; user-select: none }`，这阻止了浏览器默认滚动行为。
2. Tauri WebView 在 Windows 上对鼠标滚轮事件的处理：当 `overflow: hidden` 配合 `data-tauri-drag-region` 头部区域时，滚轮事件可能被吞噬。
3. `.chat-turns` 容器虽有 `overflow-y: auto`，但整体布局中 `.sidebar-body` 设置了 `display: flex; align-items: center; justify-content: center`，当内容较长时可能压缩 `.chat-view` 的高度。
4. `.chat-turns` 缺少 `min-height: 0`（flex 子元素默认 `min-height: auto`），导致内容可能撑开容器而非滚动。

5. `ChatView.tsx` 中的 `scrollIntoView` 只在 `turns.length` 或 `streamingText` 变化时触发，但不处理用户手动滚动后定位到最新消息的场景。

**修复方案：**

1. **CSS 修复 — 滚动容器**：
   - `.sidebar-body` 移除 `align-items: center; justify-content: center`，改为 `overflow: hidden`（由子组件管理自己的滚动）。
   - `.chat-view` 确保 `min-height: 0` 和 `overflow: hidden`。
   - `.chat-turns` 确保 `min-height: 0` 和 `flex-shrink: 1`，让长内容正确滚动而非撑开。
   - 考虑在 `.chat-turns` 添加 `-webkit-overflow-scrolling: touch` 增强 Tauri WebView 滚动体验。

2. **`user-select: none` 缩小范围**：
   - 将 `body { user-select: none }` 改为仅作用于 `.sidebar-header` 和按钮元素，保留 `.chat-turns` 内文本的可选择和滚动行为。

3. **自动滚动增强**：
   - 新增 `useRef` 跟踪用户是否在底部附近（距底部 100px 内），仅在用户位于底部时才自动滚动到最新消息。
   - 流式回复结束后强制滚动到底部一次。

**涉及的文件：**

| 文件 | 改动 |
|------|------|
| `src/index.css` | 缩小 `user-select: none` 和 `overflow: hidden` 作用域 |
| `src/App.css` | `.sidebar-body`、`.chat-view`、`.chat-turns` 布局与滚动修复 |
| `src/components/ChatView.tsx` | 滚动优化：底部检测 + 条件自动滚动 |

---

### 优化 1：侧边窗口可拖动调整大小

**当前状态：**

`tray.rs` 中 `create_sidebar_window` 创建窗口时使用固定宽度 380px、高度 `min(screen_h * 0.75, 720)`，`decorations: false` 不显示原生边框。窗口虽设 `resizable: true`，但没有可见的拖拽手柄，用户不知道可以调整大小。

**实现方案：**

1. **Rust 侧**：保持 `resizable: true`，Tauri WebView 在 Windows 上已支持边框拖拽调整大小（即使 `decorations: false`）。

2. **前端侧 — 尺寸记忆**：
   - 在 `src/services/settings/` 新增 `window_bounds` 持久化（宽度、高度），通过 Tauri 命令 `settings_save/load` 或新增专用命令保存/恢复窗口尺寸。
   - `SidebarApp` 挂载时读取上次的窗口尺寸并应用。
   - 窗口 `resize` 事件触发时防抖保存尺寸。

3. **视觉提示**：
   - 在 `.sidebar` 右下角或边缘增加一个可拖拽调整手柄的可视化指示（如 8×8 三角形 resize handle），hover 时高亮，提示用户可调整大小。
   - 使用 Tauri 的 `data-tauri-drag-region` 确保 header 区域不与 resize 冲突。

4. **最小尺寸约束**：
   - 设置 `.sidebar` 的 `min-width: 320px` 和 `min-height: 480px`，防止缩到不可用。
   - 在 Rust 侧通过 Tauri window API 设置 `min_inner_size`。

**涉及的文件：**

| 文件 | 改动 |
|------|------|
| `src-tauri/src/tray.rs` | 创建窗口时设 `min_inner_size`，读取保存的尺寸 |
| `src-tauri/src/lib.rs` | 新增窗口尺寸保存/加载命令 |
| `src/services/settings/types.ts` | `AppSettings` 新增 `window_bounds` 字段 |
| `src/services/settings/` | 尺寸持久化逻辑 |
| `src/hooks/ConversationContext.tsx` 或新 hook | 窗口 resize 监听 + 保存 |
| `src/components/SidebarApp.tsx` | 初始化时恢复窗口尺寸 |
| `src/App.css` | resize 手柄样式 + `.sidebar` min 尺寸 |

---

### 优化 2：去除固定占位提示，改为聊天式对话流

**当前状态：**

聊天界面在 `viewMode === "empty"` 时显示固定占位文字："按下 Ctrl+Shift+S 截屏提问"和"或右键点击托盘图标开始"。这不是用户期望的聊天式体验——用户希望每次问完问题后，界面像微信/网页聊天一样自然过渡，不弹出固定提示。

**实现方案：**

1. **空状态改造**：
   - 保留首次打开时的引导提示，但改为更轻量的欢迎文字 + 可选的快捷操作卡片（如"截屏提问"按钮），视觉上融入聊天气泡风格。
   - 在 ChatView 中，当 `turns.length === 0` 且 `streamingText === ""` 时，显示欢迎卡片而非独立的 empty-state 组件。

2. **移除重复的固定提示**：
   - 用户提问后，不再恢复到 empty-state，而是保持正常的 chat 视图，输入框始终可用。
   - 当前逻辑已在 `handleClose` 中重置为 empty，但正常对话流程（`activeConversation` 存在时）不会触发——需要确保关闭对话是唯一回到 empty 的路径。

3. **聊天输入框提示语**：
   - 将 `placeholder="继续追问…"` 改为更自然的 `placeholder="输入问题…"`。
   - 对话结束后输入框始终可聚焦，视觉上类似于微信/网页聊天的持久输入框。

4. **欢迎卡片设计**（ChatView 内部）：
   - 对话为空时，在聊天区域居中显示欢迎信息：
     ```
     👋 欢迎使用 Desktop Teacher
     按下 Ctrl+Shift+S 截屏提问，或直接输入文字
     ```
   - 风格：圆角卡片，柔和背景色，图标 + 文字，不要独立页面感。

**涉及的文件：**

| 文件 | 改动 |
|------|------|
| `src/components/SidebarApp.tsx` | 移除或精简 `empty-state`，欢迎逻辑移入 ChatView |
| `src/components/ChatView.tsx` | 新增欢迎卡片，当 `turns.length === 0` 时显示 |
| `src/App.css` | 欢迎卡片样式，移除/migrate empty-state 样式 |

---

## 执行顺序

按优先级和依赖关系排列：

1. **Bug 2 修复**（滚轮/滚动）— 最紧迫，直接影响可用性
2. **Bug 1 修复**（截图历史）— 数据正确性，需修改存储层
3. **优化 2**（聊天式对话流）— UX 改进，依赖 Bug 2 修复后的滚动行为
4. **优化 1**（窗口调整大小）— 独立优化，可最后做

每一步都应独立可测、可提交。

## 产出

- Bug 2 修复后的可用滚动界面
- Bug 1 修复后截图不再串图
- 优化 2 后的聊天式体验
- 优化 1 后的可调整大小侧边栏
- 所有改动通过手动冒烟测试

## 完成标准

- 截图后历史截图保持各自原始内容，不互相覆盖
- 可正常使用鼠标滚轮在聊天区域上下滚动
- AI 长回复完全可见，滚动顺畅
- 对话流程自然连贯，无固定占位干扰
- 侧边窗口可通过拖拽边缘调整大小，尺寸记忆

## 验证

1. 连续截 2 张不同截图提问 → 确认历史中每条保留了各自截图
2. AI 回复超过视口高度 → 滚轮可上下滚动，自动定位到最新内容
3. 关闭对话后重新打开 → 欢迎卡片正常，输入框可聚焦
4. 拖拽侧边窗边缘 → 大小可变，松开后尺寸被记忆