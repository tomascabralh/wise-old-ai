#!/usr/bin/env bash
#
# Launch the Wise Old AI dev build with Jagex account credentials you have
# already provided. RuneLite authenticates a Jagex account from these env vars,
# which the Jagex Launcher issues to the game process it starts:
#   JX_ACCESS_TOKEN  JX_REFRESH_TOKEN  JX_SESSION_ID  JX_CHARACTER_ID  JX_DISPLAY_NAME
#
# This script does NOT read them from any other process. It loads them from a
# file you maintain (default ~/.wise-old-ai/jx-credentials.env) or from the
# environment you've already exported, then runs `gradle run`.
#
# SECURITY: those are live session tokens for YOUR account. Keep the file private
# (chmod 600), never commit it. See docs/serving-jagex-credentials.md.
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRED_FILE="${WISE_OLD_AI_JX_FILE:-$HOME/.wise-old-ai/jx-credentials.env}"

if [ -f "$CRED_FILE" ]; then
  echo "Loading Jagex credentials from $CRED_FILE"
  set -a; . "$CRED_FILE"; set +a
fi

if [ -z "${JX_SESSION_ID:-}" ]; then
  cat >&2 <<EOF

No Jagex credentials available.

Provide them in one of these ways, then re-run:
  - Create $CRED_FILE with lines like:  export JX_ACCESS_TOKEN=...   (chmod 600)
  - Or export the JX_* variables in your shell before running this.
  - Or use a legacy (non-Jagex) account: just run \`gradle run\` and type
    your username/password.

How the launcher issues these credentials, and where to read your own session's
values, is explained in docs/serving-jagex-credentials.md.
EOF
  exit 1
fi

echo "Launching the Wise Old AI dev build for ${JX_DISPLAY_NAME:-your account}..."
cd "$PLUGIN_DIR"
exec gradle run --no-daemon --console=plain
