# V0 执行计划索引

状态：Active  
范围：V0 / MVP  
关联文档：

- [docs/prd-v0.md](/mnt/e/my_github/Desktop-Teacher/docs/prd-v0.md)
- [docs/srs-v0.md](/mnt/e/my_github/Desktop-Teacher/docs/srs-v0.md)

## 用法

不要再维护一个“大而全”的单体实施计划。  
后续项目推进以“一个步骤一个执行文档”的方式进行。

每个步骤文档负责回答：

- 这个步骤解决什么问题
- 依赖什么前置条件
- 要交付什么产物
- 怎样判断这个步骤完成

## 当前推进顺序

1. [step-00-tech-foundation.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-00-tech-foundation.md)
2. [step-01-desktop-shell-and-avatar.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-01-desktop-shell-and-avatar.md)
3. [step-02-capture-and-submit.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-02-capture-and-submit.md)
4. [step-03-local-conversations-and-archive.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-03-local-conversations-and-archive.md)
5. [step-04-model-adapter-and-answering.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-04-model-adapter-and-answering.md)
6. [step-05-follow-up-chat.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-05-follow-up-chat.md)
7. [step-06-search-skills-and-routing.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-06-search-skills-and-routing.md)
8. [step-07-errors-and-observability.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-07-errors-and-observability.md)
9. [step-08-polish-and-release.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-08-polish-and-release.md)

## 当前下一步

当前最该开始的是：

- [step-00-tech-foundation.md](/mnt/e/my_github/Desktop-Teacher/docs/exec-plans/step-00-tech-foundation.md)

原因：

- 技术栈不定，后面所有实现都会返工。
- provider 适配层不定，模型接入会直接耦合。
- 本地存储方案不定，会话与归档设计无法稳定。
