# Wise Old AI

[![CI](https://github.com/tomascabralh/wise-old-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/tomascabralh/wise-old-ai/actions/workflows/ci.yml)

An open-source, local-first **AI advisor** for Old School RuneScape. A RuneLite
plugin exports your account state to local JSON files; an MCP server lets Claude
Desktop (and any MCP client) read that state and give you personalized
progression, PvM, skilling, and questing advice.

> **Status: maintenance mode.** All planned milestones (1–3), the advice channel,
> and the context engine are complete and the project is feature-complete. It's
> not abandoned — it works and is documented — but active development has paused.
> See the [roadmap](#roadmap) for what a future revival would build next.

> ### Advisor, not a bot
> Wise Old AI only **reads** account state. It does **not** control your mouse or
> keyboard, automate gameplay, pathfind, or interact with the game in any way.
> It is a coach that looks at your account and tells you what to do — you play.

## How it works

```
RuneLite client ─(client thread)─► Wise Old AI plugin
                                      │ onGameTick: snapshot state
                                      ▼  background thread (hash-diff, atomic write)
                         ~/.wise-old-ai/state/*.json   ← single source of truth
                                      ▲ read on demand + validate
                         MCP server (TypeScript, stdio) ─► Claude Desktop / Cursor / Windsurf
```

The plugin and the server are fully independent. They share only the JSON-on-disk
contract defined once in [`shared/schemas`](shared/schemas) as Zod schemas.

The plugin adds a **sidebar panel** (the owl icon) showing export status — whether
it's exporting, for which account, when it last changed, how many state files are
written, and buttons to open or copy the state folder. A **"What the advisor sees"**
line summarizes coverage at a glance (bank value, current Slayer task, quest &
diary progress — and flags when the bank still needs opening). It also has an **Advice**
section: when your MCP client (e.g. Claude) calls `push_advice`, the text appears
here in-game. The model still runs in the client — the panel just displays what it
sends, so this stays advisory, never automation.

## Repository layout

| Path | What |
|---|---|
| `plugins/wise-old-ai-runelite/` | Java 11 RuneLite plugin (Gradle). Exports state. |
| `shared/schemas/` | Zod schemas — the state-file contract + TS types. |
| `mcp-server/` | TypeScript MCP server exposing read-only tools over stdio. |
| `examples/state/` | Sample state files so you can try the server without the game. |
| `docs/` | Design, plans, and the Claude Desktop setup guide. |

## MCP tools (Milestone 1)

| Tool | Returns |
|---|---|
| `get_player_state` | username, combat & total level, world, hitpoints, prayer, run energy |
| `get_stats` | every skill: real level, boosted level, xp |
| `get_combat_level` | combat level |
| `get_total_level` | total level |
| `get_inventory` | inventory items (`{id, name, quantity}`) |
| `get_equipment` | worn gear by slot |
| `get_location` | world position (x, y, plane, region) |
| `get_quests` | quest points, completed/total, in-progress, not-started |
| `get_diaries` | achievement diary completion per area & tier |
| `get_current_activity` | current Slayer task (monster, amount, points, streak) |
| `get_bank_value` | total GE value of the bank |
| `get_bank` | bank value, item count, and most valuable items |
| `get_account_context` | derived read: account stage, boss readiness, recommended goals |
| `push_advice` | post advice (`{body, title?}`) to the in-game panel |
| `get_advice` | read the advice currently shown in-game |

## Quick start

### 1. Build the MCP server
```bash
cd shared/schemas && npm install && npm run build
cd ../../mcp-server && npm install && npm run build
```

Try it against the example fixtures (no game needed):
```bash
WISE_OLD_AI_STATE_DIR="$PWD/../examples/state" npm start
```

### 2. Build the RuneLite plugin
Requires JDK 11 and Gradle.
```bash
cd plugins/wise-old-ai-runelite && gradle build
# -> build/libs/wise-old-ai-runelite-0.1.0.jar, and JUnit tests run
```
Then launch the live RuneLite client with the plugin side-loaded:
```bash
gradle run        # opens RuneLite; the plugin is already loaded
```
Log in to a character and it writes to `~/.wise-old-ai/state/` every game tick
(only when data changes). The plugin is also structured for the
[RuneLite Plugin Hub](https://github.com/runelite/plugin-hub) for eventual
distribution.

> Using a **Jagex account**? The dev client's login screen only accepts legacy
> accounts. Serve your launcher session to the dev build with the helper:
> ```bash
> ./scripts/run-with-jagex.sh
> ```
> See [`docs/jagex-account-dev-login.md`](docs/jagex-account-dev-login.md) and
> [`docs/serving-jagex-credentials.md`](docs/serving-jagex-credentials.md) for how
> the launcher serves credentials, saving them for repeatable runs, and the macOS caveat.

### 3. Connect Claude Desktop
See [`docs/claude-desktop-setup.md`](docs/claude-desktop-setup.md). In short, add
the server to `claude_desktop_config.json` pointing at `mcp-server/dist/index.js`.

## Example prompts

Once connected, ask Claude:

- "What should I train next?"
- "What gear upgrades should I buy with 20M?"
- "What quests should I prioritize?"
- "Am I ready for Vorkath?"
- "What is my current account weakness?"

## Development

```bash
cd shared/schemas && npm test     # zod schema tests (vitest)
cd mcp-server && npm test         # store + tool tests (vitest)
cd plugins/wise-old-ai-runelite && gradle test   # exporter tests (junit)
```

State files are split per slice (`player`, `skills`, `inventory`, `equipment`,
`location`, plus `metadata` for staleness) so each can evolve and be written
independently. The plugin only writes a slice when its content actually changes.

## Roadmap

- **Milestone 1 (done):** player, skills, inventory, equipment, location + the
  seven tools above.
- **Milestone 2 (done):** quests, diaries, activities (`get_quests`,
  `get_diaries`, `get_current_activity`).
- **Milestone 3 (done):** bank support + GE valuation (`get_bank`, `get_bank_value`).
- **Milestone 4:** screenshots + multimodal coaching.
- **Advice channel (done):** `push_advice` / `get_advice` surface the client's
  advice on the in-game panel.
- **Context engine (done):** a derived layer (account stage, combat readiness,
  recommended goals) on top of raw state, via `get_account_context`.

See [`docs/plans/`](docs/plans) for the design and implementation plan.

## License

MIT — see [LICENSE](LICENSE). Contributions welcome; see
[CONTRIBUTING.md](CONTRIBUTING.md).
