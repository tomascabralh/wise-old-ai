# Wise Old AI — Milestone 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A RuneLite plugin exports live OSRS account state to `~/.wise-old-ai/state/*.json`, and a TypeScript MCP server exposes read-only tools so Claude Desktop can answer account-specific questions.

**Architecture:** Two independent codebases sharing only a JSON-on-disk contract. The plugin snapshots state on the client thread each `GameTick` and writes changed slices atomically off-thread. The MCP server reads files on demand, validates with Zod, and serves MCP tools over stdio.

**Tech Stack:** Java 11 + Gradle + RuneLite API (Lombok, Gson) · TypeScript + Node + `@modelcontextprotocol/sdk` + Zod + Vitest.

**Conventions:** Commit messages are one lowercase sentence, no prefixes, no AI attribution (per user global CLAUDE.md). DRY, YAGNI, TDD. Stop point: both builds green.

---

## Task 0: Toolchain + repo skeleton

**Step 1 — Install Java 11 (isolated, default JDK 21 untouched):**
```bash
bash -lc 'source "$HOME/.sdkman/bin/sdkman-init.sh" && sdk install java 11.0.25-tem'
```
Expected: Temurin 11 installed under `~/.sdkman/candidates/java/11.0.25-tem`. (If that exact version is gone, `sdk list java | grep 11\.` and pick a current `*-tem`.)

**Step 2 — Create directory skeleton + root files:**
- Create: `.gitignore` (node_modules, dist, build, .gradle, *.tsbuildinfo, .DS_Store)
- Create: `LICENSE` (MIT, holder "Wise Old AI contributors", year 2026)
- Create: `README.md` (stub; filled in Task 11)

**Step 3 — Commit:**
```bash
git add .gitignore LICENSE README.md
git commit -m "add repo skeleton, license, and gitignore"
```

---

## Task 1: Shared Zod schemas (the contract)

**Files:**
- Create: `shared/schemas/package.json`, `tsconfig.json`
- Create: `shared/schemas/src/index.ts`
- Test: `shared/schemas/src/index.test.ts`

`package.json`: name `@wise-old-ai/schemas`, type `module`, deps `zod`, devDeps `vitest`, `typescript`. Scripts: `"test": "vitest run"`, `"build": "tsc"`.

**Step 1 — Failing test** (`src/index.test.ts`):
```ts
import { describe, it, expect } from "vitest";
import { PlayerStateSchema, SkillsStateSchema, LocationStateSchema } from "./index";

describe("schemas", () => {
  it("accepts a valid player state", () => {
    const ok = { username: "Zezima", combatLevel: 126, totalLevel: 2277,
      world: 330, hitpoints: { current: 99, max: 99 }, prayer: 99, runEnergy: 100 };
    expect(PlayerStateSchema.parse(ok)).toEqual(ok);
  });
  it("rejects a player state missing username", () => {
    expect(() => PlayerStateSchema.parse({ combatLevel: 3 })).toThrow();
  });
  it("accepts a skills map", () => {
    const ok = { attack: { real: 70, boosted: 70, xp: 737627 } };
    expect(SkillsStateSchema.parse(ok)).toMatchObject(ok);
  });
  it("accepts a location", () => {
    expect(LocationStateSchema.parse({ x: 3200, y: 3200, plane: 0, regionId: 12850 })).toBeTruthy();
  });
});
```

**Step 2 — Run, verify fail:** `cd shared/schemas && npm i && npx vitest run` → FAIL (module not found).

