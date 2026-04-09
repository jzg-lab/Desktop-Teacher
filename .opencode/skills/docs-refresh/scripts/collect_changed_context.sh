#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

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

dir_entry_count() {
  local path="$1"

  if [[ ! -d "$repo_root/$path" ]]; then
    echo 0
    return
  fi

  find "$repo_root/$path" -mindepth 1 -maxdepth 1 | wc -l | awk '{print $1}'
}

lowercase() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

domain_path_for_file() {
  local path="$1"

  if [[ "$path" =~ ^docs/([^/]+)(/|$) ]]; then
    printf 'docs/%s\n' "${BASH_REMATCH[1]}"
  fi
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

is_current_state_top_level_doc() {
  local path="$1"
  [[ "$path" =~ (^|/)(README)(\.[^.]+)?$ ]] \
    || [[ "$path" =~ (^|/)(PROJECT_BRIEF|ARCHITECTURE|DESIGN|FRONTEND|PRODUCT_SENSE)(\.[^.]+)?$ ]]
}

is_decision_doc_file() {
  local path="$1"
  [[ "$path" =~ (^|/)(DECISIONS|ADR)(\.[^.]+)?$ ]] \
    || [[ "$path" =~ (^|/)docs(/[^/]+)?/(decisions|adr|adrs)(/|$) ]] \
    || [[ "$path" =~ (^|/)docs/[^/]+/decision-log\.md$ ]]
}

is_scorecard_file() {
  local path="$1"
  [[ "$path" =~ (^|/)(QUALITY_SCORE)(\.[^.]+)?$ ]]
}

is_validation_doc_file() {
  local path="$1"
  [[ "$path" =~ (^|/)(PLANS|QUALITY_SCORE|RELIABILITY|SECURITY|RISKS|OPEN_QUESTIONS|ASSUMPTIONS)(\.[^.]+)?$ ]]
}

is_plan_file() {
  local path="$1"
  local name="${path##*/}"
  local stem="${name%.*}"

  [[ "$path" =~ (^|/)docs/exec-plans/ ]] && return 0
  [[ "$path" =~ (^|/)(PLANS)(\.[^.]+)?$ ]] && return 0
  [[ "$name" =~ \.(md|mdx|rst|adoc|txt)$ ]] || return 1

  [[ "$stem" =~ (^|.*[._-])([Pp]lans?|[Rr]oadmap|[Dd]ebt|[Bb]acklog|[Mm]ilestones?)([._-].*|$) ]] \
    || [[ "$stem" =~ ([Pp]lans?|[Rr]oadmap|[Dd]ebt|[Bb]acklog|[Mm]ilestones?)$ ]]
}

is_history_doc_file() {
  local path="$1"
  [[ "$path" =~ (^|/)docs/history/ ]] \
    || [[ "$path" =~ (^|/)(CHANGELOG|HISTORY|RELEASE_NOTES)(\.[^.]+)?$ ]]
}

looks_like_contract_file() {
  local path_lc="$1"

  case "$path_lc" in
    api/*|*/api/*|*openapi*|*.proto|*/schema/*|*/schemas/*|*schema.json|*schema.yml|*schema.yaml|*contract*)
      return 0
      ;;
  esac

  return 1
}

looks_like_runtime_file() {
  local path_lc="$1"

  case "$path_lc" in
    src/runtime/*|*/runtime/*|*/scheduler/*|*/schedules/*|*/trigger/*|*/runner/*|*scheduler*|*trigger*)
      return 0
      ;;
  esac

  return 1
}

looks_like_application_file() {
  local path_lc="$1"

  case "$path_lc" in
    src/application/*|*/application/*|*planner*|*strategy*|*execution*|*collector*|*memory*)
      return 0
      ;;
  esac

  return 1
}

looks_like_state_model_file() {
  local path_lc="$1"

  case "$path_lc" in
    */state/*|*state-machine*|*state_machine*|*state-model*|*schema.json|*schema.yml|*schema.yaml|*/schema/*|*/schemas/*|*migration*|*alembic*)
      return 0
      ;;
  esac

  return 1
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

lookup_domain_field() {
  local path="$1"
  local field="$2"
  local idx

  for idx in "${!domain_paths[@]}"; do
    if [[ "${domain_paths[$idx]}" == "$path" ]]; then
      case "$field" in
        role)
          printf '%s\n' "${domain_roles[$idx]}"
          return 0
          ;;
        origin)
          printf '%s\n' "${domain_origins[$idx]}"
          return 0
          ;;
        canonical)
          printf '%s\n' "${domain_canonical_targets[$idx]}"
          return 0
          ;;
      esac
    fi
  done

  return 1
}

lookup_domain_role_for_file() {
  local path="$1"
  local domain

  domain="$(domain_path_for_file "$path")"
  if [[ -z "$domain" ]]; then
    return 1
  fi

  lookup_domain_field "$domain" role
}

domain_theme() {
  local path="$1"
  local base
  local base_lc

  base="${path##*/}"
  base_lc="$(lowercase "$base")"

  case "$base_lc" in
    product*|*product*|*spec*|*brief*|*vision*|*requirements*|*roadmap*)
      echo "product"
      ;;
    core|design*|architecture*|frontend*|system*|components*|platform*)
      echo "design"
      ;;
    runbook*|ops*|operation*|reliability*|security*|quality*|observab*|score*)
      echo "validation"
      ;;
    reference*|schema*|api*|contract*|generated*|protocol*|prompt*)
      echo "reference"
      ;;
    decision*|adr*|adrs*)
      echo "decision"
      ;;
    history*|release*|changelog*)
      echo "history"
      ;;
    *)
      echo
      ;;
  esac
}

