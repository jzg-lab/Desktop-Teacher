#!/usr/bin/env bash
set -euo pipefail

repo_arg="${1:-.}"
repo_root="$(git -C "$repo_arg" rev-parse --show-toplevel 2>/dev/null || true)"

if [[ -z "$repo_root" ]]; then
  echo "ERROR: not a git repository: $repo_arg" >&2
  exit 1
fi

status_short="$(git -C "$repo_root" status --short)"
unstaged_files="$(git -C "$repo_root" diff --name-only)"
staged_files="$(git -C "$repo_root" diff --cached --name-only)"
untracked_files="$(git -C "$repo_root" ls-files --others --exclude-standard)"
unstaged_stat="$(git -C "$repo_root" diff --stat)"
staged_stat="$(git -C "$repo_root" diff --cached --stat)"

all_files="$(
  printf '%s\n%s\n%s\n' "$unstaged_files" "$staged_files" "$untracked_files" \
    | awk 'NF {print}' \
    | sort -u
)"

to_csv() {
  if [[ "$#" -eq 0 ]]; then
    echo
    return
  fi

  printf '%s\n' "$@" | awk 'NF' | paste -sd, -
}

has_file() {
  local path="$1"
  [[ -e "$repo_root/$path" ]]
}

has_any_file() {
  local path
  for path in "$@"; do
    if has_file "$path"; then
      return 0
    fi
  done
  return 1
}

dir_has_entries() {
  local path="$1"
  [[ -d "$repo_root/$path" ]] || return 1
  find "$repo_root/$path" -mindepth 1 -maxdepth 1 -print -quit | grep -q .
}

is_doc_file() {
  local path="$1"
  [[ "$path" =~ (^|/)(docs|doc)/ ]] \
    || [[ "$path" =~ (^|/)(README|CHANGELOG|ARCHITECTURE|AGENTS)(\.[^.]+)?$ ]] \
    || [[ "$path" =~ \.(md|mdx|rst|adoc|txt)$ ]]
}

is_test_file() {
  local path="$1"
  [[ "$path" =~ (^|/)(test|tests|testing|__tests__|spec)/ ]] \
    || [[ "$path" =~ (^|/).*(_test|_tests|_spec)\.[^.]+$ ]] \
    || [[ "$path" =~ (^|/)test_[^.]+\.[^.]+$ ]]
}

is_navigation_file() {
  local path="$1"
  [[ "$path" =~ (^|/)(AGENTS|ARCHITECTURE)(\.[^.]+)?$ ]] \
    || [[ "$path" =~ (^|/)docs(/[^/]+)?/index\.md$ ]]
}

is_current_state_doc_file() {
  local path="$1"
  [[ "$path" =~ (^|/)docs/core/ ]] \
    || [[ "$path" =~ (^|/)docs/design-docs/ ]] \
    || [[ "$path" =~ (^|/)docs/product-specs/ ]] \
    || [[ "$path" =~ (^|/)(README)(\.[^.]+)?$ ]] \
    || [[ "$path" =~ (^|/)(PROJECT_BRIEF|ARCHITECTURE|DESIGN|FRONTEND|PRODUCT_SENSE|RELIABILITY|SECURITY)(\.[^.]+)?$ ]]
}

is_decision_doc_file() {
  local path="$1"
  [[ "$path" =~ (^|/)(DECISIONS|ADR)(\.[^.]+)?$ ]] \
    || [[ "$path" =~ (^|/)docs(/design-docs)?/(decisions|adr|adrs)(/|$) ]] \
    || [[ "$path" =~ (^|/)docs/design-docs/decision-log\.md$ ]]
}

is_scorecard_file() {
  local path="$1"
  [[ "$path" =~ (^|/)(QUALITY_SCORE)(\.[^.]+)?$ ]]
}

is_reference_doc_file() {
  local path="$1"
  [[ "$path" =~ (^|/)docs/references/ ]] \
    || [[ "$path" =~ (^|/)docs/generated/ ]] \
    || [[ "$path" =~ (^|/).*-llms\.txt$ ]]
}

