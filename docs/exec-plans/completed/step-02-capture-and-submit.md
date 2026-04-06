# 步骤 02：截图触发与提交链路

状态：Done  
目标版本：V0 / MVP

## 目标

跑通 `快捷键截图 -> 确认 -> 提交` 的最小输入链路。

## 依赖

- [step-00-tech-foundation.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-00-tech-foundation.md)
- [step-01-desktop-shell-and-avatar.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-01-desktop-shell-and-avatar.md)

## 任务

1. 注册全局快捷键。
2. 实现区域截图。
3. 实现当前窗口截图。
4. 实现截图确认界面。
5. 实现取消、重截、提交交互。
6. 支持截图后输入可选文本问题。
7. 定义统一的截图提交对象。

## 产出

- 快捷键截图能力
- 截图确认与输入界面
- `CaptureRequest` 输入模型

## 完成标准

- 用户可以完成区域截图和窗口截图
- 用户可在提交前取消或重截
- 提交结果包含图片和可选文本问题

## 验证

- 手动验证区域截图
- 手动验证窗口截图
- 手动验证取消与重新提交
