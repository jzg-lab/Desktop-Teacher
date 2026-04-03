#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
collector="$script_dir/collect_changed_context.sh"
tmp_root="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_root"
}

trap cleanup EXIT

write_file() {
  local path="$1"
  local content="$2"

  mkdir -p "$(dirname "$path")"
  printf '%s\n' "$content" > "$path"
}

make_repo() {
  local name="$1"
  local repo="$tmp_root/$name"

  mkdir -p "$repo"
  git -C "$repo" init -q
  git -C "$repo" config user.name "Docs Refresh Test"
  git -C "$repo" config user.email "docs-refresh-test@example.com"
  git -C "$repo" commit --allow-empty -q -m "init"

  printf '%s\n' "$repo"
}

commit_all() {
  local repo="$1"
  local message="$2"

  git -C "$repo" add .
  git -C "$repo" commit -q -m "$message"
}

assert_line() {
  local output="$1"
  local expected="$2"

  if ! grep -Fxq "$expected" <<< "$output"; then
    echo "Expected line not found: $expected" >&2
    echo "--- collector output ---" >&2
    printf '%s\n' "$output" >&2
    exit 1
  fi
}

assert_routing() {
  local repo="$1"
  local expected_mode="$2"
  local expected_reason="$3"
  local output

  output="$(bash "$collector" "$repo")"
  assert_line "$output" "doc_system_mode=$expected_mode"
  assert_line "$output" "mode_reason=$expected_reason"
  assert_line "$output" "preferred_mode_doc=modes/$expected_mode.md"
  printf '%s\n' "$output"
}

repo="$(make_repo bootstrap)"
write_file "$repo/README.md" "# Overview"
commit_all "$repo" "bootstrap baseline"
output="$(assert_routing "$repo" "bootstrap" "no-doc-system")"
assert_line "$output" "knowledge_phase=framing"
assert_line "$output" "problem_frame_state=present"
assert_line "$output" "boundary_state=missing"
assert_line "$output" "decision_state=not-needed-yet"
assert_line "$output" "contract_state=not-needed-yet"
assert_line "$output" "validation_state=missing"
assert_line "$output" "foundation_gaps=system-boundaries,validation-plan"

repo="$(make_repo minimal)"
write_file "$repo/README.md" "# Overview"
write_file "$repo/AGENTS.md" "# AGENTS"
commit_all "$repo" "minimal baseline"
output="$(assert_routing "$repo" "minimal" "core-docs-without-split-domains")"
assert_line "$output" "knowledge_phase=design"
assert_line "$output" "problem_frame_state=present"
assert_line "$output" "boundary_state=missing"
assert_line "$output" "decision_state=not-needed-yet"
assert_line "$output" "contract_state=not-needed-yet"
assert_line "$output" "validation_state=missing"
assert_line "$output" "foundation_gaps=system-boundaries,validation-plan"

repo="$(make_repo docs_false_positive)"
write_file "$repo/README.md" "# Overview"
commit_all "$repo" "docs false positive baseline"
write_file "$repo/explanation.md" "# Explanation"
output="$(assert_routing "$repo" "bootstrap" "no-doc-system")"
assert_line "$output" "decision_state=not-needed-yet"
assert_line "$output" "classes=only-docs"
assert_line "$output" "changed_doc_areas="
assert_line "$output" "decision_doc_files="
assert_line "$output" "plan_doc_files="

repo="$(make_repo plan_named_doc)"
write_file "$repo/README.md" "# Overview"
commit_all "$repo" "plan named doc baseline"
write_file "$repo/release-plan.md" "# Release Plan"
output="$(assert_routing "$repo" "bootstrap" "no-doc-system")"
assert_line "$output" "classes=only-docs,plan-docs,plans"
assert_line "$output" "plan_doc_files=release-plan.md"

repo="$(make_repo structured)"
write_file "$repo/AGENTS.md" "# AGENTS"
write_file "$repo/ARCHITECTURE.md" "# Architecture"
write_file "$repo/docs/design-docs/index.md" "# Design Docs"
commit_all "$repo" "structured baseline"
output="$(assert_routing "$repo" "structured" "split-doc-domains-present")"
assert_line "$output" "knowledge_phase=operations"
assert_line "$output" "problem_frame_state=missing"
assert_line "$output" "boundary_state=present"
assert_line "$output" "decision_state=not-needed-yet"
assert_line "$output" "contract_state=not-needed-yet"
assert_line "$output" "validation_state=missing"
assert_line "$output" "foundation_gaps=problem-frame,validation-plan"

