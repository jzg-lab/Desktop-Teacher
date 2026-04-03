# Structured Mode

Use this mode when the collector reports `doc_system_mode=structured`, or when manual routing finds split docs domains already present.

The repository already has split docs domains. Preserve that system and converge to the smallest authoritative page that owns the fact.

## Focus

- Treat the existing taxonomy as real repository structure, not as something to flatten for convenience.
- Keep entry pages and indexes short, scannable, and link-heavy.
- Put current behavior, architecture, and operator-facing semantics in current-state docs.
- Put schemas, provider contracts, generated facts, and protocol details in reference docs.
- Keep plans and debt in plan artifacts, but do not hide current system truth there.
- Keep `docs/exec-plans/` navigable: `index.md` is the entry point, `active/` plus `completed/` are the default lifecycle buckets unless the repository already defines a stricter convention, and empty buckets should stay versioned with placeholder files.
- Leave history docs as history except for redirects or explicit staleness notices.
- Let `knowledge_phase` choose emphasis inside the existing taxonomy: framing gaps go to overview/product docs, design gaps to current-state design docs, contract gaps to reference docs, and operations gaps to plan or scorecard docs.

## Preservation Rules

- Do not collapse `design-docs`, `product-specs`, `references`, `generated`, or `exec-plans` back into one overview page.
- Do not replace a living taxonomy with ad hoc new buckets.
- Touch `AGENTS.md`, `ARCHITECTURE.md`, or index pages only when navigation or authority actually changed.

## Working Rule

- In a structured repo, convergence matters more than invention. Reuse the existing doc system unless it is clearly broken.
