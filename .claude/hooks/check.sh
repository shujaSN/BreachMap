#!/usr/bin/env bash
# On Stop: run pnpm check when files changed; a failure sends Claude back once to fix it.
[ "$(jq -r '.stop_hook_active // false')" = true ] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -n "$(git status --porcelain)" ] || exit 0
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" --no-use && nvm use --silent >/dev/null 2>&1
out=$(pnpm -s check 2>&1) || {
  printf 'pnpm check failed. Fix it before you finish:\n%s\n' "$(echo "$out" | tail -40)" >&2
  exit 2
}
