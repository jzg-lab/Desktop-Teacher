# 架构文档

状态：Active
范围：V0 / MVP

本文档描述 Desktop Teacher 的实际系统架构、层级边界、数据实体生命周期和失败边界。
产品需求见 [prd-v0.md](prd-v0.md)，系统需求见 [srs-v0.md](srs-v0.md)。

## 1. 系统概览

Desktop Teacher 是一个基于 Tauri 2 的 Windows 桌面应用，由两层组成：

- **Rust 后端**（`src-tauri/`）：操作系统集成（全局快捷键、截图、系统托盘）+ 本地文件存储。
- **React 前端**（`src/`）：UI 渲染 + LLM 适配层（在 WebView 中直接发起 HTTP 调用）。

两层通过 Tauri 的 `invoke` / `listen` 机制通信，不经过 HTTP。

```
┌──────────────────────────────────────────────────────────┐
│                    用户 (Windows)                          │
└───────────────┬─────────────────────┬────────────────────┘
                │ 全局快捷键           │ 侧边窗交互
┌───────────────▼──────────┐  ┌────────▼──────────────┐
│   Rust 后端 (Tauri 2)    │  │  React 前端 (WebView)  │
│                          │  │                        │
│  ┌─ tray.rs ──────────┐  │  │  ┌─ SidebarApp ─────┐ │
│  │  系统托盘 / 窗口管理 │  │  │  │  聊天主界面       │ │
│  └────────────────────┘  │  │  └──────────────────┘ │
│  ┌─ capture.rs ────────┐  │  │  ┌─ CaptureOverlay ─┐ │
│  │  截图 / 裁剪 / 覆盖层 │◄─┼──┼─►│  区域选择 UI     │ │
│  └────────────────────┘  │  │  └──────────────────┘ │
│  ┌─ lib.rs (存储命令) ──┐  │  │  ┌─ CaptureConfirm ┐ │
│  │  会话 CRUD / Turn 追加│◄─┼──┼─►│  确认 + 提交     │ │
│  └────────────────────┘  │  │  └──────────────────┘ │
│                          │  │  ┌─ services/llm/ ──┐ │
│  本地文件系统             │  │  │  统一 LLM 适配层  │──────► OpenAI / Qwen API
│  (JSON + 附件目录)       │  │  └──────────────────┘ │
│                          │  │  ┌─ services/skills/ ┐│ │
│                          │  │  │  搜索 + 提取 Skill │──────► Tavily API
│                          │  │  └──────────────────┘ │
└──────────────────────────┘  └────────────────────────┘
```

## 2. 层级职责

### 2.1 Rust 后端

| 模块 | 文件 | 职责 |
|------|------|------|
| 应用入口 | `lib.rs` | 组装插件、注册命令、启动窗口 |
| 截图 | `capture.rs` | 屏幕截图、区域裁剪、窗口定位、覆盖层生命周期（仅 Windows） |
| 窗口工具 | `window_utils.rs` | 侧边窗/覆盖层定位、显示/隐藏 |
| 系统托盘 | `tray.rs` | 托盘图标、右键菜单、窗口唤起 |
| 存储命令 | `lib.rs` 内 | 会话索引读写、会话 CRUD、Turn 追加 |
| 设置命令 | `lib.rs` 内 | 应用设置加载/保存（Provider、API Key 等） |
| 数据目录 | 自动管理 | `app_data_dir/conversations/` + `app_data_dir/settings.json` |

**后端暴露的 Tauri 命令**：

| 命令 | 功能 | 前端调用方 |
|------|------|-----------|
| `storage_load_index` | 加载会话列表索引 | storage service |
| `storage_save_index` | 保存索引 | storage service |
| `storage_create_conversation` | 创建新会话（含目录结构） | storage service |
| `storage_get_conversation` | 获取单条会话元数据 | storage service |
| `storage_update_conversation_title` | 更新会话标题 | storage service |
| `storage_delete_conversation` | 删除会话及目录 | storage service |
| `storage_load_turns` | 加载会话的所有 Turn | storage service |
| `storage_append_turn` | 追加一条 Turn | storage service |
| `settings_load` | 加载应用设置 | settings service |
| `settings_save` | 保存应用设置 | settings service |
| `capture_get_screenshot` | 获取当前截图（base64 PNG） | CaptureOverlay |
| `capture_crop_region` | 按坐标裁剪截图 | CaptureOverlay |
| `capture_window_at_point` | 截取指定坐标处的窗口 | CaptureOverlay |
| `capture_cancel` | 取消截图流程 | CaptureOverlay |
| `capture_confirm_selection` | 确认选区并唤起侧边窗 | CaptureOverlay |

