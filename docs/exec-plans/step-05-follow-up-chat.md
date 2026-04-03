# 步骤 05：多轮追问与线程内上下文保持

状态：Planned  
目标版本：V0 / MVP

## 目标

让产品从一次性截图解释器升级成真正可追问的老师助手。

## 依赖

- [step-03-local-conversations-and-archive.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-03-local-conversations-and-archive.md)
- [step-04-model-adapter-and-answering.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-04-model-adapter-and-answering.md)

## 任务

1. 在当前线程内保留多轮上下文。
2. 支持在侧边窗中继续输入问题。
3. 保证追问能引用当前截图和已发生对话。
4. 定义线程内上下文长度上限。
5. 定义上下文截断策略。

## 产出

- 多轮追问能力
- 线程上下文管理策略

## 完成标准

- 用户无需重复上传同一截图即可继续追问
- 当前线程内回答能承接前文语义

## 验证

- 手动进行至少 3 轮连续追问
- 检查关闭窗口后上下文不会自动残留
