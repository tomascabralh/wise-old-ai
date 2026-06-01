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

## Option B — reuse your Jagex Launcher session

This passes the credentials your already-running, launcher-authenticated RuneLite
received into the dev build. **Only do this for your own account on your own
machine** — these are live session tokens.

1. Open the **Jagex Launcher** and launch the official **RuneLite**; log in.
2. With that client running, extract its `JX_*` variables and launch the dev
   build in the same shell:

   ```bash
   cd plugins/wise-old-ai-runelite
   for pid in $(pgrep -if runelite); do
     v=$(ps eww -p "$pid" 2>/dev/null | tr ' ' '\n' | grep -E '^JX_[A-Z_]+=')
     if echo "$v" | grep -q JX_SESSION_ID; then
       while IFS= read -r line; do export "$line"; done <<< "$v"
       break
     fi
   done
   [ -n "$JX_SESSION_ID" ] && gradle run --no-daemon --console=plain \
     || echo "No JX_ vars readable — see note below."
   ```

3. The dev client opens already logged into your Jagex account and starts
   exporting to `~/.wise-old-ai/state/`.

> **macOS note:** reading another process's environment can be blocked for
> notarized apps. If the script prints *"No JX_ vars readable"*, this route isn't
> available on your machine — use Option A, or paste the five `JX_*` values into
> your run configuration manually. The tokens are short-lived; re-extract when
> they expire.

## Verifying the export

```bash
ls ~/.wise-old-ai/state/        # player.json, skills.json, equipment.json, ...
```

Then point the MCP server at that directory (drop any `WISE_OLD_AI_STATE_DIR`
override) and ask your MCP client a question — see
[`claude-desktop-setup.md`](claude-desktop-setup.md).