### 2.2 React 前端

| 模块 | 路径 | 职责 |
|------|------|------|
| 应用入口 | `src/main.tsx` → `src/App.tsx` | 根据 window label 渲染不同视图 |
| 侧边主界面 | `src/components/SidebarApp.tsx` | 聊天交互、状态展示、事件监听、错误横幅、网络预检、重试 |
| 截图覆盖层 | `src/components/CaptureOverlay.tsx` | 区域选择、鼠标交互、后端截图调用 |
| 截图确认 | `src/components/CaptureConfirm.tsx` | 预览 + 问题输入 + 提交 |
| 设置弹窗 | `src/components/SettingsModal.tsx` | Provider 选择、API Key / URL / 模型配置、Tavily API Key |
| LLM 适配层 | `src/services/llm/` | 统一 provider 抽象、HTTP 调用、流式响应、工具调用循环 |
| Skill 层 | `src/services/skills/` | 联网搜索 + 网页提取（Tavily）、工具执行器、白名单定义 |
| 错误分类 | `src/services/errors.ts` | `classifyError` 统一错误分类 + 日志，`checkNetworkAvailability` 网络预检 |
| 诊断日志 | `src/services/logger.ts` | 分类缓冲区日志（llm/skill/storage/network/ui/system），`exportLogAsText` 导出 |
| 存储服务 | `src/services/storage/` | 封装 Tauri 存储命令 |
| 设置服务 | `src/services/settings/` | 封装 Tauri 设置命令（加载/保存） |
| 类型定义 | `src/types/`、各 service/types.ts | 跨层共享的实体类型 |

**前端路由方式**：无路由库。`App.tsx` 根据当前窗口的 `label` 决定渲染 `CaptureOverlay` 还是 `SidebarApp`。

### 2.3 LLM 适配层

```
src/services/llm/
  types.ts             # 统一类型（ChatMessage, ChatRequest, ChatResponse, ToolCall, RouteMetadata 等）
  adapter.ts           # ProviderAdapter 接口 + LLMProviderError
  openai-compatible.ts # OpenAI-compatible 基础适配器（HTTP + SSE streaming + tools 支持）
  openai.ts            # OpenAI 具体适配器（默认 model: gpt-4o）
  qwen.ts              # Qwen/DashScope 具体适配器（默认 model: qwen-plus）
  client.ts            # UnifiedLLMClient — provider 注册表 + 路由 + chatWithTools 工具调用循环
  init.ts              # LLMClient 初始化（设置 UI 优先 → 环境变量回退，含 Tavily API Key）
  prompt.ts            # 老师式系统指令构建 (SRS FR-033) + 联网搜索能力说明 + 工具定义
  context.ts           # 线程上下文管理（Turn→ChatMessage 转换 + 截断策略 + tool 角色消息）
  index.ts             # 统一导出
```

**关键设计**：

