# Foundation Checklist

Use this after routing when `knowledge_phase` is not `operations`, or when the collector reports non-empty `foundation_gaps`.

The goal is to strengthen project understanding before inventing more structure.

## Core Rule

- Treat PRD, SRS, architecture notes, ADRs, and risk logs as documentation responsibilities, not mandatory filenames.
- Prefer the smallest durable document that can own the fact today.
- Prefer the repository's named docs surfaces before inventing parallel files: `PRODUCT_SENSE.md`, `DESIGN.md`, `FRONTEND.md`, `PLANS.md`, `QUALITY_SCORE.md`, `RELIABILITY.md`, and `SECURITY.md` should carry their intended responsibilities when they already exist.
- When the collector reports a clear `role_map` for custom docs domains, reuse those domains first. Normalize only when authority is drifting, the map is broken, or execution planning needs the standard scaffold.
- Exploratory future work belongs in product or design docs; execution-ready work belongs in `docs/exec-plans/active/`.
- Do not treat an empty `docs/exec-plans/` scaffold as validation truth by itself.
- Split into a new subtree only after a domain has earned a second durable page.

## Pressure-Test Questions

### Problem Frame

- Who is the user or operator?
- What job is the system supposed to do?
- What are the explicit non-goals?
- What constraints, success criteria, or business rules already exist?
- Typical homes: `README.md`, `PROJECT_BRIEF.md`, `PRODUCT_SENSE.md`, `docs/product-specs/`.

### System Boundaries

- What does the repository own directly?
- What systems, providers, or humans does it depend on?
- What are the main entities, states, invariants, or lifecycle transitions?
- What failure boundaries matter?
- Typical homes: `ARCHITECTURE.md`, `DESIGN.md`, `docs/design-docs/`, `docs/core/`.

### Decision Log

- What important choices were made?
- What alternatives were rejected, and why?
- What would trigger revisiting the decision?
- Typical homes: `ARCHITECTURE.md`, `DECISIONS.md`, ADR sections, `docs/design-docs/`.

### Contract Docs

- Which APIs, schemas, prompts, jobs, env vars, generated artifacts, or provider contracts are externally relevant?
- Which parts are stable contracts versus internal implementation details?
- Typical homes: `docs/references/`, `docs/generated/`, `API.md`, `SCHEMA.md`, generated reference artifacts.

### Validation Plan

- What are the main path, edge cases, and failure modes?
- What checks prove the system is acceptable?
- What rollout, observability, security, reliability, or debt notes must stay durable?
- Is the repository's validation truth already carried by runbooks, reliability notes, or scorecards, or are you only looking at a planning scaffold?
- Is this future work still being shaped, or is it ready to become an active execution plan?
- Typical homes: `PLANS.md`, `QUALITY_SCORE.md`, `RELIABILITY.md`, `SECURITY.md`, `RISKS.md`, `OPEN_QUESTIONS.md`, `docs/exec-plans/`.

## Phase Guidance

- `framing`: establish the problem frame and map first. Do not start with a deep docs tree.
- `design`: make boundaries, invariants, and key decisions explicit before adding more taxonomy.
- `contracts`: update reference surfaces before or alongside code that changes APIs, schemas, or generated interfaces.
- `operations`: close validation, rollout, risk, and navigation drift inside the existing doc system, using `PLANS.md`, `QUALITY_SCORE.md`, `RELIABILITY.md`, `SECURITY.md`, and `docs/exec-plans/` intentionally instead of inventing sidecar docs.
