import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tools } from "./tools";

let dir: string;
const write = (name: string, obj: unknown) =>
  writeFile(join(dir, name), JSON.stringify(obj));

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "woai-tools-"));
  process.env.WISE_OLD_AI_STATE_DIR = dir;
});
afterEach(async () => {
  delete process.env.WISE_OLD_AI_STATE_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("tools", () => {
  it("get_combat_level reads the player file", async () => {
    await write("player.json", {
      username: "Zezima", combatLevel: 126, totalLevel: 2277, world: 330,
      hitpoints: { current: 99, max: 99 }, prayer: 99, runEnergy: 100,
    });
    const out = await tools.get_combat_level.run();
    expect(out.content[0].text).toContain("126");
  });

  it("get_stats lists a skill line", async () => {
    await write("skills.json", { attack: { real: 70, boosted: 72, xp: 737627 } });
    const out = await tools.get_stats.run();
    expect(out.content[0].text).toContain("attack: 70");
  });

  it("missing inventory yields the friendly plugin hint", async () => {
    const out = await tools.get_inventory.run();
    expect(out.content[0].text).toMatch(/is RuneLite running/i);
  });

  it("get_equipment reads a worn weapon", async () => {
    await write("equipment.json", {
      weapon: { id: 4151, name: "Abyssal whip", quantity: 1 },
      shield: null, helm: null, body: null, legs: null, cape: null,
      amulet: null, ring: null, gloves: null, boots: null, ammo: null,
    });
    const out = await tools.get_equipment.run();
    expect(out.content[0].text).toContain("Abyssal whip");
  });
});