- 所有 provider 共享 `ProviderAdapter` 接口（`chat` / `chatStream`）。
- OpenAI 和 Qwen 都继承 `OpenAICompatibleAdapter`，只配置 baseURL / apiKey / model。
- 新增 provider 只需实现 `ProviderAdapter` 或继承基础适配器。
- `UnifiedLLMClient` 维护 provider 注册表，根据默认 provider 或显式指定路由到具体适配器。
- `chatWithTools` 方法实现完整的工具调用循环：LLM 返回 tool_calls → 执行对应 skill → 将结果加入消息 → 继续生成，最多迭代 3 轮。
- LLM 调用在前端 WebView 中直接发起 HTTP，不经 Rust 后端。
- `init.ts` 提供两个函数：`getLLMClient()` 返回当前缓存的客户端（首次从环境变量创建），`rebuildLLMClient(settings)` 从设置 UI 配置重建客户端。配置来源优先级：UI 设置 > 环境变量。保存设置时立即调用 `rebuildLLMClient` 刷新客户端。
- `prompt.ts` 构建老师式系统指令（SRS FR-033：这是什么/为什么重要/如何理解），追问时附带上下文衔接提示，并包含联网搜索能力说明；`buildUserContent` 返回 `MessageContent` 类型（string 或多模态数组），统一与 LLM 层类型系统；`getSearchTools()` 返回白名单工具定义。
- `context.ts` 管理线程上下文：将 Turn[] 转换为 LLM ChatMessage[]，首条 user Turn 携带截图，追问时历史上下文自动传递；支持 tool 角色消息和 tool_calls 字段的转换；定义上下文长度上限（`MAX_CONTEXT_CHARS=16000`，约 4000 tokens）和 Turn 上限（`MAX_CONTEXT_TURNS=20`）；截断策略保留 system prompt + 首条 user（含截图）+ 首条 assistant 回复作为锚点，然后保留最近 4 条 Turn，超限时从中间丢弃。

### 2.4 Skill 层（联网搜索 + 来源提取）

```
src/services/skills/
  types.ts    # 搜索结果、提取结果、工具调用状态、来源引用等类型
  tavily.ts   # Tavily API 客户端（search + extract）
  tools.ts    # OpenAI function calling 工具定义（白名单：web_search + web_extract）
  executor.ts # 工具执行器：接收 tool_call → 调用对应 skill → 返回格式化结果
  index.ts    # 统一导出
```

**关键设计**：

- Skill 白名单严格遵守 SRS FR-042：V0 仅允许 `web_search` 和 `web_extract` 两个工具。
- `web_search` 调用 Tavily Search API，返回结构化搜索结果 + 直接回答（如有）。
- `web_extract` 调用 Tavily Extract API，从指定 URL 提取正文内容。
- 工具定义通过 `getSearchTools()` 返回，传给 LLM API 的 `tools` 参数。
- 执行器 `executeToolCall` 解析 LLM 返回的 tool_call，路由到对应 skill 函数。
- 搜索结果格式化为 Markdown 后作为 tool role 消息返回给 LLM 继续生成最终回答。
- 来源信息（SourceRef）提取后传递给 UI 展示。

### 2.5 流式回答与工具调用流程

```
直答模式（direct）：
  SidebarApp → buildContextMessages()   构建 ChatMessage[]
             → getLLMClient().chatStream()
             → for-await 累积文本
             → ConversationContext.streamingText（React state）
             → ChatView 实时显示
             → appendTurn("assistant", fullText, "direct") 持久化

搜索/提取模式（search/extraction）：
  SidebarApp → buildContextMessages()   构建 ChatMessage[]（含 tools 参数）
             → getLLMClient().chatWithTools()
             → LLM 返回 tool_calls
             → UI 显示 SkillCallInfo 状态（"正在搜索..."）
             → executeToolCall() → Tavily API
             → 结果作为 tool role 消息加入上下文
             → LLM 继续生成最终回答（含来源引用）
             → appendTurn("assistant", fullText, routeType) 持久化
             → setSources() 展示来源链接
```

- `buildContextMessages()` 统一构建 LLM 请求消息数组，处理首次截图提问和追问两种场景。
- 模型回答通过 SSE 流式返回（直答模式）或非流式+工具调用循环（搜索模式）。
- 流式期间 `streamingText` 保持在 React state 中，不写入存储。
- 流完成后一次性 `appendTurn` 写入本地 Turn。
- ChatView 使用 `react-markdown` 渲染 assistant 消息中的 Markdown 内容。
- 工具调用期间 `SkillCallInfo` 状态实时反馈给用户（SRS FR-045）。
- 搜索完成后 `sources`（SourceRef[]）传递给 ChatView 展示来源链接（SRS FR-046）。
- 追问时截图上下文保留：`ConversationContext.threadImageData` 保存当前线程关联的截图 base64，关闭窗口时清空。首条 user Turn 通过 `buildUserContent` 携带截图，后续追问可引用。`SidebarApp` 中 `pendingCaptureImage` 用于待确认的截图预览，确认后存入 `threadImageData`。
- 上下文截断：当历史 Turn 总字符数超过 `MAX_CONTEXT_CHARS`（16000）或 Turn 数超过 `MAX_CONTEXT_TURNS`（20），按策略截断——始终保留首条 user+assistant 对（含截图锚点）和最近 4 条 Turn。