**Step 3 — Implement** (`src/index.ts`):
```ts
import { z } from "zod";

export const SkillEntrySchema = z.object({
  real: z.number().int().min(1).max(99),
  boosted: z.number().int(),
  xp: z.number().int().min(0),
});
export const SkillsStateSchema = z.record(z.string(), SkillEntrySchema);

export const PlayerStateSchema = z.object({
  username: z.string(),
  combatLevel: z.number().int(),
  totalLevel: z.number().int(),
  world: z.number().int(),
  hitpoints: z.object({ current: z.number().int(), max: z.number().int() }),
  prayer: z.number().int(),
  runEnergy: z.number().int().min(0).max(100),
});

export const InventoryItemSchema = z.object({
  id: z.number().int(), name: z.string(), quantity: z.number().int().min(1),
});
export const InventoryStateSchema = z.object({ items: z.array(InventoryItemSchema) });

export const EquipmentSlotSchema = InventoryItemSchema.nullable();
export const EquipmentStateSchema = z.object({
  weapon: EquipmentSlotSchema, shield: EquipmentSlotSchema, helm: EquipmentSlotSchema,
  body: EquipmentSlotSchema, legs: EquipmentSlotSchema, cape: EquipmentSlotSchema,
  amulet: EquipmentSlotSchema, ring: EquipmentSlotSchema, gloves: EquipmentSlotSchema,
  boots: EquipmentSlotSchema, ammo: EquipmentSlotSchema,
});

export const LocationStateSchema = z.object({
  x: z.number().int(), y: z.number().int(), plane: z.number().int(), regionId: z.number().int(),
});

export const MetadataSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.record(z.string(), z.string()), // slice -> ISO timestamp
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type SkillsState = z.infer<typeof SkillsStateSchema>;
export type InventoryState = z.infer<typeof InventoryStateSchema>;
export type EquipmentState = z.infer<typeof EquipmentStateSchema>;
export type LocationState = z.infer<typeof LocationStateSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
```

**Step 4 — Run, verify pass.** **Step 5 — Commit:** `git commit -m "add shared zod state schemas"`.

---

## Task 2: MCP server state store (read + validate + staleness)

**Files:**
- Create: `mcp-server/package.json`, `tsconfig.json`
- Create: `mcp-server/src/stateStore.ts`
- Test: `mcp-server/src/stateStore.test.ts`

`package.json`: name `@wise-old-ai/mcp-server`, type `module`, deps `@modelcontextprotocol/sdk`, `zod`, `@wise-old-ai/schemas` (file: link), devDeps `vitest`, `typescript`, `tsx`, `@types/node`. Scripts: `test`, `build` (`tsc`), `start` (`node dist/index.js`), `dev` (`tsx src/index.ts`).

**Step 1 — Failing test** reads fixtures from a temp `state/` dir: write a valid `skills.json`, assert `readSlice("skills", SkillsStateSchema)` returns parsed data; write malformed JSON, assert it returns `{ ok: false, error }` (no throw); missing file → `{ ok: false, error: "missing" }`.

**Step 3 — Implement** `stateStore.ts`:
```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ZodType } from "zod";

export const stateDir = () =>
  process.env.WISE_OLD_AI_STATE_DIR ?? join(homedir(), ".wise-old-ai", "state");

export type ReadResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function readSlice<T>(slice: string, schema: ZodType<T>): Promise<ReadResult<T>> {
  let raw: string;
  try {
    raw = await readFile(join(stateDir(), `${slice}.json`), "utf8");
  } catch {
    return { ok: false, error: `No ${slice}.json yet — is RuneLite running with the Wise Old AI plugin enabled?` };
  }
  try {
    return { ok: true, data: schema.parse(JSON.parse(raw)) };
  } catch (e) {
    return { ok: false, error: `Invalid ${slice}.json: ${(e as Error).message}` };
  }
}
```

**Step 4 — pass. Step 5 — commit** `git commit -m "add mcp state store with validation"`.

---

## Task 3: MCP tools (one test+impl pass per tool)

**Files:** Create `mcp-server/src/tools.ts`, Test `mcp-server/src/tools.test.ts`.

Each tool returns `{ content: [{ type: "text", text }] }`. On read failure, `text` is the friendly error. Define a registry the server iterates. Tools: `get_player_state`, `get_stats`, `get_combat_level`, `get_total_level`, `get_inventory`, `get_equipment`, `get_location`.

**Step 1 — Failing tests** (fixtures via `WISE_OLD_AI_STATE_DIR` temp dir): e.g. `get_combat_level` returns text containing `"126"`; `get_stats` lists `attack 70`; missing inventory file → text contains "is RuneLite running".