infer_domain_role() {
  local path="$1"
  local base
  local base_lc

  base="${path##*/}"
  base_lc="$(lowercase "$base")"

  case "$base_lc" in
    core|design-docs|architecture*|design*|frontend*|system*|components*|platform*|product*|spec*|brief*|guides|guide|handbook)
      echo "current-state"
      ;;
    references|reference*|schema*|api*|contract*|generated*|protocol*|prompt*)
      echo "reference"
      ;;
    exec-plans|plan*|roadmap*|backlog*|debt*|milestone*|delivery*|execution*)
      echo "planning"
      ;;
    runbook*|ops*|operation*|reliability*|security*|quality*|score*|observab*)
      echo "validation"
      ;;
    decisions|decision*|adr|adrs*)
      echo "decision"
      ;;
    history|release*|changelog*)
      echo "history"
      ;;
    old_docs|archive*|archives|legacy*)
      echo "archive"
      ;;
    *)
      echo
      ;;
  esac
}

canonical_target_for_domain() {
  local path="$1"
  local role="$2"
  local theme

  case "$path" in
    docs/core)
      echo "docs/core/"
      return 0
      ;;
    docs/design-docs)
      echo "docs/design-docs/"
      return 0
      ;;
    docs/product-specs)
      echo "docs/product-specs/"
      return 0
      ;;
    docs/references)
      echo "docs/references/"
      return 0
      ;;
    docs/generated)
      echo "docs/generated/"
      return 0
      ;;
    docs/exec-plans)
      echo "docs/exec-plans/"
      return 0
      ;;
  esac

  theme="$(domain_theme "$path")"

  case "$role" in
    planning)
      echo "docs/exec-plans/"
      ;;
    reference)
      case "$theme" in
        reference)
          if [[ "$path" =~ generated ]]; then
            echo "docs/generated/"
          else
            echo "docs/references/"
          fi
          ;;
      esac
      ;;
    current-state)
      case "$theme" in
        product)
          echo "docs/product-specs/"
          ;;
        design)
          echo "docs/design-docs/"
          ;;
      esac
      ;;
  esac
}

register_domain() {
  local path="$1"
  local role="$2"
  local origin="$3"
  local canonical_target="$4"
  local idx

  for idx in "${!domain_paths[@]}"; do
    if [[ "${domain_paths[$idx]}" == "$path" ]]; then
      return 0
    fi
  done

  domain_paths+=("$path")
  domain_roles+=("$role")
  domain_origins+=("$origin")
  domain_canonical_targets+=("$canonical_target")

  add_unique role_map "$path:$role"

  if [[ "$path" =~ ^docs/ ]] && [[ "$role" != "archive" ]]; then
    add_unique split_doc_domains "$path"
  fi

  if [[ "$origin" == "standard" ]]; then
    add_unique standard_domains "$path"
  else
    add_unique custom_domains "$path"
  fi

  if has_file "$path/index.md"; then
    add_unique navigation_targets "$path/index.md"
  fi

  case "$role" in
    current-state)
      add_unique current_state_targets "$path/"
      add_unique current_state_domains "$path"
      ;;
    reference)
      add_unique reference_targets "$path/"
      add_unique reference_domains "$path"
      ;;
    planning)
      add_unique plan_targets "$path/"
      add_unique planning_domains "$path"
      if [[ "$origin" == "custom" ]]; then
        add_unique custom_planning_domains "$path"
      fi
      ;;
    validation)
      add_unique validation_targets "$path/"
      add_unique validation_domains "$path"
      ;;
    decision)
      add_unique decision_targets "$path/"
      add_unique decision_domains "$path"
      ;;
    history)
      add_unique history_domains "$path"
      ;;
    archive)
      add_unique archive_domains "$path"
      ;;
    unclassified)
      add_unique unclassified_domains "$path"
      ;;
  esac
}

