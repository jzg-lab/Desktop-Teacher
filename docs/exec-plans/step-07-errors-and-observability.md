# 步骤 07：错误处理、状态反馈与可观测性

状态：Planned  
目标版本：V0 / MVP

## 目标

避免产品在失败时看起来像“没反应”，并让后续排查有抓手。

## 依赖

- [step-01-desktop-shell-and-avatar.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-01-desktop-shell-and-avatar.md)
- [step-04-model-adapter-and-answering.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-04-model-adapter-and-answering.md)
- [step-06-search-skills-and-routing.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-06-search-skills-and-routing.md)

## 任务

1. 为模型失败提供显式错误提示。
2. 为搜索和来源提取失败提供显式错误提示。
3. 实现重试入口。
4. 让角色图标和侧边窗联动显示处理中 / 错误状态。
5. 记录最小诊断信息：
   - 请求时间
   - 路由方式
   - 是否调用 skill
   - 成功 / 失败状态
6. 明确网络不可用时的反馈。

## 产出

- 错误提示与重试能力
- 状态反馈联动
- 请求链路诊断信息

## 完成标准

- 任一失败场景下，用户都知道发生了什么
- 开发者可区分 provider 错误、网络错误和路由错误

## 验证

- 人工模拟 provider 失败
- 人工模拟网络失败
- 检查诊断信息是否足够排查
