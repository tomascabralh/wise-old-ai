# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Wise Old AI is a local-first **advisor** for Old School RuneScape. A RuneLite plugin exports read-only account state to `~/.wise-old-ai/state/*.json`; an MCP server reads those files and serves tools to Claude Desktop (or any MCP client) so the model can give progression/PvM/skilling advice.

**Hard constraint — advisor, never a bot.** The plugin only *reads* game state and writes JSON to local disk. It must never control input, pathfind, automate gameplay, or make network calls. This is both the project's identity and what keeps it eligible for the RuneLite Plugin Hub. Do not add anything that crosses this line.

## Architecture

Two **fully independent** components that share only a JSON-on-disk contract — neither imports the other:

- **`plugins/wise-old-ai-runelite/`** — Java 11 RuneLite plugin (Gradle). On `onGameTick` it snapshots state and, on a **background thread**, writes one file per slice (`player`, `skills`, `inventory`, `equipment`, `location`, `quests`, `diaries`, `activities`, `bank`, + `metadata` for staleness). It **hash-diffs** each slice and only writes when content changed, with atomic writes — so it never stalls RuneLite's client thread. Also renders an owl **sidebar panel** (export status + an advice section).
- **`shared/schemas/`** — Zod schemas + inferred TS types. This is the **single source of truth** for the state-file shape; both sides conform to it. `mcp-server` consumes it as `@wise-old-ai/schemas` via a `file:` dependency.
- **`mcp-server/`** — TypeScript MCP server over stdio (`@modelcontextprotocol/sdk`). Reads slices on demand, validates against the schema, exposes 15 tools. `context.ts` is a pure derived layer (`get_account_context`) that synthesizes raw slices into an experienced-player read (account stage, gear-aware boss readiness, money-makers, upgrades, weaknesses) — call it first for "what should I do?" questions.

**Data flow** is plugin → files → server → client, with one reverse channel: the **advice channel**. The client calls `push_advice({body, title?})`, the server writes `advice.json` into the state dir, and the plugin watches its mtime each tick and renders it in the panel. The model still lives in the client — the panel only displays text the client sent, preserving advisory-only. `get_advice` reads it back.

## Commands

Build order matters: **`shared/schemas` must be built before `mcp-server`** (the server imports its compiled output).

```bash
# shared schemas
cd shared/schemas && npm install && npm run build
npm test                         # vitest run

# mcp-server
cd mcp-server && npm install && npm run build
npm run dev                      # tsx src/index.ts (stdio server)
npm test                         # vitest run
npx vitest run src/context.test.ts          # a single test file
npx vitest run -t "boss readiness"          # a single test by name

# run the server with no game, against the example fixtures:
WISE_OLD_AI_STATE_DIR="$PWD/../examples/state" npm start

# RuneLite plugin (needs JDK 11 + Gradle)
cd plugins/wise-old-ai-runelite && gradle build      # builds jar + runs JUnit
gradle test                                          # exporter tests only
gradle test --tests StateExporterTest                # a single test class
gradle run                                           # side-load into a live RuneLite client
```

## Conventions & gotchas

- **State dir** is `~/.wise-old-ai/state/` by default, overridable with `WISE_OLD_AI_STATE_DIR` (used to run the server against `examples/state/` with no game).
- **Gson must serialize nulls.** Use `new GsonBuilder().serializeNulls().create()` — otherwise empty equipment slots silently vanish from the JSON. The schema also defaults absent slots to `null` defensively.
- **MCP tool registration**: `server.registerTool(name, { description, inputSchema? }, cb)`. Tools that take arguments set a Zod raw-shape `inputSchema`; no-arg tools omit it. All tool definitions live in `mcp-server/src/tools.ts`.
- **Bank** is only present after the bank has been opened in-game once; tools say so when `bank.json` is missing.
- **Slayer task monster name** is resolved from the game's DB table on login (self-maintaining, not chat-scraped). The general pattern for reading RuneLite-exposed cache data is `client.getDBRowsByValue(...)` → `client.getDBTableField(...)`.

## RuneLite / build-env notes

- Gradle must run on **Java 11** (RuneLite plugin toolchain). The RuneLite API classes (`Quest`, `Varbits`, `VarPlayer`, etc.) live in the separate `net.runelite:runelite-api` jar, **not** the `client` jar. Introspect the API offline with `javap -cp <runelite-api jar> <ClassName>`.
- `gradle run` launches a dev client whose login screen only accepts **legacy** accounts. A **Jagex account** needs the `JX_*` session vars the Jagex Launcher injects — see `scripts/run-with-jagex.sh` and `docs/serving-jagex-credentials.md` (incl. the macOS caveat). Extracting those tokens is a manual, user-run step (treated as credential handling).

## Distribution

The plugin targets the **RuneLite Plugin Hub** (`runelite-plugin.properties` already present). The MCP server is published to npm as `wise-old-ai-mcp` (`bin` already wired). The two are installed independently; the Hub only ever reviews the plugin.
