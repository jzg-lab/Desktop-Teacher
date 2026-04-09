# Structured Mode

Use this mode when the collector reports `doc_system_mode=structured`, or when manual routing finds split docs domains already present.

The repository already has split docs domains. That can mean the standard taxonomy, a healthy custom taxonomy, or a mixed system. Preserve the usable map first, then converge to the smallest authoritative page that owns the fact.

## Focus

- Treat the existing taxonomy as real repository structure, not as something to flatten for convenience.
- If `repo_taxonomy_mode` is `custom` or `mixed`, use the collector's `role_map` to reuse healthy custom domains before you normalize anything.
- Keep entry pages and indexes short, scannable, and link-heavy.
- Put current behavior, architecture, and operator-facing semantics in current-state docs.
- Put schemas, provider contracts, generated facts, and protocol details in reference docs.
- Keep plans and debt in plan artifacts, but do not hide current system truth there.
- Use the repository's named cross-cutting docs intentionally: `PRODUCT_SENSE.md` for framing, `DESIGN.md` plus `FRONTEND.md` for current design truth, and `PLANS.md`, `QUALITY_SCORE.md`, `RELIABILITY.md`, and `SECURITY.md` for validation and operations.
- Keep `docs/exec-plans/` navigable: `index.md` is the entry point, `active/` plus `completed/` are the default lifecycle buckets unless the repository already defines a stricter convention, and empty buckets should stay versioned with placeholder files.
- Lifecycle consistency check: when the collector reports `stale_plan_placement` non-empty, move each listed done-marked plan file into `docs/exec-plans/completed/` and update `docs/exec-plans/index.md` plus `docs/exec-plans/README.md` when it exists so links point at the new paths. This structural audit still applies when git shows no changes.
- When the user brings explicit future work that is ready for execution, create or update an active plan artifact under `docs/exec-plans/active/`. If the collector reports `plan_readiness=needs-standardization`, create the standard scaffold and migrate only the smallest planning surface needed.
- If the work is still exploratory, incomplete, or not yet execution-ready, tighten `PRODUCT_SENSE.md`, `DESIGN.md`, `FRONTEND.md`, `docs/product-specs/`, or `docs/design-docs/` instead of creating an active plan.
- Custom domains that map cleanly and are not drifting can remain in place for current-state, reference, or validation truth.
- Normalize ad hoc custom docs folders into the standard domains and archive the prior layout under `old_docs/` unless the repository already defines a different archive location. Use the smallest migration consistent with `taxonomy_health`, `normalization_candidates`, and explicit planning intent.
- Treat `old_docs/` as legacy archive material, not as a place to land new truth.
- Leave history docs as history except for redirects or explicit staleness notices.
- Let `knowledge_phase` choose emphasis inside the existing taxonomy: framing gaps go to overview/product docs, design gaps to current-state design docs, contract gaps to reference docs, and operations gaps to plan or scorecard docs.

## Preservation Rules

- Do not collapse `design-docs`, `product-specs`, `references`, `generated`, or `exec-plans` back into one overview page.
- Do not replace a living taxonomy with ad hoc new buckets.
- Do not let minor scaffold drift block an explicit active-plan update; repair only the minimum scaffold needed and continue the intended convergence.
- Do not migrate healthy custom domains just because they are custom. Migrate when authority is duplicated, planning needs the standard lifecycle buckets, or the collector reports `taxonomy_health=migration-recommended`.
- Touch `AGENTS.md`, `ARCHITECTURE.md`, or index pages only when navigation or authority actually changed.

## Working Rule

- In a structured repo, convergence matters more than invention. Reuse the existing doc system unless it is clearly broken.
