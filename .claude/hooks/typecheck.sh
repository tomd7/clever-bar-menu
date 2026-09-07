#!/usr/bin/env bash
# Stop: refuses to end the turn while `npx tsc --noEmit` fails.
# Reports the first errors back to Claude so they get fixed in the same turn.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
input="$(cat)"

# Already re-entered once from a previous block: let the turn end.
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ] && exit 0

cd "$ROOT" || exit 0
if out="$(npx tsc --noEmit 2>&1)"; then
  exit 0
fi

jq -n --arg out "$(printf '%s\n' "$out" | head -40)" \
  '{decision: "block", reason: ("`npx tsc --noEmit` fails. Fix these before finishing:\n\n" + $out)}'
