---
name: docs-refresh
description: Refresh authoritative docs through a routed progressive-disclosure workflow.
---

# Docs Refresh

Use this to close out work by syncing durable docs with the repository's real state. It is not a general writing prompt, and it should not confuse a folder tree with a real project understanding.

Keep the workflow platform-neutral. Host-specific aliases, launcher syntax, and metadata belong in adapters.

## Shared Rules

- The repository is the record system. Durable knowledge belongs in versioned docs near the code, not in chat.
- `AGENTS.md` is a map, not a manual. Keep it short, stable, and navigational.
- Update the smallest authoritative doc that owns the fact.
- Treat PRD, SRS, architecture notes, decision logs, contract references, and validation notes as responsibilities, not mandatory filenames.
- Prefer the bundled collector before manual routing, but do not block on it if it cannot be run from the skill directory.
- Never run `git add`, `git commit`, or automatic VCS cleanup.

## Route First

1. Read repository guidance first. Start with `AGENTS.md` when present, then follow only the pointers needed to find authority, ownership, freshness rules, and doc-lint requirements.
2. Resolve the directory containing this `SKILL.md`.
3. If you can run bundled files from the skill directory, run the collector from that skill directory against `[repo-root]`. Do not assume the target repo has its own `scripts/collect_changed_context.sh`.
4. If the collector succeeds, read both `[routing]` and `[knowledge]`, open only the matching mode file from `preferred_mode_doc`, and load [references/foundation-checklist.md](references/foundation-checklist.md) when `knowledge_phase` is not `operations` or `foundation_gaps` is non-empty.
5. If the collector is unavailable, cannot be resolved from the skill directory, or shell execution is unavailable, manually collect `git status --short`, staged and unstaged changed files, untracked files, diff stat, the repository docs layout, and any obvious foundation surfaces such as overview, architecture, decision, reference, and validation docs.
6. Use the manual routing fallback below to choose exactly one mode file, then infer the matching foundation phase with the checklist reference.
7. Use the current workspace state as the source of truth: staged diff, unstaged diff, untracked files, and generated artifacts when the repository treats them as authoritative outputs.
8. Inspect only the code, schema, generated artifacts, and current docs needed to confirm the real behavior change.
9. Stop after explaining what changed or why no doc change was needed.

## Manual Routing Fallback

Use this only when the bundled collector cannot be run from the skill directory or its routing output is unavailable.

- `bootstrap`: no split docs tree exists, and the repository does not yet have a stable docs system beyond `README.md` or a few incidental docs. `README.md` only is still `bootstrap`.
- `minimal`: no split docs tree exists, but the repository already has one or more stable living docs such as `AGENTS.md`, `ARCHITECTURE.md`, or durable top-level current-state docs. A repo can be `minimal` even if `AGENTS.md` is absent.
- `structured`: split docs domains already exist, such as `docs/design-docs/`, `docs/product-specs/`, `docs/references/`, `docs/generated/`, or `docs/exec-plans/`.
- `repair`: a real docs system exists, but its map or authority is broken enough that content edits would deepen drift: missing index pages, stale or broken `AGENTS.md` or `ARCHITECTURE.md`, broken cross-links, or no usable navigation path from entry docs to owning pages.
- Missing `AGENTS.md` alone does not mean `repair`.
- Sparse docs alone do not mean `repair`.
- When in doubt between `minimal` and `repair`, choose `minimal` unless the repository already has a real docs system whose map is broken.

## Foundation Axis

After you choose a mode, use the collector's `knowledge_phase` when available. If you are in fallback mode, infer the phase manually.

- `framing`: the repository still needs a durable problem frame, success criteria, or map before deeper doc taxonomy is useful.
- `design`: the overview exists, but system boundaries, invariants, or important decisions are still implicit.
- `contracts`: the repository's APIs, schemas, generated interfaces, or external contracts are evolving faster than its reference docs.
- `operations`: the core frame and design exist; remaining gaps are validation, rollout notes, reliability, security, quality scorecards, or stale navigation.
- Before creating new folders, close the highest-risk gap among problem frame, system boundaries, decision log, contract docs, and validation plan.
- Use [references/foundation-checklist.md](references/foundation-checklist.md) to pressure-test those gaps and decide whether the answer belongs in an existing doc, a new section, or a newly earned subtree.

## Shared Decision Rules

- Usually no documentation edits for tests-only, docs-only, comments-only, formatting-only, or internal refactors that do not change public behavior, architecture, state semantics, runtime operation, or external contracts.
- Force a documentation review when the change touches APIs, schema, CLI flags, run modes, scheduler behavior, trigger flow, core architecture, state model, external contracts, durable entry points, documented core beliefs, or stale navigation.
- If the signal is ambiguous, inspect the diff before deciding. Do not update docs just because code changed.
- In `bootstrap` and `minimal` repos, strengthen the founding pack before expanding taxonomy. A new docs subtree is the last move, not the first.
- When a repository has earned `docs/exec-plans/` as a durable plan domain, keep that subtree navigable. The default scaffold is `docs/exec-plans/index.md`, `docs/exec-plans/active/`, and `docs/exec-plans/completed/`.
- When the default `docs/exec-plans/` scaffold is missing and you can run bundled files from the skill directory, use [scripts/scaffold_exec_plans.sh](scripts/scaffold_exec_plans.sh) against `[repo-root]`. It creates the scaffold without overwriting existing plan docs and keeps empty lifecycle buckets versioned with placeholder files.

## Shared Authority Rules

- Prefer this authority order unless the repository defines a stricter one:
  1. code, tests that prove behavior, schema, and authoritative generated artifacts
  2. current-state architecture, design, product, reliability, security, and reference docs
  3. navigation docs and indexes such as `AGENTS.md`, `ARCHITECTURE.md`, and `docs/**/index.md`
  4. plans, decision logs, and history documents
- `AGENTS.md` never outranks code or the deeper docs it points to.

## Modes

- [modes/bootstrap.md](modes/bootstrap.md): Repos with no real docs system yet. Start with phased growth from `README.md`, `AGENTS.md`, and only add deeper structure when durable domains appear.
- [modes/minimal.md](modes/minimal.md): Repos with core living docs but no split docs taxonomy. Prefer updating those docs and only create the first subtree when it has earned a second durable page.
- [modes/structured.md](modes/structured.md): Repos that already have split docs domains. Preserve the existing taxonomy and converge to the smallest authoritative page.
- [modes/repair.md](modes/repair.md): Repos whose docs system exists but navigation or authority surfaces are stale. Repair the map and indexes before expanding content.
- Each mode file supports both collector-selected routing and the manual fallback rules above.

## Explain The Result

If no documentation change is needed, say so explicitly and explain why.

If documentation changed, report:

- which documents changed
- why those documents were the right convergence points
- whether `AGENTS.md` stayed unchanged on purpose, or why its navigation changed
- why you reused existing docs instead of creating new files
- what remains stale, uncovered, or needs manual follow-up

Stop after the explanation. Do not stage or commit anything.
