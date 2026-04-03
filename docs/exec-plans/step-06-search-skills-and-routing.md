# 步骤 06：搜索 Skill、来源提取与路由控制

状态：Planned  
目标版本：V0 / MVP

## 目标

补上 V0 唯一允许的外部能力，并严格控制调用边界。

## 依赖

- [step-04-model-adapter-and-answering.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-04-model-adapter-and-answering.md)
- [step-05-follow-up-chat.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-05-follow-up-chat.md)

## 任务

1. 实现联网搜索 skill。
2. 实现网页来源提取 skill。
3. 实现手动联网触发入口。
4. 实现自动联网路由规则。
5. 在 UI 中显示工具调用状态。
6. 在回答中展示来源。
7. 禁止白名单外能力调用。

## 产出

- 搜索与来源提取能力
- 路由规则实现
- 来源展示 UI

## 完成标准

- 手动搜索可返回带来源结果
- 自动联网时用户能看到状态提示
- 白名单外能力不可触发

## 验证

- 手动验证显式搜索问题
- 手动验证自动联网问题
- 手动验证白名单边界
