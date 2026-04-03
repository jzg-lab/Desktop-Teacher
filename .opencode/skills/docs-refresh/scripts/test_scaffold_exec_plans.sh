#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
scaffold_script="$script_dir/scaffold_exec_plans.sh"
tmp_root="$(mktemp -d)"

cleanup() {
  rm -rf "$tmp_root"
}

trap cleanup EXIT

assert_exists() {
  local path="$1"

  if [[ ! -e "$path" ]]; then
    echo "Expected path to exist: $path" >&2
    exit 1
  fi
}

repo="$tmp_root/repo"
mkdir -p "$repo"
git -C "$repo" init -q
git -C "$repo" config user.name "Docs Refresh Test"
git -C "$repo" config user.email "docs-refresh-test@example.com"
git -C "$repo" commit --allow-empty -q -m "init"

output="$(bash "$scaffold_script" "$repo")"

if [[ "$output" != "scaffolded=$repo/docs/exec-plans" ]]; then
  echo "Unexpected scaffold output: $output" >&2
  exit 1
fi

assert_exists "$repo/docs/exec-plans/index.md"
assert_exists "$repo/docs/exec-plans/active/.gitkeep"
assert_exists "$repo/docs/exec-plans/completed/.gitkeep"

printf '%s\n' "# Custom Index" > "$repo/docs/exec-plans/index.md"
bash "$scaffold_script" "$repo" >/dev/null

if ! grep -Fxq "# Custom Index" "$repo/docs/exec-plans/index.md"; then
  echo "Expected scaffold helper to preserve an existing index.md" >&2
  exit 1
fi

echo "Exec plans scaffold smoke tests passed."
