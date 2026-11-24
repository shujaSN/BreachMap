#!/usr/bin/env bash
# After Edit/Write: format and lint the changed project file with Biome; errors go back to Claude.
file=$(jq -r '.tool_input.file_path // empty')
case "$file" in "$CLAUDE_PROJECT_DIR"/*) ;; *) exit 0 ;; esac
cd "$CLAUDE_PROJECT_DIR" || exit 0
out=$(node_modules/.bin/biome check --write --no-errors-on-unmatched --files-ignore-unknown=true "$file" 2>&1) || {
  echo "$out" >&2
  exit 2
}