repo="$(make_repo structured_exec_plans)"
write_file "$repo/AGENTS.md" "# AGENTS"
write_file "$repo/ARCHITECTURE.md" "# Architecture"
write_file "$repo/docs/exec-plans/index.md" "# Exec Plans"
write_file "$repo/docs/exec-plans/active/.gitkeep" ""
write_file "$repo/docs/exec-plans/completed/.gitkeep" ""
commit_all "$repo" "structured exec plans baseline"
output="$(assert_routing "$repo" "structured" "split-doc-domains-present")"
assert_line "$output" "navigation_targets=AGENTS.md,ARCHITECTURE.md,docs/exec-plans/index.md"
assert_line "$output" "plan_targets=docs/exec-plans/,docs/exec-plans/index.md,docs/exec-plans/active/,docs/exec-plans/completed/"
assert_line "$output" "missing_index_targets="
assert_line "$output" "missing_plan_scaffold_targets="

repo="$(make_repo repair)"
write_file "$repo/AGENTS.md" "# AGENTS"
mkdir -p "$repo/docs/design-docs"
commit_all "$repo" "repair baseline"
output="$(assert_routing "$repo" "repair" "missing-split-doc-indexes")"
assert_line "$output" "knowledge_phase=operations"
assert_line "$output" "problem_frame_state=missing"
assert_line "$output" "boundary_state=present"
assert_line "$output" "decision_state=not-needed-yet"
assert_line "$output" "contract_state=not-needed-yet"
assert_line "$output" "validation_state=missing"
assert_line "$output" "foundation_gaps=problem-frame,validation-plan"

repo="$(make_repo repair_exec_plans_index)"
write_file "$repo/AGENTS.md" "# AGENTS"
write_file "$repo/ARCHITECTURE.md" "# Architecture"
write_file "$repo/docs/exec-plans/active/.gitkeep" ""
write_file "$repo/docs/exec-plans/completed/.gitkeep" ""
commit_all "$repo" "repair exec plans missing index"
output="$(assert_routing "$repo" "repair" "missing-split-doc-indexes")"
assert_line "$output" "missing_index_targets=docs/exec-plans/index.md"
assert_line "$output" "missing_plan_scaffold_targets="

repo="$(make_repo repair_exec_plans_scaffold)"
write_file "$repo/AGENTS.md" "# AGENTS"
write_file "$repo/ARCHITECTURE.md" "# Architecture"
write_file "$repo/docs/exec-plans/index.md" "# Exec Plans"
commit_all "$repo" "repair exec plans missing lifecycle buckets"
output="$(assert_routing "$repo" "repair" "incomplete-exec-plan-scaffold")"
assert_line "$output" "missing_index_targets="
assert_line "$output" "missing_plan_scaffold_targets=docs/exec-plans/active/,docs/exec-plans/completed/"

repo="$(make_repo contracts)"
write_file "$repo/README.md" "# Overview"
write_file "$repo/AGENTS.md" "# AGENTS"
write_file "$repo/ARCHITECTURE.md" "# Architecture"
write_file "$repo/DECISIONS.md" "# Decisions"
commit_all "$repo" "contracts baseline"
write_file "$repo/api/openapi_contract.py" "SCHEMA = {}"
output="$(assert_routing "$repo" "minimal" "core-docs-without-split-domains")"
assert_line "$output" "knowledge_phase=contracts"
assert_line "$output" "problem_frame_state=present"
assert_line "$output" "boundary_state=present"
assert_line "$output" "decision_state=present"
assert_line "$output" "contract_state=missing"
assert_line "$output" "validation_state=missing"
assert_line "$output" "foundation_gaps=contract-docs,validation-plan"

repo="$(make_repo decision_authority)"
write_file "$repo/README.md" "# Overview"
write_file "$repo/DECISIONS.md" "# Decisions"
commit_all "$repo" "decision authority baseline"
write_file "$repo/src/application/service.py" "x"
output="$(assert_routing "$repo" "minimal" "core-docs-without-split-domains")"
assert_line "$output" "decision_state=present"
assert_line "$output" "current_state_targets=README.md"
assert_line "$output" "decision_targets=DECISIONS.md"
assert_line "$output" "preferred_targets=README.md"

echo "Routing smoke tests passed."
