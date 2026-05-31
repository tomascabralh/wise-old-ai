# Contributing to Wise Old AI

Thanks for your interest! Wise Old AI is MIT-licensed and community-driven.

## Ground rule: advisory only

Wise Old AI **reads** account state and gives advice. It must never control
input, automate gameplay, pathfind, or interact with the game. Pull requests that
add any form of automation will be declined. Keep it a coach, not a bot.

## Project shape

Two independent codebases share one contract:

- **`plugins/wise-old-ai-runelite/`** — Java 11 RuneLite plugin. Reads RuneLite
  APIs and exports state. No AI logic here.
- **`mcp-server/`** — TypeScript MCP server. Reads exported state and exposes
  tools. All intelligence lives here.
- **`shared/schemas/`** — the Zod state contract. Change a state file's shape
  here first, then update both sides.

## Working on it

```bash
# schemas
cd shared/schemas && npm install && npm test

# mcp server
cd mcp-server && npm install && npm test

# plugin (needs JDK 11 + Gradle)
cd plugins/wise-old-ai-runelite && gradle test
```

## Conventions

- **Tests first.** Every MCP tool and every exported file has a test.
- **Keep slices independent.** One file per state slice; write only on change.
- **The plugin stays Java 11** (RuneLite's target) and avoids blocking the client
  thread — snapshot on-thread, write off-thread.
- Commit messages: one lowercase sentence describing the change.

## Adding a new tool / state slice

1. Add/extend the schema in `shared/schemas/src/index.ts` (+ test).
2. Export the data from the plugin (+ exporter handles it automatically).
3. Add the tool in `mcp-server/src/tools.ts` (+ test) — it's auto-registered.
4. Add an example fixture under `examples/state/`.
