# Repair Mode

Use this mode when the collector reports `doc_system_mode=repair`, or when manual routing shows that an existing docs system has a broken map or authority surface.

The repository has a docs system, but its navigation, taxonomy map, or authority surfaces are stale enough that content edits alone would deepen drift.

## Focus

- Repair `AGENTS.md`, `ARCHITECTURE.md`, index pages, broken authority pointers, or missing cross-links before expanding content.
- If `repo_taxonomy_mode` is `custom` or `mixed`, repair the role map before you migrate anything. Broken custom navigation is still a map problem first.
- Do not let missing `docs/exec-plans/` scaffold hijack explicit planning intent.
- When the user is creating execution-ready future work, repair only the minimum missing scaffold needed to land the active plan, then place that plan in `docs/exec-plans/active/` in the same pass.
- Restore a usable map first, then update the smallest authoritative document that owns the changed fact.

## Repair Triggers

- Split docs directories exist but the expected index pages are missing.
- `docs/exec-plans/` exists but its entry scaffold is incomplete: missing `index.md`, `active/`, `completed/`, or the placeholder files that keep empty lifecycle buckets versioned.
- Navigation docs are the active drift signal in a repository that already has a docs system.
- The repository layout implies a docs system, but the collector cannot infer usable preferred targets or a trustworthy role map for custom domains.

## Working Rule

- Do not patch around a broken map by stuffing more truth into leaf pages. Repair navigation and authority first, then continue with normal convergence.
- If the blocked surface is `docs/exec-plans/`, scaffold or restore `index.md`, `active/`, and `completed/` as needed, but still finish the active-plan update in the same change set when planning intent is explicit.
- If a custom planning directory exists and execution-ready work arrives, create the standard `docs/exec-plans/` scaffold, migrate only the minimum planning material needed, and preserve the original source under `old_docs/`.
- After the map is usable again, close the highest-risk foundation gap instead of inventing new placeholder structure.
- Missing `AGENTS.md` alone is not `repair`.
- Sparse docs alone are not `repair`.