is_generated_doc_file() {
  local path="$1"
  [[ "$path" =~ (^|/)docs/generated/ ]]
}

is_plan_file() {
  local path="$1"
  local name="${path##*/}"
  local stem="${name%.*}"

  [[ "$path" =~ (^|/)docs/exec-plans/ ]] && return 0
  [[ "$path" =~ (^|/)(PLANS)(\.[^.]+)?$ ]] && return 0
  [[ "$name" =~ \.(md|mdx|rst|adoc|txt)$ ]] || return 1

  [[ "$stem" =~ (^|.*[._-])([Pp]lans?|[Rr]oadmap|[Dd]ebt)([._-].*|$) ]] \
    || [[ "$stem" =~ ([Pp]lans?|[Rr]oadmap|[Dd]ebt)$ ]]
}

is_history_doc_file() {
  local path="$1"
  [[ "$path" =~ (^|/)docs/history/ ]]
}

add_unique() {
  local target_array_name="$1"
  local value="$2"
  local existing
  local current_values=()

  # Avoid Bash 4 namerefs so the collector still runs on Bash 3.2 environments.
  eval "current_values=(\"\${${target_array_name}[@]}\")"

  for existing in "${current_values[@]}"; do
    if [[ "$existing" == "$value" ]]; then
      return 0
    fi
  done

  eval "$target_array_name+=(\"\$value\")"
}

has_tag() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

changed_domains=()
doc_review_triggers=()
high_risk_files=()
changed_doc_areas=()
navigation_files=()
current_state_doc_files=()
reference_doc_files=()
generated_doc_files=()
decision_doc_files=()
plan_doc_files=()
history_doc_files=()
scorecard_doc_files=()