### 2.4 存储层

```
app_data_dir/
  settings.json                    # 应用设置（provider 配置、API key 等）
  conversations/
    conversations-index.json      # 全局会话索引
    {conversation-id}/
      meta.json                   # ConversationMeta
      messages.json               # Turn[]
      attachments/                # 附件目录（预留）
```

**数据格式**：全部为 JSON，使用 `serde_json`（Rust 侧）和 JSON.parse/stringify（前端侧）。

**一致性保证**：每次写操作（创建/更新/删除会话、追加 Turn）都会同步更新索引文件。无事务机制——如果进程在写操作中途崩溃，可能出现文件不一致。

## 3. 核心数据实体

### 3.1 实体关系

```
ConversationIndex
  └─ ConversationMeta[]  (1:N)
       └─ Turn[]          (1:N, 按时间追加)
            └─ Attachment  (1:N, 预留)

CaptureRequest           (瞬时，不持久化)
  ├─ imageData           (base64 PNG)
  ├─ textQuestion?       (可选文本)
  └─ timestamp

ChatMessage              (LLM 交互单元)
   ├─ role                (system | user | assistant | tool)
   ├─ content             (string | TextContent[] + ImageContent[])
   ├─ tool_calls?         (ToolCall[])   ← assistant 消息可含工具调用
   └─ tool_call_id?       (string)       ← tool 角色消息的调用标识

ToolCall                 (工具调用单元)
   ├─ id                  (string)
   ├─ type                ("function")
   └─ function            { name, arguments }

SourceRef                (来源引用，用于 UI 展示)
   ├─ id, title, url, snippet

RouteMetadata            (每轮回答的路由记录)
  ├─ route_type          (direct | search | extraction)
  ├─ provider
  ├─ model
  ├─ latency_ms
  └─ skill_invoked

AppSettings              (应用设置，持久化到 settings.json)
   ├─ defaultProvider     (openai | qwen)
   ├─ openai?             ProviderConfig
   ├─ qwen?               ProviderConfig
   └─ tavily?             TavilyConfig

ProviderConfig           (单个 Provider 的配置)
   ├─ apiKey
   ├─ baseUrl
   └─ model

TavilyConfig             (Tavily 搜索 API 配置)
   └─ apiKey
```

### 3.2 ConversationMeta

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 唯一标识 |
| title | string | 会话标题 |
| created_at | string (RFC3339) | 创建时间 |
| updated_at | string (RFC3339) | 最后更新时间 |
| status | "active" \| "archived" | 会话状态 |

### 3.3 Turn

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string (UUID) | 唯一标识 |
| conversation_id | string | 所属会话 |
| role | "system" \| "user" \| "assistant" \| "tool" | 角色 |
| content | string | 消息内容 |
| route_type | RouteType \| null | 路由策略 |
| tool_calls | unknown \| null | 工具调用数据（assistant 消息） |
| tool_call_id | string \| null | 工具调用标识（tool 消息） |
| created_at | string (RFC3339) | 创建时间 |

### 3.4 ChatMessage（LLM 层）

与 Turn 不同，ChatMessage 直接面向 LLM API：

- `content` 支持 `string` 或 `TextContent[] | ImageContent[]` 数组（用于多模态输入）。
- Turn 存储时 `content` 为纯文本；发送给 LLM 时，截图通过 `ImageContent` 附加。

### 3.5 AppSettings

| 字段 | 类型 | 说明 |
|------|------|------|
| defaultProvider | string | 默认 provider（"openai" / "qwen"） |
| openai | ProviderConfig \| null | OpenAI 配置，null 表示未启用 |
| qwen | ProviderConfig \| null | Qwen 配置，null 表示未启用 |
| tavily | TavilyConfig \| null | Tavily 搜索 API 配置，null 表示未配置 |

### 3.6 ProviderConfig

