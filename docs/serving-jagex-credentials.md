# Serving Jagex credentials to the dev build

This explains **how the Jagex Launcher hands credentials to a game client**, and
the practical ways to deliver those same credentials to the Wise Old AI dev build
(`gradle run`). If you only want the short version, use the helper script in
[Method 1](#method-1-helper-script-recommended).

## How the Jagex Launcher serves credentials

When you launch a game from the Jagex Launcher, it does **not** put a
username/password into the client. Instead it starts the game process with a set
of **environment variables** holding a short-lived OAuth session:

| Variable | Meaning |
|---|---|
| `JX_ACCESS_TOKEN` | OAuth access token for the session |
| `JX_REFRESH_TOKEN` | Token used to refresh the access token |
| `JX_SESSION_ID` | The launcher session id |
| `JX_CHARACTER_ID` | Selects which character/account to log in (optional) |
| `JX_DISPLAY_NAME` | The account's display name (optional) |

RuneLite reads these at startup and authenticates with them, skipping the legacy
in-game login screen. So "serving credentials" to our from-source dev build just
means **making those same five variables present in the `gradle run` JVM's
environment.** Nothing is written to disk by the launcher; the tokens live only
in the process environment and are refreshed as needed.

> ⚠️ **These are live session tokens for your account.** Treat them like a
> password: never commit them, never paste them into a shared location, and
> expect them to expire (re-fetch when they do). Anything stored locally belongs
> under `~/.wise-old-ai/`, which is gitignored.

## Method 1 — IDE / run configuration (documented by RuneLite)

For IntelliJ or VS Code, add the five `JX_*` variables to the run configuration's
**environment variables** for the `WiseOldAiPluginLauncher` main class, then run
it. This is the approach the
[RuneLite wiki](https://github.com/runelite/runelite/wiki) documents for
Jagex-account development.

## Method 2 — a private credentials file + helper script

Put the values in a private file so a plain `gradle run` can pick them up:

```bash
mkdir -p ~/.wise-old-ai
$EDITOR ~/.wise-old-ai/jx-credentials.env   # add: export JX_ACCESS_TOKEN=...  (one per line)
chmod 600 ~/.wise-old-ai/jx-credentials.env
```

Then launch with the helper, which loads that file and starts the dev build:

```bash
cd plugins/wise-old-ai-runelite
./scripts/run-with-jagex.sh
```

(The helper only reads the file/your shell environment — it does **not** read any
other process. Re-fill the file when the tokens expire.)

### Where your session's values live

The launcher passes the `JX_*` variables into the **environment of the game
process it starts** (the official RuneLite). They are not written to disk by the
launcher. Reading them out of that running process is your call and your
responsibility for your own account; how (and whether) you can inspect a
process's environment depends on your OS — see the macOS caveat below. This
project deliberately does not ship a tool that harvests them.

## macOS caveat

macOS can block reading another process's environment for **notarized** apps (the
official RuneLite is notarized), so you may not be able to inspect your session's
`JX_*` values at all. In that case:

- use **Method 1** (an IDE run configuration), or
- use a **legacy (non-Jagex) account**, which needs none of this — just
  `gradle run` and type username/password.

## Verifying

Once the dev client is logged in via any method:

```bash
ls ~/.wise-old-ai/state/    # player.json, skills.json, equipment.json, ...
```

Then point the MCP server at that directory — see
[`claude-desktop-setup.md`](claude-desktop-setup.md).
