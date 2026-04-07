# 步骤 04：模型适配层与老师式回答主链路

状态：Done  
目标版本：V0 / MVP

## 目标

跑通 `截图 + 文本问题 -> 多模态模型 -> 老师式回答` 的主链路。

## 依赖

- [step-00-tech-foundation.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-00-tech-foundation.md)
- [step-02-capture-and-submit.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-02-capture-and-submit.md)
- [step-03-local-conversations-and-archive.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-03-local-conversations-and-archive.md)

## 任务

1. ~~定义统一 `ModelAdapter` 接口。~~ ✓ `adapter.ts`
2. ~~接入 OpenAI provider 骨架。~~ ✓ `openai.ts`
3. ~~接入 Qwen provider 骨架。~~ ✓ `qwen.ts`
4. ~~统一模型请求结构~~ ✓ `types.ts` (ChatMessage 支持图片+文本)
5. ~~统一模型响应结构~~ ✓ `types.ts` (ChatResponse, RouteMetadata)
6. ~~实现老师式回答模板或系统指令。~~ ✓ `prompt.ts` (SRS FR-033)
7. ~~将回答渲染到侧边窗。~~ ✓ SidebarApp + ChatView (流式 + Markdown)

## 产出

- ✅ 模型适配层 (`src/services/llm/`)
- ✅ OpenAI / Qwen provider 接入骨架
- ✅ 老师式回答主链路 (截图/文本 → 流式回答 → Markdown 渲染)

## 完成标准

- ✅ 用户提交截图后能看到老师式结构回答
- ✅ 上层 UI 不直接耦合具体 provider SDK

## 验证

- 手动验证截图 + 问题问答
- 手动验证仅截图默认解释
- 人工检查回答结构是否符合老师式讲解

## 已解决的 TBD

- `TBD-1` OpenAI 首选模型 ID → `gpt-4o`（可通过 `VITE_OPENAI_MODEL` 配置）
- `TBD-2` Qwen 首选模型 ID → `qwen-plus`（可通过 `VITE_QWEN_MODEL` 配置）
- `TBD-3` provider 适配层协议 → 统一 OpenAI-compatible 基础适配器，具体 provider 仅配置差异
