# V0 执行计划索引

状态：Active
范围：V0 / MVP
关联文档：

- [docs/prd-v0.md](../prd-v0.md)
- [docs/srs-v0.md](../srs-v0.md)

## 用法

不要再维护一个"大而全"的单体实施计划。
后续项目推进以"一个步骤一个执行文档"的方式进行。

每个步骤文档负责回答：

- 这个步骤解决什么问题
- 依赖什么前置条件
- 要交付什么产物
- 怎样判断这个步骤完成

## 布局

- `active/`: 进行中的执行计划
- `completed/`: 已关闭的计划，保留为持久历史
- 仅当承载持久仓库事实时，才在此目录添加技术债务跟踪、发布说明或质量评分卡。

## 工作规则

- 将当前系统事实保留在权威的现状文档或参考文档中，而非仅存于计划产物。
- 完成的计划移入 `completed/`，不要将过时的工作留在 `active/`。

## 进度

1. ~~step-00-tech-foundation.md~~ ✓
2. ~~step-01-desktop-shell-and-avatar.md~~ ✓
3. ~~step-02-capture-and-submit.md~~ ✓
4. ~~step-03-local-conversations-and-archive.md~~ ✓
5. ~~step-04-model-adapter-and-answering.md~~ ✓
6. ~~step-05-follow-up-chat.md~~ ✓
7. ~~step-06-search-skills-and-routing.md~~ ✓
8. [step-07-errors-and-observability.md](step-07-errors-and-observability.md) ✓
9. [step-08-polish-and-release.md](step-08-polish-and-release.md)

## 当前下一步

- [step-07-errors-and-observability.md](step-07-errors-and-observability.md)

Step-00 ~ Step-07 已完成，下一步需要实现润色与发布。
