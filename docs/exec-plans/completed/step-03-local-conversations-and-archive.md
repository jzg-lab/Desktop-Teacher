# 步骤 03：会话模型与本地历史归档

状态：Done  
目标版本：V0 / MVP

## 目标


把“当前会话”和“历史续聊”分开实现，避免后面把线程归档做成长期记忆黑箱。

## 依赖

- [step-00-tech-foundation.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-00-tech-foundation.md)
- [step-02-capture-and-submit.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-02-capture-and-submit.md)

## 任务

1. 定义 `Conversation / Turn / Attachment / SourceRef` 数据模型。
2. 实现当前线程的运行时上下文。
3. 实现本地历史归档。
4. 实现历史列表。
5. 实现重新打开旧会话并续聊。
6. 实现删除历史会话及关联附件。
7. 确保关闭窗口后清空运行时上下文。

## 产出

- 本地存储层
- 历史会话列表界面
- 删除与续聊能力

## 完成标准

- 新窗口不会自动继承旧上下文
- 用户能从历史会话继续对话
- 用户能删除历史归档

## 已实现

| 1 | 定义 `Conversation / Turn / Attachment / SourceRef` 数据模型 | src/services/storage/types.ts | ✓ |
| 2 | 实现当前线程的运行时上下文 | src/hooks/ConversationContext.tsx (ConversationProvider + useConversationContext) | ✓ |
| 3 | 实现本地历史归档 | Rust 后端 + TS storage service（已完成于 step-00~02） | ✓ |
| 4 | 实现历史列表 | src/components/HistoryList.tsx | ✓ |
| 5 | 实现重新打开旧会话并续聊 | ConversationContext.openConversation + HistoryList 点击 | ✓ |
| 6 | 实现删除历史会话 | HistoryList 炭제确认 + storage.deleteConversation | ✓ |
| 7 | 确保关闭窗口后清空运行时上下文 | ConversationProvider beforeunload 盤 handleClose | ✓ |

## 验证

| - 7/7 node:test 单元测试通过（formatRelativeTime、类型加载、模块导出）
| - TypeScript 编译零错误
| - 运行时上下文关闭后不继承旧会话（ConversationProvider beforeunload + handleClose）
