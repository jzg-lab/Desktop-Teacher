# Bootstrap Mode

Use this mode when the collector reports `doc_system_mode=bootstrap`, or when manual routing shows there is no split docs tree and no stable docs system beyond `README.md` or a few incidental docs.

The repository does not have a real docs system yet. Grow one in phases instead of generating a full scaffold on first contact.

## Focus

- Create or update `README.md` as the living overview when the repository has no better current-state document yet.
- Create `AGENTS.md` as the map when the repository needs a stable navigation entry point for future agents.
- Capture the initial founding pack before you grow taxonomy: problem frame, system boundaries, key decisions, and validation notes.
- Create `ARCHITECTURE.md` only when the codebase already has multiple durable domains, subsystems, or cross-cutting operational behavior that no longer fits cleanly inside `README.md`.

## Founding Pack

- Treat PRD, SRS, architecture notes, and decision records as responsibilities, not mandatory file names.
- Keep the smallest durable set of docs that answers: what problem the repository solves, what it owns, what it deliberately does not own, what key decisions were made, and how success or safety will be checked.
- If decision notes or validation notes still fit inside `README.md` or `ARCHITECTURE.md`, keep them there until they earn their own durable page.

## Placement Rules

- Prefer the smallest durable foundation over a full docs tree.
- Treat the OpenAI-like docs layout as the eventual target shape, not day-one output.
- Keep `AGENTS.md` short and navigational even during bootstrap.
- Do not create `docs/` subtrees just because the repository is new.

## Growth Triggers

- Create `docs/design-docs/` when stable design principles or architecture rationale need more than one durable page.
- Create `docs/product-specs/` when user-facing flows or product constraints have split beyond overview docs.
- Create `docs/references/` when schemas, provider contracts, protocol details, or LLM-oriented references need their own reference pages.
- Create `docs/generated/` only when generated facts are treated as authoritative repository outputs.
- Create `docs/exec-plans/` when plans, progress logs, or debt tracking are versioned as first-class artifacts. When you do, scaffold `docs/exec-plans/index.md`, `docs/exec-plans/active/`, and `docs/exec-plans/completed/` so execution work has a stable entry point and lifecycle buckets, and keep empty buckets versioned with placeholder files until real plan docs exist.

## Working Rule

- Bootstrap should leave the repository with a founding pack, not an empty cathedral of placeholder directories.
- Missing `AGENTS.md` is normal here. It is not, by itself, a repair signal.
