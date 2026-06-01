# Wise Old AI

An open-source, local-first **AI advisor** for Old School RuneScape. A RuneLite
plugin exports your account state to local JSON files; an MCP server lets Claude
Desktop (and any MCP client) read that state and give you personalized
progression, PvM, skilling, and questing advice.

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
> accounts — see [`docs/jagex-account-dev-login.md`](docs/jagex-account-dev-login.md).

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
- **Milestone 2:** quests, diaries, activities (`get_quests`, `get_diaries`,
  `get_current_activity`).
- **Milestone 3:** bank support + valuation, progression analysis.
- **Milestone 4:** screenshots + multimodal coaching.
- **Context engine:** a derived layer (account stage, combat readiness,
  recommended goals) on top of raw state.

See [`docs/plans/`](docs/plans) for the design and implementation plan.

## License

MIT — see [LICENSE](LICENSE). Contributions welcome; see
[CONTRIBUTING.md](CONTRIBUTING.md).