**Step 3 — Implement** `tools.ts`:
```ts
import { readSlice } from "./stateStore.js";
import {
  PlayerStateSchema, SkillsStateSchema, InventoryStateSchema,
  EquipmentStateSchema, LocationStateSchema,
} from "@wise-old-ai/schemas";

type ToolResult = { content: { type: "text"; text: string }[] };
const text = (s: string): ToolResult => ({ content: [{ type: "text", text: s }] });

export const tools = {
  get_player_state: { description: "Player username, combat/total level, world, HP, prayer, run energy.",
    run: async () => { const r = await readSlice("player", PlayerStateSchema);
      return text(r.ok ? JSON.stringify(r.data, null, 2) : r.error); } },
  get_stats: { description: "All skill levels (real, boosted, xp).",
    run: async () => { const r = await readSlice("skills", SkillsStateSchema);
      if (!r.ok) return text(r.error);
      return text(Object.entries(r.data).map(([k, v]) => `${k} ${v.real} (xp ${v.xp})`).join("\n")); } },
  get_combat_level: { description: "Combat level.",
    run: async () => { const r = await readSlice("player", PlayerStateSchema);
      return text(r.ok ? `Combat level: ${r.data.combatLevel}` : r.error); } },
  get_total_level: { description: "Total level.",
    run: async () => { const r = await readSlice("player", PlayerStateSchema);
      return text(r.ok ? `Total level: ${r.data.totalLevel}` : r.error); } },
  get_inventory: { description: "Inventory items.",
    run: async () => { const r = await readSlice("inventory", InventoryStateSchema);
      return text(r.ok ? JSON.stringify(r.data.items, null, 2) : r.error); } },
  get_equipment: { description: "Worn equipment by slot.",
    run: async () => { const r = await readSlice("equipment", EquipmentStateSchema);
      return text(r.ok ? JSON.stringify(r.data, null, 2) : r.error); } },
  get_location: { description: "World position (x, y, plane, region).",
    run: async () => { const r = await readSlice("location", LocationStateSchema);
      return text(r.ok ? JSON.stringify(r.data, null, 2) : r.error); } },
} as const;
```

**Step 5 — commit** `git commit -m "add mcp account tools with tests"`.

---

## Task 4: MCP server entrypoint (stdio wiring)

**Files:** Create `mcp-server/src/index.ts`. No unit test (transport glue); verified by `tools.test.ts` + a manual smoke step.

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { tools } from "./tools.js";

const server = new Server({ name: "wise-old-ai", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.entries(tools).map(([name, t]) => ({
    name, description: t.description, inputSchema: { type: "object", properties: {} },
  })),
}));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = (tools as Record<string, { run: () => Promise<any> }>)[req.params.name];
  if (!tool) throw new Error(`Unknown tool: ${req.params.name}`);
  return tool.run();
});

