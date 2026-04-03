# 步骤 04：模型适配层与老师式回答主链路

状态：Planned  
目标版本：V0 / MVP

## 目标

跑通 `截图 + 文本问题 -> 多模态模型 -> 老师式回答` 的主链路。

## 依赖

- [step-00-tech-foundation.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-00-tech-foundation.md)
- [step-02-capture-and-submit.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-02-capture-and-submit.md)
- [step-03-local-conversations-and-archive.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-03-local-conversations-and-archive.md)

## 任务

1. 定义统一 `ModelAdapter` 接口。
2. 接入 OpenAI provider 骨架。
3. 接入 Qwen provider 骨架。
4. 统一模型请求结构：
   - 图片
   - 文本问题
   - 当前线程上下文
5. 统一模型响应结构：
   - 回答正文
   - 路由元数据
   - 错误结果
6. 实现老师式回答模板或系统指令。
7. 将回答渲染到侧边窗。

## 产出

- 模型适配层
- OpenAI / Qwen provider 接入骨架
- 老师式回答主链路

## 完成标准

- 用户提交截图后能看到老师式结构回答
- 上层 UI 不直接耦合具体 provider SDK

## 验证

- 手动验证截图 + 问题问答
- 手动验证仅截图默认解释
- 人工检查回答结构是否符合老师式讲解

## 当前仍需细化

1. OpenAI 首选模型 ID
2. Qwen 首选模型 ID
3. provider 适配层最终协议