register_candidate() {
  local source="$1"
  local target="$2"
  local idx

  if [[ -z "$target" ]]; then
    return 0
  fi

  for idx in "${!candidate_sources[@]}"; do
    if [[ "${candidate_sources[$idx]}" == "$source" ]] && [[ "${candidate_targets[$idx]}" == "$target" ]]; then
      return 0
    fi
  done

  candidate_sources+=("$source")
  candidate_targets+=("$target")
  add_unique normalization_candidates "$source->$target"
}

count_candidates_for_target() {
  local target="$1"
  local count=0
  local idx

  for idx in "${!candidate_targets[@]}"; do
    if [[ "${candidate_targets[$idx]}" == "$target" ]]; then
      ((count+=1))
    fi
  done

  echo "$count"
}

domain_requires_index() {
  local path="$1"
  local role="$2"
  local entries

  case "$path" in
    docs/core|docs/design-docs|docs/product-specs|docs/references|docs/exec-plans)
      return 0
      ;;
  esac

  entries="$(dir_entry_count "$path")"

  case "$role" in
    current-state|planning|validation|decision)
      [[ "$entries" -gt 1 ]]
      return
      ;;
    reference)
      [[ "$entries" -gt 1 ]] && [[ "$path" != "docs/generated" ]]
      return
      ;;
  esac

  return 1
}

domain_supports_problem_frame() {
  local path="$1"
  local canonical
  local theme

  canonical="$(lookup_domain_field "$path" canonical 2>/dev/null || true)"
  theme="$(domain_theme "$path")"

  [[ "$canonical" == "docs/product-specs/" ]] || [[ "$theme" == "product" ]]
}

domain_supports_boundaries() {
  local path="$1"
  local canonical
  local theme

  canonical="$(lookup_domain_field "$path" canonical 2>/dev/null || true)"
  theme="$(domain_theme "$path")"

  [[ "$path" == "docs/core" ]] || [[ "$canonical" == "docs/design-docs/" ]] || [[ "$theme" == "design" ]]
}

domain_supports_validation() {
  local path="$1"
  local role

  role="$(lookup_domain_field "$path" role 2>/dev/null || true)"
  [[ "$role" == "validation" ]]
}

domain_supports_contracts() {
  local path="$1"
  local role

  role="$(lookup_domain_field "$path" role 2>/dev/null || true)"
  [[ "$role" == "reference" ]]
}

plan_file_has_done_status() {
  local path="$1"

  grep -qiE '(状态|status)[[:space:]]*[：:][[:space:]]*(done|complete|completed|完成|已完成|✓)' "$path" 2>/dev/null
}

add_existing_target() {
  local array_name="$1"
  local path="$2"

  if has_file "$path"; then
    add_unique "$array_name" "$path"
  fi
}

domain_paths=()
domain_roles=()
domain_origins=()
domain_canonical_targets=()

role_map=()
split_doc_domains=()
standard_domains=()
custom_domains=()
unclassified_domains=()
current_state_domains=()
reference_domains=()
planning_domains=()
validation_domains=()
decision_domains=()
history_domains=()
archive_domains=()
custom_planning_domains=()

candidate_sources=()
candidate_targets=()
normalization_candidates=()
migration_candidates=()
archive_targets=()

layout_tags=()
preferred_targets=()
navigation_targets=()
current_state_targets=()
reference_targets=()
decision_targets=()
plan_targets=()
validation_targets=()
scorecard_targets=()
missing_index_targets=()
missing_plan_scaffold_targets=()

if has_file "AGENTS.md"; then
  add_unique layout_tags "has-agents"
  add_unique navigation_targets "AGENTS.md"
fi

if has_file "ARCHITECTURE.md"; then
  add_unique layout_tags "has-architecture"
  add_unique navigation_targets "ARCHITECTURE.md"
  add_unique current_state_targets "ARCHITECTURE.md"
fi

if has_file "docs/core"; then
  add_unique layout_tags "docs-core"
  register_domain "docs/core" "current-state" "standard" "docs/core/"
fi

if has_file "docs/design-docs"; then
  add_unique layout_tags "docs-design-docs"
  register_domain "docs/design-docs" "current-state" "standard" "docs/design-docs/"
