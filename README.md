# Desktop Teacher

一个面向 Windows 学习者的桌面 AI 老师助手。

当前仓库仍处于规划阶段，代码尚未开始实现。当前以文档为记录系统，后续实现应以这些文档为准，而不是以聊天上下文为准。

## 当前状态

- 产品需求已收敛到 V0
- 系统规格已形成第一版
- 实施计划已拆分为逐步执行文档
- 下一步应从 `步骤 00：技术底座与仓库骨架` 开始

## 文档入口

- 产品需求：[docs/prd-v0.md](/mnt/e/my_github/Desktop-Teacher/docs/prd-v0.md)
- 系统规格：[docs/srs-v0.md](/mnt/e/my_github/Desktop-Teacher/docs/srs-v0.md)
- 执行计划索引：[docs/exec-plans/README.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/README.md)

## V0 关键约束

- 平台：仅 Windows
- 用户：学习者 / 自学者
- 入口：右下角角色图标 + 全局快捷键截图
- 回答：默认老师式讲解
- 历史：本地归档，可续聊，不做跨会话长期记忆
- 输入：V0 不包含语音
- provider：暂定兼容 OpenAI 与 Qwen

## 下一步

先完成 [step-00-tech-foundation.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-00-tech-foundation.md) 的技术选型与仓库骨架搭建，再进入 UI 和截图主链路。