| 字段 | 类型 | 说明 |
|------|------|------|
| apiKey | string | API Key |
| baseUrl | string | API 端点 URL，空字符串使用默认值 |
| model | string | 模型名，空字符串使用默认值 |

## 4. 关键生命周期

### 4.1 截图 → 回答 流程

```
1. 用户按 Ctrl+Shift+S
2. Rust: global_shortcut 触发 capture::trigger_capture
3. Rust: create_overlay_window → 显示全屏透明覆盖层
4. 前端: CaptureOverlay 渲染，用户拖拽选择区域或点击窗口
5. 前端: 调用 capture_crop_region / capture_window_at_point
6. 前端: 显示 CaptureConfirm（预览 + 问题输入）
7. 前端: 用户确认 → 发出 CaptureRequest
8. Rust: capture_confirm_selection → 显示侧边窗
9. 前端: SidebarApp 收到 capture-selected 事件
10. 前端: 构建 ChatMessage[] → UnifiedLLMClient.chat/chatStream
11. 前端: 将用户提问和模型回答存为 Turn（storage_append_turn）
```

### 4.2 会话生命周期

```
创建: storage_create_conversation → 创建目录 + meta.json + messages.json
使用: storage_append_turn → 追加 Turn 到 messages.json + 更新索引
归档: 更新 ConversationMeta.status = "archived"
删除: storage_delete_conversation → 删除整个会话目录 + 更新索引
续聊: storage_load_turns → 恢复历史 Turn → 继续追加
```

## 5. 外部依赖

### 5.1 LLM Provider

| Provider | 接入方式 | 配置来源 |
|----------|---------|---------|
| OpenAI | HTTPS，OpenAI-compatible API | UI 设置（优先）或 `VITE_OPENAI_*` 环境变量 |
| Qwen (DashScope) | HTTPS，OpenAI-compatible API | UI 设置（优先）或 `VITE_QWEN_*` 环境变量 |

配置优先级：**UI 设置 > 环境变量**。用户通过侧边栏齿轮图标打开设置弹窗配置 Provider、API Key、Base URL 和模型名。保存后立即生效（通过 `rebuildLLMClient` 重建 LLM 客户端实例）。未在 UI 中配置的项回退到环境变量。

### 5.2 搜索 Skill 服务

| 服务 | 接入方式 | 配置来源 |
|------|---------|---------|
| Tavily Search | HTTPS REST API | UI 设置（优先）或 `VITE_TAVILY_API_KEY` 环境变量 |
| Tavily Extract | HTTPS REST API | 同 Tavily API Key |

配置优先级：**UI 设置 > 环境变量**。Tavily API Key 在设置弹窗的"联网搜索"区域单独配置。未配置时联网搜索和网页提取功能不可用，LLM 仍可直答。

### 5.3 操作系统依赖

| 能力 | 实现方式 |
|------|---------|
| 全局快捷键 | `tauri_plugin_global_shortcut` |
| 屏幕截图 | Win32 API（仅 Windows，`#[cfg(target_os = "windows")]`） |
| 系统托盘 | Tauri tray API |
| 窗口管理 | Tauri window API + 自定义定位逻辑 |

### 5.4 环境变量

环境变量作为 UI 设置的回退，通过 Vite 前端注入（`VITE_` 前缀）。优先级低于 UI 设置中填写的值。

| 变量 | 用途 |
|------|------|
| `VITE_LLM_DEFAULT_PROVIDER` | 默认 provider（openai / qwen），UI 设置优先 |
| `VITE_OPENAI_API_KEY` | OpenAI API Key，UI 设置优先 |
| `VITE_OPENAI_BASE_URL` | OpenAI 端点（默认 api.openai.com/v1），UI 设置优先 |
| `VITE_OPENAI_MODEL` | OpenAI 模型（默认 gpt-4o），UI 设置优先 |
| `VITE_QWEN_API_KEY` | DashScope API Key，UI 设置优先 |
| `VITE_QWEN_BASE_URL` | DashScope 端点，UI 设置优先 |
| `VITE_QWEN_MODEL` | Qwen 模型（默认 qwen-plus），UI 设置优先 |
| `VITE_TAVILY_API_KEY` | Tavily 搜索 API Key，UI 设置优先 |
| `VITE_HOTKEY_SCREENSHOT` | 截图快捷键（默认 Ctrl+Shift+S） |

