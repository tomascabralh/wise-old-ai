# Running the dev build with a Jagex account

`gradle run` launches a RuneLite client built from source. Its in-game login
screen only accepts **legacy** (username/password) accounts. If your account has
been migrated to a **Jagex account**, that screen shows *"Incorrect username or
password — you need to log in using the Jagex Launcher instead."*

RuneLite reads Jagex credentials from environment variables that the Jagex
Launcher normally injects:

```
JX_ACCESS_TOKEN  JX_REFRESH_TOKEN  JX_SESSION_ID  JX_CHARACTER_ID  JX_DISPLAY_NAME
```

To run the dev build with your Jagex account you must supply those same variables.

## Option A — legacy account (simplest)

If you have an old non-Jagex account, just `gradle run` and type its
username/password. No environment setup needed. This is the easiest dev loop.

## Option B — use your Jagex Launcher session

Serve the credentials the Jagex Launcher issues to the dev build. The repo ships
a helper for this:

```bash
cd plugins/wise-old-ai-runelite
./scripts/run-with-jagex.sh
```

It uses a saved credentials file if you have one, otherwise borrows the session
from a running, launcher-authenticated RuneLite, then launches the dev build
already logged into your account (exporting to `~/.wise-old-ai/state/`).

The full explanation of how the launcher serves these credentials, how to save
them for repeatable runs, the IDE run-configuration approach, and the macOS
caveat is in **[serving-jagex-credentials.md](serving-jagex-credentials.md)**.

## Verifying the export

```bash
ls ~/.wise-old-ai/state/        # player.json, skills.json, equipment.json, ...
```

Then point the MCP server at that directory (drop any `WISE_OLD_AI_STATE_DIR`
override) and ask your MCP client a question — see
[`claude-desktop-setup.md`](claude-desktop-setup.md).
