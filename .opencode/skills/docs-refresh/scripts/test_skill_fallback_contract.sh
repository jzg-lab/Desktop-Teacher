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
assert_contains "$skill_dir/SKILL.md" 'read both `[routing]` and `[knowledge]`'
assert_contains "$skill_dir/SKILL.md" '[references/foundation-checklist.md](references/foundation-checklist.md)'
assert_contains "$skill_dir/SKILL.md" 'The default scaffold is `docs/exec-plans/index.md`, `docs/exec-plans/active/`, and `docs/exec-plans/completed/`.'
assert_contains "$skill_dir/SKILL.md" '[scripts/scaffold_exec_plans.sh](scripts/scaffold_exec_plans.sh)'
assert_contains "$skill_dir/modes/bootstrap.md" 'Treat PRD, SRS, architecture notes, and decision records as responsibilities, not mandatory file names.'
assert_contains "$skill_dir/modes/bootstrap.md" 'scaffold `docs/exec-plans/index.md`, `docs/exec-plans/active/`, and `docs/exec-plans/completed/`'
assert_contains "$skill_dir/modes/minimal.md" 'A repo can be `minimal` even if `AGENTS.md` is absent'
assert_contains "$skill_dir/modes/minimal.md" 'Strengthen the founding pack before creating the first subtree.'
assert_contains "$skill_dir/modes/structured.md" 'Keep `docs/exec-plans/` navigable'
assert_contains "$skill_dir/modes/repair.md" '`docs/exec-plans/` exists but its entry scaffold is incomplete'
assert_contains "$skill_dir/modes/repair.md" 'Missing `AGENTS.md` alone is not `repair`.'
assert_contains "$repo_root/README.md" 'the default scaffold is `docs/exec-plans/index.md`, `docs/exec-plans/active/`, and `docs/exec-plans/completed/`'
assert_contains "$repo_root/README.md" 'placeholder files such as `.gitkeep`'
assert_not_contains "$skill_dir/scripts/collect_changed_context.sh" 'local -n'
assert_not_contains "$skill_dir/scripts/collect_changed_context.sh" 'declare -n'

echo "Skill fallback contract checks passed."
