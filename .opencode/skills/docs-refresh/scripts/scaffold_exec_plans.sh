#!/usr/bin/env bash
set -euo pipefail

repo_arg="${1:-.}"
repo_root="$(git -C "$repo_arg" rev-parse --show-toplevel 2>/dev/null || true)"

if [[ -z "$repo_root" ]]; then
  echo "ERROR: not a git repository: $repo_arg" >&2
  exit 1
fi

plan_root="$repo_root/docs/exec-plans"

mkdir -p "$plan_root/active" "$plan_root/completed"

touch_if_missing() {
  local path="$1"

  if [[ ! -e "$path" ]]; then
    : > "$path"
  fi
}

touch_if_missing "$plan_root/active/.gitkeep"
touch_if_missing "$plan_root/completed/.gitkeep"

if [[ ! -e "$plan_root/index.md" ]]; then
  cat <<'EOF' > "$plan_root/index.md"
# Execution Plans

Use this directory for durable execution plans and plan-adjacent operational notes.

## Layout

- `active/`: in-flight execution plans
- `completed/`: closed plans kept for durable history
- Add debt trackers, rollout notes, or scorecards here only when they carry durable repository truth.

## Working Rules

- Keep current system truth in the authoritative current-state or reference docs, not only in plan artifacts.
- Move finished plans into `completed/` instead of leaving stale work in `active/`.
EOF
fi

echo "scaffolded=$plan_root"
