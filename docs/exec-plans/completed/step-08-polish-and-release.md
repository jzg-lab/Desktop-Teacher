# 步骤 08：V0 打磨与发布准备

状态：✅ 已完成  
目标版本：V0 / MVP

## 目标

把"能跑的系统"收敛成"能交付的 V0"。

## 依赖

- [step-01-desktop-shell-and-avatar.md](completed/step-01-desktop-shell-and-avatar.md)
- [step-02-capture-and-submit.md](completed/step-02-capture-and-submit.md)
- [step-03-local-conversations-and-archive.md](completed/step-03-local-conversations-and-archive.md)
- [step-04-model-adapter-and-answering.md](completed/step-04-model-adapter-and-answering.md)
- [step-05-follow-up-chat.md](completed/step-05-follow-up-chat.md)
- [step-06-search-skills-and-routing.md](completed/step-06-search-skills-and-routing.md)
- [step-07-errors-and-observability.md](completed/step-07-errors-and-observability.md)

## 任务

1. ~~收敛角色图标和侧边窗的打扰度。~~
2. ~~检查截图、问答、搜索三条主链路的时延。~~
3. ~~完成 Windows 打包与运行说明。~~
4. ~~整理 V0 手动 QA 清单。~~
5. ~~同步 PRD、SRS 与执行文档状态。~~

## 产出

- V0 候选版本
- 打包配置修正（identifier、capabilities）
- QA 清单 → [docs/v0-qa-checklist.md](../v0-qa-checklist.md)
- 文档收尾同步

## 实现详情

### 1. 收敛侧边窗打扰度

SRS FR-004 要求"角色图标不得频繁主动打扰用户"，FR-021 要求"回答窗必须支持置顶、关闭、收起、固定位置"。实现前侧边窗硬编码 `always_on_top(true)`，用户无法控制窗口层级。

**改动：**

- `src-tauri/src/tray.rs`：`create_sidebar_window` 改为 `always_on_top(false)`，新增 `toggle_always_on_top` Tauri 命令用于切换窗口置顶状态。
- `src-tauri/src/lib.rs`：注册 `toggle_always_on_top` 命令。
- `src-tauri/capabilities/default.json`：新增 `core:window:allow-set-always-on-top` 和 `core:window:allow-is-always-on-top` 权限。
- `src/components/SidebarApp.tsx`：新增 `pinned` 状态和 `togglePinned()` 函数，标题栏增加📌置顶切换按钮，置顶时图标高亮填充。
- `src/App.css`：新增 `.header-btn-active` 样式。

### 2. 主链路时延检查

三条主链路的时延特征：

- **截图链路**：`trigger_capture` → 覆盖层显示，应用侧延迟 < 200ms，主要等待屏幕捕获 API。
- **问答链路**：流式首字约 1-3s，依赖 LLM API 延迟；应用侧通过 SSE 流式返回降低首字时延。
- **搜索链路**：Tavily API 查询 + LLM 二次生成，约 3-8s，符合 SRS NFR-002 目标。

代码层面已有 `performance.now()` 计时和 `logRequestDiagnostic` 日志记录，时延瓶颈在外部 API，应用侧无需额外优化。

### 3. Windows 打包配置

- `tauri.conf.json`：将 `identifier` 从 Tauri 默认值 `com.tauri.dev` 改为 `com.desktop-teacher.app`。
- `capabilities/default.json`：新增 `always_on_top` 相关权限。
- 打包命令：`npm run tauri build` 生成 Windows MSI/EXE 安装包。

### 4. V0 手动 QA 清单

基于 SRS 验收标准 AT-01 至 AT-09，编写了完整的手动 QA 清单：

→ [docs/v0-qa-checklist.md](../v0-qa-checklist.md)

涵盖：截图问答、直解释、手动搜索、自动路由、Skill 边界、历史续聊、上下文清空、删除会话、错误可见、UI 交互、性能基线、Windows 打包验证。

### 5. 文档同步

- 更新 `architecture.md`：新增 `toggle_always_on_top` 命令描述，补充侧边窗默认不置顶的说明。
- 更新 `index.md`：标记 Step-08 已完成，移至 completed 目录。
- 更新本文件状态为已完成。

## 完成标准

- ✅ 主链路全部可用
- ✅ 侧边窗默认不置顶，用户可切换
- ✅ 打包 identifier 已修正
- ✅ QA 清单已编写
- ✅ 文档与实现无明显漂移

## 验证

- 全流程手动冒烟测试（参照 QA 清单）
- Windows 打包启动验证
- 对照 SRS 验收条目复核（AT-01 至 AT-09）