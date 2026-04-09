#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"
repo_root="$(cd "$skill_dir/.." && pwd)"

assert_contains() {
  local path="$1"
  local needle="$2"

  if ! grep -Fq "$needle" "$path"; then
    echo "Expected text not found in $path: $needle" >&2
    exit 1
  fi
}

assert_not_contains() {
  local path="$1"
  local needle="$2"

  if grep -Fq "$needle" "$path"; then
    echo "Unexpected text found in $path: $needle" >&2
    exit 1
  fi
}

assert_contains "$skill_dir/SKILL.md" 'Do not assume the target repo has its own `scripts/collect_changed_context.sh`.'
assert_contains "$skill_dir/SKILL.md" 'If the collector is unavailable, cannot be resolved from the skill directory, or shell execution is unavailable'
assert_contains "$skill_dir/SKILL.md" 'When in doubt between `minimal` and `repair`, choose `minimal` unless the repository already has a real docs system whose map is broken.'
assert_contains "$skill_dir/SKILL.md" 'read `[repo_layout]`, `[planning]`, `[routing]`, and `[knowledge]`'
assert_contains "$skill_dir/SKILL.md" '[references/foundation-checklist.md](references/foundation-checklist.md)'
assert_contains "$skill_dir/SKILL.md" 'Classify the user request before mode routing: current-state refresh, future-spec refinement, or actionable execution planning.'
assert_contains "$skill_dir/SKILL.md" 'Use the current workspace state as the source of truth for implemented behavior, but use explicit user intent plus repository constraints for future-work plan artifacts.'
assert_contains "$skill_dir/SKILL.md" 'Create or update `docs/exec-plans/active/` when the user explicitly wants the work done and you can write a concrete goal plus scope or constraints and acceptance criteria or immediate next steps.'
assert_contains "$skill_dir/SKILL.md" 'If the idea is still exploratory, incomplete, or not yet execution-ready, tighten `PRODUCT_SENSE.md`, `DESIGN.md`, `FRONTEND.md`, `docs/product-specs/`, or `docs/design-docs/` instead of creating an active plan.'
assert_contains "$skill_dir/SKILL.md" 'If the repository already has sanctioned docs domains such as `docs/design-docs/`, `docs/product-specs/`, `docs/references/`, `docs/generated/`, `docs/exec-plans/`, `DESIGN.md`, `FRONTEND.md`, `PLANS.md`, `PRODUCT_SENSE.md`, `QUALITY_SCORE.md`, `RELIABILITY.md`, or `SECURITY.md`, use them before inventing new folders.'
assert_contains "$skill_dir/SKILL.md" 'Healthy custom domains can stay in place until drift, duplicate authority, or execution planning makes standardization necessary.'
assert_contains "$skill_dir/SKILL.md" '`repo_taxonomy_mode`, `taxonomy_health`, `role_map`, `normalization_candidates`, `migration_candidates`, `plan_readiness`, `stale_plan_placement`, and `active_plan_target` as the routing contract'
assert_contains "$skill_dir/SKILL.md" 'Do not confuse plan scaffolding with validation truth.'
assert_contains "$skill_dir/SKILL.md" 'reuse healthy custom domains when their `role_map` is clear'
assert_contains "$skill_dir/SKILL.md" 'audit `stale_plan_placement` even when git is clean'
assert_contains "$skill_dir/SKILL.md" 'When normalizing ad hoc custom docs folders into the sanctioned taxonomy, preserve the previous source material under `old_docs/` unless the repository already defines a stricter archive location.'
assert_contains "$skill_dir/SKILL.md" 'The default scaffold is `docs/exec-plans/index.md`, `docs/exec-plans/active/`, and `docs/exec-plans/completed/`.'
assert_contains "$skill_dir/SKILL.md" '[scripts/scaffold_exec_plans.sh](scripts/scaffold_exec_plans.sh)'
assert_contains "$skill_dir/modes/bootstrap.md" 'Treat PRD, SRS, architecture notes, and decision records as responsibilities, not mandatory file names.'
assert_contains "$skill_dir/modes/bootstrap.md" 'scaffold `docs/exec-plans/index.md`, `docs/exec-plans/active/`, and `docs/exec-plans/completed/`'
assert_contains "$skill_dir/modes/minimal.md" 'A repo can be `minimal` even if `AGENTS.md` is absent'
assert_contains "$skill_dir/modes/minimal.md" 'Strengthen the founding pack before creating the first subtree.'
assert_contains "$skill_dir/modes/structured.md" 'If `repo_taxonomy_mode` is `custom` or `mixed`, use the collector'\''s `role_map` to reuse healthy custom domains before you normalize anything.'
assert_contains "$skill_dir/modes/structured.md" 'Keep `docs/exec-plans/` navigable'
assert_contains "$skill_dir/modes/structured.md" 'collector reports `stale_plan_placement` non-empty'
assert_contains "$skill_dir/modes/structured.md" 'When the user brings explicit future work that is ready for execution, create or update an active plan artifact under `docs/exec-plans/active/`.'
assert_contains "$skill_dir/modes/structured.md" 'Custom domains that map cleanly and are not drifting can remain in place for current-state, reference, or validation truth.'
assert_contains "$skill_dir/modes/structured.md" 'Normalize ad hoc custom docs folders into the standard domains and archive the prior layout under `old_docs/` unless the repository already defines a different archive location.'
assert_contains "$skill_dir/modes/repair.md" '`docs/exec-plans/` exists but its entry scaffold is incomplete'
assert_contains "$skill_dir/modes/repair.md" 'Do not let missing `docs/exec-plans/` scaffold hijack explicit planning intent.'
assert_contains "$skill_dir/modes/repair.md" 'repair the role map before you migrate anything'
assert_contains "$skill_dir/modes/repair.md" 'Missing `AGENTS.md` alone is not `repair`.'
assert_contains "$skill_dir/references/foundation-checklist.md" 'Exploratory future work belongs in product or design docs; execution-ready work belongs in `docs/exec-plans/active/`.'
assert_contains "$skill_dir/references/foundation-checklist.md" 'reuse those domains first. Normalize only when authority is drifting'
assert_contains "$skill_dir/references/foundation-checklist.md" 'Do not treat an empty `docs/exec-plans/` scaffold as validation truth by itself.'
assert_contains "$skill_dir/agents/openai.yaml" 'classify the request as current-state refresh, future-spec refinement, or actionable execution planning'
assert_contains "$skill_dir/agents/openai.yaml" '`repo_taxonomy_mode`, `taxonomy_health`, `role_map`, `normalization_candidates`, `migration_candidates`, `plan_readiness`, `stale_plan_placement`, and `active_plan_target` as the routing contract'
assert_contains "$skill_dir/agents/openai.yaml" 'put execution-ready future work in `docs/exec-plans/active/`'
assert_contains "$skill_dir/agents/openai.yaml" 'do not treat a bare plan scaffold as validation truth'
assert_contains "$skill_dir/agents/openai.yaml" 'preserving prior source material under `old_docs/`'
assert_contains "$repo_root/README.md" 'mixed or custom docs trees get mapped before the workflow tries to normalize them'
assert_contains "$repo_root/README.md" '`repo_taxonomy_mode`, `taxonomy_health`, `role_map`, `normalization_candidates`, `migration_candidates`, `plan_readiness`, `stale_plan_placement`, and `active_plan_target` as the routing contract'
assert_contains "$repo_root/README.md" 'audit stale execution plans even when git is clean'
assert_contains "$repo_root/README.md" 'the default scaffold is `docs/exec-plans/index.md`, `docs/exec-plans/active/`, and `docs/exec-plans/completed/`'
assert_contains "$repo_root/README.md" 'placeholder files such as `.gitkeep`'
assert_contains "$repo_root/README.md" 'explicit execution-ready future work belongs in `docs/exec-plans/active/`, while exploratory or still-fluid work should tighten existing product or design docs first'
assert_contains "$repo_root/README.md" 'reuse healthy custom docs domains when their role is clear instead of flattening them by default'
assert_contains "$repo_root/README.md" 'distinguish validation truth from a bare `docs/exec-plans/` scaffold'
assert_contains "$repo_root/README.md" 'when drift, duplicate authority, or execution planning requires standardization, ad hoc custom docs folders should be decomposed into the standard domains and their prior contents preserved under `old_docs/`'
assert_not_contains "$skill_dir/scripts/collect_changed_context.sh" 'local -n'
assert_not_contains "$skill_dir/scripts/collect_changed_context.sh" 'declare -n'

echo "Skill fallback contract checks passed."