doc_count=0
test_count=0
other_count=0

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  file_is_doc=0
  file_is_test=0

  if is_doc_file "$file"; then
    file_is_doc=1
    ((doc_count+=1))

    if is_navigation_file "$file"; then
      add_unique changed_domains "navigation"
      add_unique changed_doc_areas "navigation-docs"
      add_unique doc_review_triggers "navigation"
      navigation_files+=("$file")
    fi

    if is_current_state_doc_file "$file" && ! is_decision_doc_file "$file"; then
      add_unique changed_doc_areas "current-state-docs"
      current_state_doc_files+=("$file")
    fi

    if is_decision_doc_file "$file"; then
      add_unique changed_doc_areas "decision-docs"
      decision_doc_files+=("$file")
    fi

    if is_reference_doc_file "$file"; then
      add_unique changed_doc_areas "reference-docs"
      reference_doc_files+=("$file")
    fi

    if is_generated_doc_file "$file"; then
      add_unique changed_doc_areas "generated-docs"
      add_unique doc_review_triggers "generated-artifacts"
      generated_doc_files+=("$file")
    fi

    if is_scorecard_file "$file"; then
      add_unique changed_doc_areas "scorecard-docs"
      scorecard_doc_files+=("$file")
    fi

    if is_plan_file "$file"; then
      add_unique changed_domains "plans"
      add_unique changed_doc_areas "plan-docs"
      plan_doc_files+=("$file")
    fi

    if is_history_doc_file "$file"; then
      add_unique changed_doc_areas "history-docs"
      history_doc_files+=("$file")
    fi
  elif is_test_file "$file"; then
    file_is_test=1
    ((test_count+=1))
  else
    ((other_count+=1))
  fi

  if [[ "$file_is_doc" -eq 0 ]] && [[ "$file_is_test" -eq 0 ]]; then
    case "$file" in
      api/*|*schemas.py|*openapi*|*contract*|*request*|*response*)
        has_tag "api" "${changed_domains[@]}" || changed_domains+=("api")
        has_tag "public-behavior" "${doc_review_triggers[@]}" || doc_review_triggers+=("public-behavior")
        has_tag "external-contracts" "${doc_review_triggers[@]}" || doc_review_triggers+=("external-contracts")
        high_risk_files+=("$file")
        ;;
    esac

    case "$file" in
      src/runtime/*|*scheduler*|*schedule*|*run_*|*runner*|*trigger*)
        has_tag "runtime" "${changed_domains[@]}" || changed_domains+=("runtime")
        has_tag "public-behavior" "${doc_review_triggers[@]}" || doc_review_triggers+=("public-behavior")
        has_tag "architecture" "${doc_review_triggers[@]}" || doc_review_triggers+=("architecture")
        high_risk_files+=("$file")
        ;;
    esac

    case "$file" in
      src/application/*|*planner*|*strategy*|*execution*|*collector*|*memory*)
        has_tag "application" "${changed_domains[@]}" || changed_domains+=("application")
        has_tag "architecture" "${doc_review_triggers[@]}" || doc_review_triggers+=("architecture")
        high_risk_files+=("$file")
        ;;
    esac

    case "$file" in
      src/adapters/*|*provider*|*callback*|*integration*)
        has_tag "adapters" "${changed_domains[@]}" || changed_domains+=("adapters")
        has_tag "external-contracts" "${doc_review_triggers[@]}" || doc_review_triggers+=("external-contracts")
        has_tag "architecture" "${doc_review_triggers[@]}" || doc_review_triggers+=("architecture")
        high_risk_files+=("$file")
        ;;
    esac

    case "$file" in
      *model*|*models.py|*schema*|*migration*|*alembic*|*state*)
        has_tag "state-model" "${changed_domains[@]}" || changed_domains+=("state-model")
        has_tag "state-model" "${doc_review_triggers[@]}" || doc_review_triggers+=("state-model")
        high_risk_files+=("$file")
        ;;
    esac
  fi

  if is_plan_file "$file"; then
    add_unique changed_domains "plans"
  fi
done <<< "$all_files"

classification=()

if [[ "$doc_count" -gt 0 ]] && [[ "$other_count" -eq 0 ]] && [[ "$test_count" -eq 0 ]]; then
  classification+=("only-docs")
fi

if [[ "$test_count" -gt 0 ]] && [[ "$other_count" -eq 0 ]] && [[ "$doc_count" -eq 0 ]]; then
  classification+=("only-tests")
fi

if [[ "$doc_count" -gt 0 ]] && [[ "$test_count" -gt 0 ]] && [[ "$other_count" -eq 0 ]]; then
  classification+=("tests-and-docs-only")
fi

if [[ "${#classification[@]}" -eq 0 ]]; then
  classification+=("mixed-or-code")
fi

for tag in "${changed_doc_areas[@]}"; do
  add_unique classification "$tag"
done

for tag in "${changed_domains[@]}"; do
  add_unique classification "$tag"
done

layout_tags=()
preferred_targets=()
current_state_targets=()
reference_targets=()
decision_targets=()
plan_targets=()
navigation_targets=()
scorecard_targets=()
split_doc_domains=()
missing_index_targets=()
missing_plan_scaffold_targets=()

has_split_domain=0
has_core_docs_beyond_readme=0
doc_system_mode=
mode_reason=
preferred_mode_doc=

add_existing_target() {
  local array_name="$1"
  local path="$2"

  if has_file "$path"; then
    add_unique "$array_name" "$path"
  fi
}

if has_file "AGENTS.md"; then
  layout_tags+=("has-agents")
  navigation_targets+=("AGENTS.md")
fi
if has_file "ARCHITECTURE.md"; then
  layout_tags+=("has-architecture")
  navigation_targets+=("ARCHITECTURE.md")
  current_state_targets+=("ARCHITECTURE.md")
fi
if has_file "docs/core"; then
  layout_tags+=("docs-core")
  split_doc_domains+=("docs/core")
  current_state_targets+=("docs/core/")
fi
if has_file "docs/design-docs"; then
  layout_tags+=("docs-design-docs")
  split_doc_domains+=("docs/design-docs")
  current_state_targets+=("docs/design-docs/")
fi
if has_file "docs/product-specs"; then
  layout_tags+=("docs-product-specs")
  split_doc_domains+=("docs/product-specs")
  current_state_targets+=("docs/product-specs/")
fi
if has_file "docs/design-docs/index.md"; then
  navigation_targets+=("docs/design-docs/index.md")
fi
if has_file "docs/product-specs/index.md"; then
  navigation_targets+=("docs/product-specs/index.md")
fi
if has_file "docs/references"; then
  layout_tags+=("docs-references")
  split_doc_domains+=("docs/references")
  reference_targets+=("docs/references/")
fi
if has_file "docs/references/index.md"; then
  navigation_targets+=("docs/references/index.md")
fi
if has_file "docs/generated"; then
  layout_tags+=("docs-generated")
  split_doc_domains+=("docs/generated")
  reference_targets+=("docs/generated/")
fi
if has_file "docs/exec-plans"; then
  layout_tags+=("docs-exec-plans")
  split_doc_domains+=("docs/exec-plans")
  plan_targets+=("docs/exec-plans/")
  if has_file "docs/exec-plans/index.md"; then
    navigation_targets+=("docs/exec-plans/index.md")
    plan_targets+=("docs/exec-plans/index.md")
  fi
  if has_file "docs/exec-plans/active"; then
    plan_targets+=("docs/exec-plans/active/")
    if ! dir_has_entries "docs/exec-plans/active"; then
      missing_plan_scaffold_targets+=("docs/exec-plans/active/.gitkeep")
    fi
  else
    missing_plan_scaffold_targets+=("docs/exec-plans/active/")
  fi
  if has_file "docs/exec-plans/completed"; then
    plan_targets+=("docs/exec-plans/completed/")
    if ! dir_has_entries "docs/exec-plans/completed"; then
      missing_plan_scaffold_targets+=("docs/exec-plans/completed/.gitkeep")
    fi
  else
    missing_plan_scaffold_targets+=("docs/exec-plans/completed/")
  fi
fi
if has_file "docs/history"; then
  layout_tags+=("docs-history")
fi

for path in README.md PROJECT_BRIEF.md docs/PROJECT_BRIEF.md DESIGN.md docs/DESIGN.md FRONTEND.md docs/FRONTEND.md PRODUCT_SENSE.md docs/PRODUCT_SENSE.md RELIABILITY.md docs/RELIABILITY.md SECURITY.md docs/SECURITY.md; do
  add_existing_target current_state_targets "$path"
done

for path in DECISIONS.md docs/DECISIONS.md ADR.md docs/ADR.md docs/decisions/ docs/adr/ docs/design-docs/decision-log.md docs/design-docs/decisions/ docs/design-docs/adr/ docs/design-docs/adrs/; do
  add_existing_target decision_targets "$path"
done

for path in PLANS.md docs/PLANS.md; do
  add_existing_target plan_targets "$path"
done

for path in QUALITY_SCORE.md docs/QUALITY_SCORE.md; do
  add_existing_target scorecard_targets "$path"
done

if [[ "${#scorecard_targets[@]}" -gt 0 ]]; then
  layout_tags+=("has-quality-score")
fi

for path in PROJECT_BRIEF.md docs/PROJECT_BRIEF.md DESIGN.md docs/DESIGN.md FRONTEND.md docs/FRONTEND.md PRODUCT_SENSE.md docs/PRODUCT_SENSE.md DECISIONS.md docs/DECISIONS.md RELIABILITY.md docs/RELIABILITY.md SECURITY.md docs/SECURITY.md PLANS.md docs/PLANS.md QUALITY_SCORE.md docs/QUALITY_SCORE.md RISKS.md docs/RISKS.md OPEN_QUESTIONS.md docs/OPEN_QUESTIONS.md ASSUMPTIONS.md docs/ASSUMPTIONS.md API.md docs/API.md SCHEMA.md docs/SCHEMA.md; do
  if has_file "$path"; then
    has_core_docs_beyond_readme=1
    break
  fi
done

if has_tag "navigation" "${doc_review_triggers[@]}"; then
  for target in "${navigation_targets[@]}"; do
    add_unique preferred_targets "$target"
  done
fi

if has_tag "navigation-docs" "${changed_doc_areas[@]}"; then
  for target in "${navigation_targets[@]}"; do
    add_unique preferred_targets "$target"
  done
fi

if has_tag "architecture" "${doc_review_triggers[@]}" \
  || has_tag "public-behavior" "${doc_review_triggers[@]}" \
  || has_tag "current-state-docs" "${changed_doc_areas[@]}"; then
  for target in "${current_state_targets[@]}"; do
    add_unique preferred_targets "$target"
  done
fi

if has_tag "external-contracts" "${doc_review_triggers[@]}" \
  || has_tag "state-model" "${doc_review_triggers[@]}" \
  || has_tag "generated-artifacts" "${doc_review_triggers[@]}" \
  || has_tag "api" "${changed_domains[@]}" \
  || has_tag "reference-docs" "${changed_doc_areas[@]}" \
  || has_tag "generated-docs" "${changed_doc_areas[@]}"; then
  for target in "${reference_targets[@]}"; do
    add_unique preferred_targets "$target"
  done
fi

if has_tag "plans" "${changed_domains[@]}"; then
  for target in "${plan_targets[@]}"; do
    add_unique preferred_targets "$target"
  done
fi

if has_tag "scorecard-docs" "${changed_doc_areas[@]}"; then
  for target in "${scorecard_targets[@]}"; do
    add_unique preferred_targets "$target"
  done
fi

if has_tag "decision-docs" "${changed_doc_areas[@]}"; then
  for target in "${decision_targets[@]}"; do
    add_unique preferred_targets "$target"
  done
fi

if [[ "${#preferred_targets[@]}" -eq 0 ]]; then
  for target in \
    "${navigation_targets[@]}" \
    "${current_state_targets[@]}" \
    "${reference_targets[@]}" \
    "${plan_targets[@]}" \
    "${decision_targets[@]}"; do
    add_unique preferred_targets "$target"
  done
fi

if [[ "${#split_doc_domains[@]}" -gt 0 ]]; then
  has_split_domain=1
fi

for path in docs/core docs/design-docs docs/product-specs docs/references docs/exec-plans; do
  if has_file "$path" && ! has_file "$path/index.md"; then
    missing_index_targets+=("$path/index.md")
  fi
done

if [[ "${#missing_index_targets[@]}" -gt 0 ]]; then
  doc_system_mode="repair"
  mode_reason="missing-split-doc-indexes"
elif [[ "${#missing_plan_scaffold_targets[@]}" -gt 0 ]]; then
  doc_system_mode="repair"
  mode_reason="incomplete-exec-plan-scaffold"
elif [[ "$has_split_domain" -eq 1 ]] && has_tag "navigation" "${doc_review_triggers[@]}"; then
  doc_system_mode="repair"
  mode_reason="navigation-drift-in-doc-system"
elif [[ "$has_split_domain" -eq 1 ]] && [[ "${#preferred_targets[@]}" -eq 0 ]]; then
  doc_system_mode="repair"
  mode_reason="doc-system-without-preferred-targets"
elif [[ "$has_split_domain" -eq 1 ]]; then
  doc_system_mode="structured"
  mode_reason="split-doc-domains-present"
elif has_file "AGENTS.md" || has_file "ARCHITECTURE.md" || [[ "$has_core_docs_beyond_readme" -eq 1 ]]; then
  doc_system_mode="minimal"
  mode_reason="core-docs-without-split-domains"
else
  doc_system_mode="bootstrap"
  mode_reason="no-doc-system"
fi

preferred_mode_doc="modes/$doc_system_mode.md"

knowledge_phase=
problem_frame_state=
boundary_state=
decision_state=
contract_state=
validation_state=
foundation_gaps=()

if has_any_file \
  "README.md" \
  "PROJECT_BRIEF.md" \
  "docs/PROJECT_BRIEF.md" \
  "PRODUCT_SENSE.md" \
  "docs/PRODUCT_SENSE.md" \
  "docs/product-specs" \
  "docs/product-specs/index.md"; then
  problem_frame_state="present"
else
  problem_frame_state="missing"
fi

if has_any_file \
  "ARCHITECTURE.md" \
  "DESIGN.md" \
  "docs/DESIGN.md" \
  "FRONTEND.md" \
  "docs/FRONTEND.md" \
  "docs/core" \
  "docs/design-docs"; then
  boundary_state="present"
else
  boundary_state="missing"
fi

decision_pressure=0
if [[ "${#high_risk_files[@]}" -gt 0 ]] \
  || has_tag "architecture" "${doc_review_triggers[@]}" \
  || has_tag "application" "${changed_domains[@]}" \
  || has_tag "runtime" "${changed_domains[@]}" \
  || has_tag "plans" "${changed_domains[@]}"; then
  decision_pressure=1
fi

if has_any_file \
  "DECISIONS.md" \
  "docs/DECISIONS.md" \
  "ADR.md" \
  "docs/ADR.md" \
  "docs/decisions" \
  "docs/adr" \
  "docs/design-docs/decision-log.md" \
  "docs/design-docs/decisions" \
  "docs/design-docs/adr" \
  "docs/design-docs/adrs"; then
  decision_state="present"
elif [[ "$decision_pressure" -eq 1 ]]; then
  decision_state="missing"
else
  decision_state="not-needed-yet"
fi

contract_pressure=0
if has_tag "external-contracts" "${doc_review_triggers[@]}" \
  || has_tag "state-model" "${doc_review_triggers[@]}" \
  || has_tag "generated-artifacts" "${doc_review_triggers[@]}" \
  || has_tag "api" "${changed_domains[@]}"; then
  contract_pressure=1
fi

if has_any_file \
  "docs/references" \
  "docs/generated" \
  "API.md" \
  "docs/API.md" \
  "SCHEMA.md" \
  "docs/SCHEMA.md" \
  "openapi.yaml" \
  "openapi.yml" \
  "openapi.json"; then
  contract_state="present"
elif [[ "$contract_pressure" -eq 1 ]]; then
  contract_state="missing"
else
  contract_state="not-needed-yet"
fi

if has_any_file \
  "PLANS.md" \
  "docs/PLANS.md" \
  "QUALITY_SCORE.md" \
  "docs/QUALITY_SCORE.md" \
  "RELIABILITY.md" \
  "docs/RELIABILITY.md" \
  "SECURITY.md" \
  "docs/SECURITY.md" \
  "RISKS.md" \
  "docs/RISKS.md" \
  "OPEN_QUESTIONS.md" \
  "docs/OPEN_QUESTIONS.md" \
  "ASSUMPTIONS.md" \
  "docs/ASSUMPTIONS.md" \
  "docs/exec-plans"; then
  validation_state="present"
else
  validation_state="missing"
fi

if [[ "$problem_frame_state" == "missing" ]]; then
  foundation_gaps+=("problem-frame")
fi

if [[ "$boundary_state" == "missing" ]]; then
  foundation_gaps+=("system-boundaries")
fi

if [[ "$decision_state" == "missing" ]]; then
  foundation_gaps+=("decision-log")
fi

if [[ "$contract_state" == "missing" ]]; then
  foundation_gaps+=("contract-docs")
fi

if [[ "$validation_state" == "missing" ]]; then
  foundation_gaps+=("validation-plan")
fi

if [[ "$doc_system_mode" == "bootstrap" ]] \
  || { [[ "$doc_system_mode" == "minimal" ]] && [[ "$problem_frame_state" == "missing" ]]; }; then
  knowledge_phase="framing"
elif [[ "$boundary_state" == "missing" ]] || [[ "$decision_state" == "missing" ]]; then
  knowledge_phase="design"
elif [[ "$contract_state" == "missing" ]]; then
  knowledge_phase="contracts"
else
  knowledge_phase="operations"
fi

if has_tag "only-tests" "${classification[@]}"; then
  doc_refresh_hint="usually-no-doc-update"
elif has_tag "only-docs" "${classification[@]}"; then
  doc_refresh_hint="docs-already-touched"
elif has_tag "navigation" "${doc_review_triggers[@]}"; then
  doc_refresh_hint="review-map-and-authority-docs"
elif [[ "${#doc_review_triggers[@]}" -gt 0 ]]; then
  doc_refresh_hint="review-authoritative-docs"
else
  doc_refresh_hint="inspect-diff-before-deciding"
fi

echo "repo_root=$repo_root"
echo
echo "[repo_layout]"
echo "tags=$(to_csv "${layout_tags[@]}")"
echo "preferred_targets=$(to_csv "${preferred_targets[@]}")"
echo "navigation_targets=$(to_csv "${navigation_targets[@]}")"
echo "current_state_targets=$(to_csv "${current_state_targets[@]}")"
echo "reference_targets=$(to_csv "${reference_targets[@]}")"
echo "decision_targets=$(to_csv "${decision_targets[@]}")"
echo "plan_targets=$(to_csv "${plan_targets[@]}")"
echo "scorecard_targets=$(to_csv "${scorecard_targets[@]}")"
echo "missing_index_targets=$(to_csv "${missing_index_targets[@]}")"
echo "missing_plan_scaffold_targets=$(to_csv "${missing_plan_scaffold_targets[@]}")"
echo
echo "[routing]"
echo "doc_system_mode=$doc_system_mode"
echo "mode_reason=$mode_reason"
echo "preferred_mode_doc=$preferred_mode_doc"
echo
echo "[knowledge]"
echo "knowledge_phase=$knowledge_phase"
echo "problem_frame_state=$problem_frame_state"
echo "boundary_state=$boundary_state"
echo "decision_state=$decision_state"
echo "contract_state=$contract_state"
echo "validation_state=$validation_state"
echo "foundation_gaps=$(to_csv "${foundation_gaps[@]}")"
echo
echo "[classification]"
echo "classes=$(to_csv "${classification[@]}")"
echo "doc_review_triggers=$(to_csv "${doc_review_triggers[@]}")"
echo "doc_refresh_hint=$doc_refresh_hint"
echo
echo "[documentation_areas]"
echo "changed_doc_areas=$(to_csv "${changed_doc_areas[@]}")"
echo "navigation_files=$(to_csv "${navigation_files[@]}")"
echo "current_state_doc_files=$(to_csv "${current_state_doc_files[@]}")"
echo "reference_doc_files=$(to_csv "${reference_doc_files[@]}")"
echo "generated_doc_files=$(to_csv "${generated_doc_files[@]}")"
echo "decision_doc_files=$(to_csv "${decision_doc_files[@]}")"
echo "plan_doc_files=$(to_csv "${plan_doc_files[@]}")"
echo "history_doc_files=$(to_csv "${history_doc_files[@]}")"
echo "scorecard_doc_files=$(to_csv "${scorecard_doc_files[@]}")"
echo
echo "[git_status_short]"
if [[ -n "$status_short" ]]; then
  printf '%s\n' "$status_short"
else
  echo "(clean)"
fi
echo
echo "[changed_files]"
if [[ -n "$all_files" ]]; then
  printf '%s\n' "$all_files"
else
  echo "(none)"
fi
echo
echo "[high_risk_files]"
if [[ "${#high_risk_files[@]}" -gt 0 ]]; then
  printf '%s\n' "${high_risk_files[@]}" | awk 'NF' | sort -u
else
  echo "(none)"
fi
echo
echo "[unstaged_diff_stat]"
if [[ -n "$unstaged_stat" ]]; then
  printf '%s\n' "$unstaged_stat"
else
  echo "(none)"
fi
echo
echo "[staged_diff_stat]"
if [[ -n "$staged_stat" ]]; then
  printf '%s\n' "$staged_stat"
else
  echo "(none)"
fi