fi

if has_file "docs/product-specs"; then
  add_unique layout_tags "docs-product-specs"
  register_domain "docs/product-specs" "current-state" "standard" "docs/product-specs/"
fi

if has_file "docs/references"; then
  add_unique layout_tags "docs-references"
  register_domain "docs/references" "reference" "standard" "docs/references/"
fi

if has_file "docs/generated"; then
  add_unique layout_tags "docs-generated"
  register_domain "docs/generated" "reference" "standard" "docs/generated/"
fi

if has_file "docs/exec-plans"; then
  add_unique layout_tags "docs-exec-plans"
  register_domain "docs/exec-plans" "planning" "standard" "docs/exec-plans/"
fi

if has_file "docs/history"; then
  add_unique layout_tags "docs-history"
  register_domain "docs/history" "history" "standard" ""
fi

if [[ -d "$repo_root/docs" ]]; then
  for abs_dir in "$repo_root"/docs/*/; do
    rel_dir="${abs_dir#$repo_root/}"
    rel_dir="${rel_dir%/}"

    case "$rel_dir" in
      docs/core|docs/design-docs|docs/product-specs|docs/references|docs/generated|docs/exec-plans|docs/history)
        continue
        ;;
    esac

    role="$(infer_domain_role "$rel_dir")"
    canonical_target="$(canonical_target_for_domain "$rel_dir" "${role:-}")"

    if [[ -n "$role" ]]; then
      register_domain "$rel_dir" "$role" "custom" "$canonical_target"
    else
      register_domain "$rel_dir" "unclassified" "custom" ""
    fi

    if [[ -n "$canonical_target" ]] && [[ "$rel_dir/" != "$canonical_target" ]]; then
      register_candidate "$rel_dir" "$canonical_target"
    fi
  done
fi

if [[ -d "$repo_root/old_docs" ]]; then
  register_domain "old_docs" "archive" "custom" ""
fi

for path in README.md PROJECT_BRIEF.md docs/PROJECT_BRIEF.md DESIGN.md docs/DESIGN.md FRONTEND.md docs/FRONTEND.md PRODUCT_SENSE.md docs/PRODUCT_SENSE.md; do
  add_existing_target current_state_targets "$path"
done

for path in DECISIONS.md docs/DECISIONS.md ADR.md docs/ADR.md docs/decisions/ docs/adr/ docs/design-docs/decision-log.md docs/design-docs/decisions/ docs/design-docs/adr/ docs/design-docs/adrs/; do
  add_existing_target decision_targets "$path"
done

for path in PLANS.md docs/PLANS.md; do
  add_existing_target plan_targets "$path"
  add_existing_target validation_targets "$path"
done

for path in QUALITY_SCORE.md docs/QUALITY_SCORE.md; do
  add_existing_target scorecard_targets "$path"
  add_existing_target validation_targets "$path"
done

for path in RELIABILITY.md docs/RELIABILITY.md SECURITY.md docs/SECURITY.md RISKS.md docs/RISKS.md OPEN_QUESTIONS.md docs/OPEN_QUESTIONS.md ASSUMPTIONS.md docs/ASSUMPTIONS.md; do
  add_existing_target validation_targets "$path"
done

if [[ "${#scorecard_targets[@]}" -gt 0 ]]; then
  add_unique layout_tags "has-quality-score"
fi

for domain in "${domain_paths[@]}"; do
  role="$(lookup_domain_field "$domain" role)"
  origin="$(lookup_domain_field "$domain" origin)"
  target="$(lookup_domain_field "$domain" canonical)"

  if domain_requires_index "$domain" "$role" && ! has_file "$domain/index.md"; then
    add_unique missing_index_targets "$domain/index.md"
  fi

  if [[ "$origin" == "custom" ]] && [[ -n "$target" ]]; then
    candidate_count="$(count_candidates_for_target "$target")"
    if [[ "$target" == "docs/exec-plans/" ]] || has_file "${target%/}" || [[ "$candidate_count" -gt 1 ]]; then
      add_unique migration_candidates "$domain->$target"
      if [[ "$domain" =~ ^docs/ ]]; then
        add_unique archive_targets "old_docs/${domain#docs/}/"
      fi
    fi
  fi
done

plan_scaffold_state="missing"
planning_surface_state="absent"
active_plan_target="docs/exec-plans/active/"
plan_readiness="not-earned-yet"

if has_file "docs/exec-plans"; then
  planning_surface_state="standard"
  plan_scaffold_state="ready"

  if has_file "docs/exec-plans/index.md"; then
    add_unique plan_targets "docs/exec-plans/index.md"
  else
    plan_scaffold_state="partial"
  fi

  if has_file "docs/exec-plans/active"; then
    add_unique plan_targets "docs/exec-plans/active/"
    if ! dir_has_entries "docs/exec-plans/active"; then
      add_unique missing_plan_scaffold_targets "docs/exec-plans/active/.gitkeep"
      plan_scaffold_state="partial"
    fi
  else
    add_unique missing_plan_scaffold_targets "docs/exec-plans/active/"
    plan_scaffold_state="partial"
  fi

  if has_file "docs/exec-plans/completed"; then
    add_unique plan_targets "docs/exec-plans/completed/"
    if ! dir_has_entries "docs/exec-plans/completed"; then
      add_unique missing_plan_scaffold_targets "docs/exec-plans/completed/.gitkeep"
      plan_scaffold_state="partial"
    fi
  else
    add_unique missing_plan_scaffold_targets "docs/exec-plans/completed/"
    plan_scaffold_state="partial"
  fi
elif [[ "${#custom_planning_domains[@]}" -gt 0 ]]; then
  if [[ "${#custom_domains[@]}" -gt 0 ]] && [[ "${#standard_domains[@]}" -gt 0 ]]; then
    planning_surface_state="mixed"
  else
    planning_surface_state="custom"
  fi
  plan_scaffold_state="missing"
fi

case "$plan_scaffold_state" in
  ready)
    plan_readiness="ready"
    ;;
  partial)
    plan_readiness="needs-scaffold"
    ;;
  *)
    if [[ "${#custom_planning_domains[@]}" -gt 0 ]]; then
      plan_readiness="needs-standardization"
    fi
    ;;
esac

repo_taxonomy_mode="foundational"
taxonomy_health="foundational"
migration_required="false"

if [[ "${#split_doc_domains[@]}" -gt 0 ]]; then
  if [[ "${#standard_domains[@]}" -gt 0 ]] && [[ "${#custom_domains[@]}" -gt 0 ]]; then
    repo_taxonomy_mode="mixed"
  elif [[ "${#standard_domains[@]}" -gt 0 ]]; then
    repo_taxonomy_mode="standard"
  else
    repo_taxonomy_mode="custom"
  fi
fi

if [[ "${#migration_candidates[@]}" -gt 0 ]]; then
  migration_required="true"
fi

if [[ "${#missing_index_targets[@]}" -gt 0 ]] || [[ "${#missing_plan_scaffold_targets[@]}" -gt 0 ]]; then
  taxonomy_health="broken-navigation"
elif [[ "${#unclassified_domains[@]}" -gt 0 ]]; then
  taxonomy_health="needs-review"
elif [[ "${#migration_candidates[@]}" -gt 0 ]]; then
  taxonomy_health="migration-recommended"
elif [[ "$repo_taxonomy_mode" == "mixed" ]]; then
  taxonomy_health="mixed-stable"
elif [[ "$repo_taxonomy_mode" == "custom" ]]; then
  taxonomy_health="custom-mapped"
elif [[ "$repo_taxonomy_mode" == "standard" ]]; then
  taxonomy_health="standard"
fi

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
validation_doc_files=()
history_doc_files=()
scorecard_doc_files=()

doc_count=0
test_count=0
other_count=0

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  file_is_doc=0
  file_is_test=0
  domain_role="$(lookup_domain_role_for_file "$file" 2>/dev/null || true)"

  if is_doc_file "$file"; then
    file_is_doc=1
    ((doc_count+=1))

    if is_navigation_file "$file"; then
      add_unique changed_domains "navigation"
      add_unique changed_doc_areas "navigation-docs"
      add_unique doc_review_triggers "navigation"
      add_unique navigation_files "$file"
    fi

    if is_current_state_top_level_doc "$file" || [[ "$domain_role" == "current-state" ]]; then
      add_unique changed_doc_areas "current-state-docs"
      add_unique current_state_doc_files "$file"
    fi

    if is_decision_doc_file "$file" || [[ "$domain_role" == "decision" ]]; then
      add_unique changed_doc_areas "decision-docs"
      add_unique decision_doc_files "$file"
    fi

    if [[ "$domain_role" == "reference" ]] \
      || [[ "$file" =~ (^|/)docs/generated/ ]] \
      || [[ "$file" =~ (^|/).*-llms\.txt$ ]]; then
      add_unique changed_doc_areas "reference-docs"
      add_unique reference_doc_files "$file"
    fi

    if [[ "$file" =~ (^|/)docs/generated/ ]]; then
      add_unique changed_doc_areas "generated-docs"
      add_unique doc_review_triggers "generated-artifacts"
      add_unique generated_doc_files "$file"
    fi

    if is_validation_doc_file "$file" || [[ "$domain_role" == "validation" ]]; then
      add_unique changed_doc_areas "validation-docs"
      add_unique validation_doc_files "$file"
    fi

    if is_scorecard_file "$file"; then
      add_unique changed_doc_areas "scorecard-docs"
      add_unique scorecard_doc_files "$file"
    fi

    if is_plan_file "$file" || [[ "$domain_role" == "planning" ]]; then
      add_unique changed_domains "plans"
      add_unique changed_doc_areas "plan-docs"
      add_unique plan_doc_files "$file"
    fi

    if is_history_doc_file "$file" || [[ "$domain_role" == "history" ]]; then
      add_unique changed_doc_areas "history-docs"
      add_unique history_doc_files "$file"
    fi
  elif is_test_file "$file"; then
    file_is_test=1
    ((test_count+=1))
  else
    ((other_count+=1))
  fi

  if [[ "$file_is_doc" -eq 0 ]] && [[ "$file_is_test" -eq 0 ]]; then
    file_lc="$(lowercase "$file")"

    if looks_like_contract_file "$file_lc"; then
      add_unique changed_domains "api"
      add_unique doc_review_triggers "public-behavior"
      add_unique doc_review_triggers "external-contracts"
      add_unique high_risk_files "$file"
    fi

    if looks_like_runtime_file "$file_lc"; then
      add_unique changed_domains "runtime"
      add_unique doc_review_triggers "public-behavior"
      add_unique doc_review_triggers "architecture"
      add_unique high_risk_files "$file"
    fi

    if looks_like_application_file "$file_lc"; then
      add_unique changed_domains "application"
      add_unique doc_review_triggers "architecture"
      add_unique high_risk_files "$file"
    fi

    if looks_like_state_model_file "$file_lc"; then
      add_unique changed_domains "state-model"
      add_unique doc_review_triggers "state-model"
      add_unique high_risk_files "$file"
    fi
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

if has_tag "navigation" "${doc_review_triggers[@]}" || has_tag "navigation-docs" "${changed_doc_areas[@]}"; then
  for target in "${navigation_targets[@]}"; do
    add_unique preferred_targets "$target"
  done
fi

if has_tag "architecture" "${doc_review_triggers[@]}" \
  || has_tag "public-behavior" "${doc_review_triggers[@]}" \
  || has_tag "current-state-docs" "${changed_doc_areas[@]}"; then
  for target in "${current_state_targets[@]}" "${validation_targets[@]}"; do
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

if has_tag "plans" "${changed_domains[@]}" || has_tag "plan-docs" "${changed_doc_areas[@]}"; then
  for target in "${plan_targets[@]}"; do
    add_unique preferred_targets "$target"
  done
fi

if has_tag "validation-docs" "${changed_doc_areas[@]}" || has_tag "scorecard-docs" "${changed_doc_areas[@]}"; then
  for target in "${validation_targets[@]}" "${scorecard_targets[@]}"; do
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
    "${validation_targets[@]}" \
    "${plan_targets[@]}" \
    "${decision_targets[@]}"; do
    add_unique preferred_targets "$target"
  done
fi

has_core_docs_beyond_readme=0
if has_any_file \
  PROJECT_BRIEF.md docs/PROJECT_BRIEF.md \
  DESIGN.md docs/DESIGN.md \
  FRONTEND.md docs/FRONTEND.md \
  PRODUCT_SENSE.md docs/PRODUCT_SENSE.md \
  DECISIONS.md docs/DECISIONS.md \
  RELIABILITY.md docs/RELIABILITY.md \
  SECURITY.md docs/SECURITY.md \
  PLANS.md docs/PLANS.md \
  QUALITY_SCORE.md docs/QUALITY_SCORE.md \
  RISKS.md docs/RISKS.md \
  OPEN_QUESTIONS.md docs/OPEN_QUESTIONS.md \
  ASSUMPTIONS.md docs/ASSUMPTIONS.md \
  API.md docs/API.md \
  SCHEMA.md docs/SCHEMA.md; then
  has_core_docs_beyond_readme=1
fi

has_mapped_role_domain=0
for role in "${domain_roles[@]}"; do
  if [[ "$role" != "unclassified" ]] && [[ "$role" != "archive" ]]; then
    has_mapped_role_domain=1
    break
  fi
done

doc_system_mode=
mode_reason=

if [[ "${#missing_index_targets[@]}" -gt 0 ]]; then
  doc_system_mode="repair"
  mode_reason="missing-split-doc-indexes"
elif [[ "${#missing_plan_scaffold_targets[@]}" -gt 0 ]]; then
  doc_system_mode="repair"
  mode_reason="incomplete-exec-plan-scaffold"
elif [[ "${#split_doc_domains[@]}" -gt 0 ]] && [[ "$has_mapped_role_domain" -eq 0 ]]; then
  doc_system_mode="repair"
  mode_reason="doc-system-without-usable-role-map"
elif [[ "${#split_doc_domains[@]}" -gt 0 ]] && [[ "${#preferred_targets[@]}" -eq 0 ]]; then
  doc_system_mode="repair"
  mode_reason="doc-system-without-preferred-targets"
elif [[ "${#split_doc_domains[@]}" -gt 0 ]]; then
  doc_system_mode="structured"
  case "$repo_taxonomy_mode" in
    mixed)
      mode_reason="mixed-doc-domains-present"
      ;;
    custom)
      mode_reason="custom-split-doc-domains-present"
      ;;
    *)
      mode_reason="standard-split-doc-domains-present"
      ;;
  esac
elif has_file "AGENTS.md" || has_file "ARCHITECTURE.md" || [[ "$has_core_docs_beyond_readme" -eq 1 ]]; then
  doc_system_mode="minimal"
  mode_reason="core-docs-without-split-domains"
else
  doc_system_mode="bootstrap"
  mode_reason="no-doc-system"
fi

preferred_mode_doc="modes/$doc_system_mode.md"

stale_plan_placement=()

if has_file "docs/exec-plans"; then
  exec_plans_root="$repo_root/docs/exec-plans"

  while IFS= read -r -d '' plan_file; do
    rel_plan_file="${plan_file#$repo_root/}"

    case "$rel_plan_file" in
      docs/exec-plans/index.md|docs/exec-plans/README.md|docs/exec-plans/completed/*)
        continue
        ;;
    esac

    if plan_file_has_done_status "$plan_file"; then
      add_unique stale_plan_placement "$rel_plan_file"
    fi
  done < <(find "$exec_plans_root" \
    \( -path "$exec_plans_root/completed" -o -path "$exec_plans_root/completed/*" \) -prune \
    -o -name '*.md' -type f -print0 2>/dev/null)
fi

if [[ "${#stale_plan_placement[@]}" -gt 0 ]]; then
  add_unique doc_review_triggers "plan-lifecycle-drift"
  for target in "${plan_targets[@]}"; do
    add_unique preferred_targets "$target"
  done
fi

problem_frame_state="missing"
boundary_state="missing"
decision_state="not-needed-yet"
contract_state="not-needed-yet"
validation_state="missing"
validation_truth_state="missing"
foundation_gaps=()

if has_any_file \
  README.md \
  PROJECT_BRIEF.md \
  docs/PROJECT_BRIEF.md \
  PRODUCT_SENSE.md \
  docs/PRODUCT_SENSE.md; then
  problem_frame_state="present"
else
  for domain in "${current_state_domains[@]}"; do
    if domain_supports_problem_frame "$domain"; then
      problem_frame_state="present"
      break
    fi
  done
fi

if has_any_file \
  ARCHITECTURE.md \
  DESIGN.md \
  docs/DESIGN.md \
  FRONTEND.md \
  docs/FRONTEND.md; then
  boundary_state="present"
else
  for domain in "${current_state_domains[@]}"; do
    if domain_supports_boundaries "$domain"; then
      boundary_state="present"
      break
    fi
  done
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
  DECISIONS.md \
  docs/DECISIONS.md \
  ADR.md \
  docs/ADR.md \
  docs/decisions \
  docs/adr \
  docs/design-docs/decision-log.md \
  docs/design-docs/decisions \
  docs/design-docs/adr \
  docs/design-docs/adrs; then
  decision_state="present"
elif [[ "${#decision_domains[@]}" -gt 0 ]]; then
  decision_state="present"
elif [[ "$decision_pressure" -eq 1 ]]; then
  decision_state="missing"
fi

contract_pressure=0
if has_tag "external-contracts" "${doc_review_triggers[@]}" \
  || has_tag "state-model" "${doc_review_triggers[@]}" \
  || has_tag "generated-artifacts" "${doc_review_triggers[@]}" \
  || has_tag "api" "${changed_domains[@]}"; then
  contract_pressure=1
fi

if has_any_file \
  API.md \
  docs/API.md \
  SCHEMA.md \
  docs/SCHEMA.md \
  openapi.yaml \
  openapi.yml \
  openapi.json; then
  contract_state="present"
else
  for domain in "${reference_domains[@]}"; do
    if domain_supports_contracts "$domain"; then
      contract_state="present"
      break
    fi
  done
fi

if [[ "$contract_state" != "present" ]] && [[ "$contract_pressure" -eq 1 ]]; then
  contract_state="missing"
fi

if has_any_file \
  PLANS.md \
  docs/PLANS.md \
  QUALITY_SCORE.md \
  docs/QUALITY_SCORE.md \
  RELIABILITY.md \
  docs/RELIABILITY.md \
  SECURITY.md \
  docs/SECURITY.md \
  RISKS.md \
  docs/RISKS.md \
  OPEN_QUESTIONS.md \
  docs/OPEN_QUESTIONS.md \
  ASSUMPTIONS.md \
  docs/ASSUMPTIONS.md; then
  validation_state="present"
  validation_truth_state="present"
else
  for domain in "${validation_domains[@]}"; do
    if domain_supports_validation "$domain"; then
      validation_state="present"
      validation_truth_state="present"
      break
    fi
  done
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

if [[ "${#stale_plan_placement[@]}" -gt 0 ]]; then
  doc_refresh_hint="repair-plan-lifecycle-drift"
elif has_tag "navigation" "${doc_review_triggers[@]}"; then
  doc_refresh_hint="review-map-and-authority-docs"
elif has_tag "only-tests" "${classification[@]}"; then
  doc_refresh_hint="usually-no-doc-update"
elif has_tag "only-docs" "${classification[@]}"; then
  doc_refresh_hint="docs-already-touched"
elif [[ "${#doc_review_triggers[@]}" -gt 0 ]]; then
  doc_refresh_hint="review-authoritative-docs"
else
  doc_refresh_hint="inspect-diff-before-deciding"
fi

echo "repo_root=$repo_root"
echo
echo "[repo_layout]"
echo "tags=$(to_csv "${layout_tags[@]}")"
echo "repo_taxonomy_mode=$repo_taxonomy_mode"
echo "taxonomy_health=$taxonomy_health"
echo "role_map=$(to_csv "${role_map[@]}")"
echo "standard_domains=$(to_csv "${standard_domains[@]}")"
echo "custom_domains=$(to_csv "${custom_domains[@]}")"
echo "unclassified_domains=$(to_csv "${unclassified_domains[@]}")"
echo "normalization_candidates=$(to_csv "${normalization_candidates[@]}")"
echo "migration_candidates=$(to_csv "${migration_candidates[@]}")"
echo "archive_targets=$(to_csv "${archive_targets[@]}")"
echo "preferred_targets=$(to_csv "${preferred_targets[@]}")"
echo "navigation_targets=$(to_csv "${navigation_targets[@]}")"
echo "current_state_targets=$(to_csv "${current_state_targets[@]}")"
echo "reference_targets=$(to_csv "${reference_targets[@]}")"
echo "decision_targets=$(to_csv "${decision_targets[@]}")"
echo "plan_targets=$(to_csv "${plan_targets[@]}")"
echo "validation_targets=$(to_csv "${validation_targets[@]}")"
echo "scorecard_targets=$(to_csv "${scorecard_targets[@]}")"
echo "missing_index_targets=$(to_csv "${missing_index_targets[@]}")"
echo "missing_plan_scaffold_targets=$(to_csv "${missing_plan_scaffold_targets[@]}")"
echo
echo "[planning]"
echo "planning_surface_state=$planning_surface_state"
echo "plan_scaffold_state=$plan_scaffold_state"
echo "plan_readiness=$plan_readiness"
echo "stale_plan_placement=$(to_csv "${stale_plan_placement[@]}")"
echo "active_plan_target=$active_plan_target"
echo "custom_planning_domains=$(to_csv "${custom_planning_domains[@]}")"
echo
echo "[routing]"
echo "doc_system_mode=$doc_system_mode"
echo "mode_reason=$mode_reason"
echo "preferred_mode_doc=$preferred_mode_doc"
echo "migration_required=$migration_required"
echo
echo "[knowledge]"
echo "knowledge_phase=$knowledge_phase"
echo "problem_frame_state=$problem_frame_state"
echo "boundary_state=$boundary_state"
echo "decision_state=$decision_state"
echo "contract_state=$contract_state"
echo "validation_state=$validation_state"
echo "validation_truth_state=$validation_truth_state"
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
echo "validation_doc_files=$(to_csv "${validation_doc_files[@]}")"
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
