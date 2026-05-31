# Wise Old AI — Milestone 1 Design

> Status: approved-for-planning · Date: 2026-05-31 · Scope: Milestone 1 only

Wise Old AI is an MIT-licensed, local-first **advisory** companion for Old School
RuneScape. A RuneLite plugin exports read-only account state to local JSON files;
a TypeScript MCP server reads those files and exposes tools to MCP clients
(Claude Desktop, Cursor, Windsurf). It is an advisor, never an automation tool —
no input control, pathfinding, or gameplay automation of any kind.

## Milestone 1 goal

A user launches RuneLite with the plugin enabled, connects Claude Desktop to the
MCP server, and gets account-specific advice (e.g. *"What should I train next?"*)
driven by live data.

## Key approach decisions

1. **MCP server reads on demand.** Each tool call reads the relevant `*.json`
   fresh and validates with Zod. Stateless — no watcher, no cache. Reads
   `metadata.json` to surface staleness in every result. (Alt: watch+cache —
   rejected as YAGNI.)
2. **Item names resolved in the plugin.** The plugin has RuneLite's `ItemManager`,
   so it writes `{id, name, quantity}`. The MCP server needs no item database.
3. **Plugin writes off the client thread, atomically.** `onGameTick` (client
   thread) builds a cheap snapshot; a single background executor writes each
   changed slice via `tmp → fsync → atomic rename`. A per-slice content hash +
   min-write-interval throttles disk churn.
4. **Naming.** Java package root `io.github.tomascabralh.wiseoldai`
   (plugin-hub reverse-domain convention). Plugin compiles to **Java 11** via a
   Gradle toolchain (Temurin 11 installed via SDKMAN alongside the user's JDK 21).

## Architecture

```
RuneLite client ─(client thread)─► WiseOldAiPlugin
                                      │ onGameTick: snapshot state
                                      ▼  background executor (hash-diff, atomic write)
                         ~/.wise-old-ai/state/*.json   ← single source of truth
                                      ▲ read-on-demand + Zod validate
                         mcp-server (TypeScript, stdio) ─► Claude Desktop / Cursor / Windsurf
```

Two independent codebases sharing only the **JSON-on-disk contract** (Zod schemas
in `shared/schemas`, mirrored by the plugin's Gson DTOs).

## Repository layout (M1)

```
wise-old-ai/
├── plugins/wise-old-ai-runelite/   # Gradle, Java 11 external plugin
│   └── src/main/java/io/github/tomascabralh/wiseoldai/
│       ├── WiseOldAiPlugin.java     # lifecycle + onGameTick
│       ├── WiseOldAiConfig.java     # export dir, min write interval
│       ├── StateExporter.java       # hash-diff + atomic writes
│       └── model/                   # Player/Skills/Inventory/Equipment/Location DTOs
├── shared/schemas/                  # Zod schemas (the contract) + exported TS types
├── mcp-server/                      # @modelcontextprotocol/sdk, stdio transport
│   └── src/ (index.ts, stateStore.ts, tools/*.ts)
├── examples/state/                  # sample JSON for tests without the game
├── docs/ (plans/, architecture, setup)
└── README.md  LICENSE(MIT)  CONTRIBUTING.md
```

## State files → tools

| File | Tools |
|---|---|
| `player.json` | `get_player_state`, `get_combat_level`, `get_total_level` |
| `skills.json` | `get_stats` |
| `inventory.json` | `get_inventory` |
| `equipment.json` | `get_equipment` |
| `location.json` | `get_location` |
| `metadata.json` | staleness appended to every result |

## RuneLite API mapping

All reads run in `@Subscribe onGameTick(GameTick)` on the client thread, guarded by
`client.getGameState() == GameState.LOGGED_IN && client.getLocalPlayer() != null`.
`Client` and `ItemManager` are `@Inject`-ed.

**player.json**
| Field | API |
|---|---|
| `username` | `client.getLocalPlayer().getName()` |
| `combatLevel` | `client.getLocalPlayer().getCombatLevel()` |
| `totalLevel` | `client.getTotalLevel()` |
| `world` | `client.getWorld()` |
| `hitpoints` | `getBoostedSkillLevel(Skill.HITPOINTS)` + `getRealSkillLevel` |
| `prayer` | `getBoostedSkillLevel(Skill.PRAYER)` |
| `runEnergy` | `client.getEnergy() / 100` (API returns 0–10000) |

**skills.json** — iterate `Skill.values()` (skip `OVERALL`); per skill
`{ real: getRealSkillLevel(s), boosted: getBoostedSkillLevel(s), xp: getSkillExperience(s) }`.

**inventory.json** — `client.getItemContainer(InventoryID.INVENTORY).getItems()`;
per `Item`: `getId()`, `getQuantity()`, name via `itemManager.getItemComposition(id).getName()`.

**equipment.json** — `client.getItemContainer(InventoryID.EQUIPMENT)`, read by slot
via `EquipmentInventorySlot.{HEAD,CAPE,AMULET,WEAPON,BODY,SHIELD,LEGS,GLOVES,BOOTS,RING,AMMO}`
and `container.getItem(slot.getSlotIdx())`. Spec's "helm" → `HEAD`.

**location.json** — `WorldPoint wp = client.getLocalPlayer().getWorldLocation();`
→ `getX()`, `getY()`, `getPlane()`, `getRegionID()`.

## Error handling

- **Plugin:** never throw on the client thread; skip a slice whose container is
  null (logged out / not loaded). Atomic writes prevent half-written JSON.
- **MCP server:** missing/stale/invalid file → structured "no data yet — is
  RuneLite running with the plugin enabled?" result, not a throw.

## Testing

- **MCP server:** Vitest unit tests per tool against `examples/state/` fixtures —
  this is how M1 is testable without the game. TDD: failing tests first.
- **Plugin:** JUnit test for `StateExporter` hash-diff/atomic-write against a temp dir.
- **E2E success:** RuneLite + plugin running, `examples/` removed, Claude Desktop
  answers *"What should I train next?"* from live data.

## Build phase (after plan approval) — stop point: both builds green

1. `sdk install java 11.0.x-tem` (isolated; default JDK 21 untouched).
2. Scaffold repo; write Zod schemas (the contract) first.
3. MCP server via TDD (failing Vitest → implement).
4. Gradle plugin; compile via Java 11 toolchain to prove it builds.
5. README + Claude Desktop setup; **stop for review.**

## Explicitly out of scope for M1

Bank, quests, diaries, combat achievements, activities, nearby NPCs, screenshots,
the derived "context engine", Docker. Deferred to later milestones per the spec.