await server.connect(new StdioServerTransport());
```
> Note: confirm exact SDK import paths/handler names against the installed `@modelcontextprotocol/sdk` version at build time (the SDK API has shifted across versions); adjust if `npx tsc` complains.

**Smoke step:** `npm run build && node dist/index.js` starts without error (Ctrl-C to exit). **Commit** `git commit -m "wire mcp stdio server entrypoint"`.

---

## Task 5: Example state fixtures

Create `examples/state/{player,skills,inventory,equipment,location,metadata}.json` matching the schemas (a plausible mid-game account). Used by docs and manual testing. **Commit** `git commit -m "add example state fixtures"`.

---

## Task 6: RuneLite plugin Gradle scaffold

**Files:** Create `plugins/wise-old-ai-runelite/{settings.gradle,build.gradle}`, Gradle wrapper, `runelite-plugin.properties`.

`build.gradle` (mirrors RuneLite example-plugin):
```groovy
plugins { id 'java' }
repositories {
  mavenLocal()
  maven { url = 'https://repo.runelite.net'; content { includeGroupByRegex 'net\\.runelite.*' } }
  mavenCentral()
}
def runeLiteVersion = 'latest.release'
dependencies {
  compileOnly group: 'net.runelite', name: 'client', version: runeLiteVersion
  compileOnly 'org.projectlombok:lombok:1.18.30'
  annotationProcessor 'org.projectlombok:lombok:1.18.30'
  testImplementation group: 'net.runelite', name: 'client', version: runeLiteVersion
  testImplementation group: 'net.runelite', name: 'jshell', version: runeLiteVersion
  testImplementation 'junit:junit:4.13.2'
}
java { toolchain { languageVersion = JavaLanguageVersion.of(11) } }
tasks.withType(JavaCompile) { options.encoding = 'UTF-8'; options.release.set(11) }
group = 'io.github.tomascabralh'
```
Gradle picks the Temurin 11 toolchain installed in Task 0 (auto-detects `~/.sdkman`). **Commit** `git commit -m "add runelite plugin gradle scaffold"`.

---

## Task 7: Plugin model DTOs

Create `src/main/java/io/github/tomascabralh/wiseoldai/model/` with plain DTOs serialized by Gson: `PlayerState`, `SkillEntry`, `InventoryItem`, `EquipmentState`, `LocationState`. Field names must exactly match the Zod schemas (`current`/`max` for hp, `regionId`, etc.). **Commit** `git commit -m "add plugin state dtos"`.

---

## Task 8: StateExporter (hash-diff + atomic write) — JUnit

**Files:** Create `StateExporter.java`; Test `src/test/java/.../StateExporterTest.java`.

**Step 1 — Failing JUnit test** against a JUnit `TemporaryFolder`:
- `write("skills", json)` creates `skills.json` with the content.
- Calling `write` twice with identical content writes the file only once (track via `File.lastModified` or a write counter) — proves hash-diff.
- After a write, no `*.tmp` file remains — proves atomic rename cleanup.

**Step 3 — Implement:** keep a `Map<String,String> lastHash`; on `write(slice, json)`, skip if `sha256(json)` equals last; else write to `slice.json.tmp`, `fsync`, `Files.move(tmp, target, ATOMIC_MOVE, REPLACE_EXISTING)`, update hash + `metadata.updatedAt`. All writes serialized on a single-thread `ExecutorService`. Pure logic — no RuneLite imports — so it's unit-testable.

**Step 4 — Run:** `cd plugins/wise-old-ai-runelite && ./gradlew test`. **Commit** `git commit -m "add state exporter with hash-diff and atomic writes"`.

---

## Task 9: WiseOldAiPlugin + Config

**Files:** Create `WiseOldAiConfig.java` (export dir override, min write interval ms default 600), `WiseOldAiPlugin.java`.

Plugin: `@PluginDescriptor(name = "Wise Old AI")`, `@Inject Client`, `@Inject ItemManager`, `@Inject WiseOldAiConfig`, `@Inject ClientThread`. `startUp` creates the exporter + state dir; `shutDown` stops the executor. `@Subscribe onGameTick`: guard `LOGGED_IN && getLocalPlayer() != null`; build each DTO via the API mapping in the design doc; hand each slice's Gson JSON to the exporter (which throttles/diffs). No unit test for the plugin glue itself (the API mapping is exercised live); the diff/atomic logic is already covered by Task 8.

**Verify:** `./gradlew build` produces a shadow jar. **Commit** `git commit -m "add wise old ai plugin with gametick export"`.

---

## Task 10: Prove both builds green (stop-point gate)

- `cd mcp-server && npm run build && npx vitest run` → all pass, `dist/` emitted.
- `cd shared/schemas && npx vitest run` → pass.
- `cd plugins/wise-old-ai-runelite && ./gradlew clean build` → BUILD SUCCESSFUL, jar in `build/libs/`.

Record outputs. If any red, fix before proceeding (do not claim done).

---

## Task 11: Docs + Claude Desktop setup, then STOP

- `README.md`: what it is, the advisory/not-a-bot stance, architecture diagram, install (plugin sideload via `build/libs` jar into RuneLite, MCP server build), the seven tools, example prompts.
- `docs/claude-desktop-setup.md`: exact `claude_desktop_config.json` snippet:
  ```json
  { "mcpServers": { "wise-old-ai": { "command": "node",
    "args": ["/absolute/path/to/wise-old-ai/mcp-server/dist/index.js"] } } }
  ```
- `CONTRIBUTING.md`: brief.

**Commit** `git commit -m "add readme, claude desktop setup, and contributing"`. Then **STOP and report** both build results for review. Do not start Milestone 2.

---

## Out of scope (later milestones)
Bank, quests, diaries, combat achievements, activities, nearby NPCs, screenshots, context engine, Docker.