## 6. 失败边界

| 边界 | 失败场景 | 当前处理 | 对应需求 |
|------|---------|---------|---------|
| LLM 调用 | 网络超时 / API 错误 / Key 无效 | `LLMProviderError` 包装，`classifyError` 分类后弹错误横幅，可重试 | FR-060 |
| Skill 调用 | Tavily API 不可用 / Key 未配置 / 超时 | `SkillError` 包装，`classifyError` 分类后弹错误横幅，可重试 | FR-061 |
| 网络不可用 | 离线 / DNS 解析失败 | `checkNetworkAvailability()` 预检 + `classifyError` 分类为 network 错误 | FR-063 |
| 搜索路由 | 白名单外工具调用 | LLM 工具定义仅包含 `web_search` + `web_extract`，其他工具不可触发 | FR-047 |
| 存储写入 | 磁盘满 / 权限不足 | `expect()` panic（未做优雅降级） | 待改进 |
| 截图 | 无屏幕权限 / 多显示器异常 | 覆盖层创建失败时 eprintln 警告 | FR-017 |
| 系统托盘 | 无托盘支持（远程桌面等） | eprintln 警告，继续运行 | — |
| 进程崩溃 | 写操作中途退出 | 无事务机制，可能出现部分写入 | 待改进 |

**错误处理架构**：

`src/services/errors.ts` 的 `classifyError()` 是唯一的错误分类 + 日志入口。所有 try/catch 块将原始错误传给 `classifyError`，由它统一判定 kind（network / provider / skill / unknown）、生成中文 `userMessage`、标记 `retryable`，同时写入诊断日志。throw 站不记日志，catch 端通过 `classifyError` 记。网络错误优先于 `LLMProviderError` / `SkillError` 检测，因为后两者可能包装了 fetch 失败。

`src/services/logger.ts` 提供分类诊断日志（`logInfo` / `logWarn` / `logError`、`logRequestDiagnostic`、`logSkillDiagnostic`、`logNetworkStatus`），内存环形缓冲区 200 条，开发模式自动输出到控制台。`exportLogAsText()` 可导出全量日志文本。

**已知技术债**：

1. 存储层使用 `expect()` 处理 IO 错误，生产环境应改为向前端返回 Result。
2. 无原子写入（write-to-temp + rename），崩溃可能导致 JSON 损坏。
3. 截图功能仅在 Windows 编译（`#[cfg(target_os = "windows")]`），非 Windows 构建缺少捕获能力。
4. 设置保存（`updateSettings`）无 try/catch，错误不会被用户感知。

## 7. 状态管理

当前无全局状态库（Redux / Zustand）。各组件使用：

- **React `useState` / `useEffect`**：组件内局部状态。
- **ConversationContext**：当前活跃会话状态。使用 `INITIAL_STATE` 常量统一重置，包含：会话 ID、Turn 列表、流式文本、线程截图引用 `threadImageData`、视图模式、`skillCallInfo` 工具调用状态、`sources` 来源引用列表、`lastError` 分类错误。action 包括 `setLastError` / `clearError` 用于错误横幅联动。
- **SettingsContext**：应用设置状态（默认 Provider、各 Provider 的 API Key / Base URL / 模型、Tavily API Key），初始化时从 Rust 后端加载，保存时写入本地文件并重建 LLM 客户端。
- **Tauri event bus**（`listen` / `emit`）：Rust → 前端的跨窗口通知（如 `capture-selected`）。
- **Tauri `invoke`**：前端 → Rust 的命令调用。

`threadImageData` 在 `ConversationContext` 中保存当前线程关联的截图数据，确保追问时 LLM 上下文仍可引用截图内容。`SidebarApp` 中 `pendingCaptureImage` 为待确认的截图预览状态，两者职责分离。窗口关闭时自动清空（SRS FR-051）。

`skillCallInfo` 追踪当前工具调用状态（idle/searching/extracting/done/error），`sources` 保存搜索返回的来源引用列表。两者均在会话关闭时清空。手动搜索通过侧边栏头部🔍按钮切换 `forceSearch` 模式，或通过聊天输入框旁的🔍按钮对单条消息强制搜索。
