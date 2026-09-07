#!/usr/bin/env bash
# PostToolUse (Write|Edit): formats the file Claude just wrote.
# Prettier for everything it understands, then eslint --fix for JS/TS.
# Silent on success, never fails the tool call.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
file="$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')"

[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0
case "$file" in
  "$ROOT"/*) ;;
  *) exit 0 ;; # never touch files outside the repo
esac

cd "$ROOT" || exit 0
npx prettier --write --ignore-unknown "$file" >/dev/null 2>&1
case "$file" in
  *.ts | *.tsx | *.js | *.jsx) npx eslint --fix "$file" >/dev/null 2>&1 ;;
esac
exit 0
