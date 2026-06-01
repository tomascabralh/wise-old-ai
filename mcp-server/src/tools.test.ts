import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
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

  it("get_quests summarizes counts and quest points", async () => {
    await write("quests.json", {
      questPoints: 290,
      quests: { "Cook's Assistant": "FINISHED", "Dragon Slayer II": "IN_PROGRESS", "Sins of the Father": "NOT_STARTED" },
    });
    const out = (await tools.get_quests.run()).content[0].text;
    expect(out).toContain("Quest points: 290");
    expect(out).toContain("Completed: 1 / 3");
    expect(out).toContain("Dragon Slayer II");
  });

  it("get_diaries reports completed tiers", async () => {
    await write("diaries.json", { ardougne: { easy: true, medium: true, hard: false, elite: false } });
    const out = (await tools.get_diaries.run()).content[0].text;
    expect(out).toContain("ardougne: easy, medium");
    expect(out).toContain("2 / 4");
  });

  it("get_current_activity reports the slayer task", async () => {
    await write("activities.json", { slayer: { taskAmountRemaining: 87, points: 1500, streak: 120, bossTask: false } });
    const out = (await tools.get_current_activity.run()).content[0].text;
    expect(out).toContain("87 remaining");
    expect(out).toContain("streak: 120");
  });

  it("push_advice writes advice.json and get_advice reads it back", async () => {
    await tools.push_advice.run({ body: "Train Slayer next", title: "Next goal" });
    const raw = JSON.parse(await readFile(join(dir, "advice.json"), "utf8"));
    expect(raw.body).toBe("Train Slayer next");
    expect(raw.title).toBe("Next goal");
    expect(typeof raw.createdAt).toBe("string");

    const out = await tools.get_advice.run();
    expect(out.content[0].text).toContain("Train Slayer next");
    expect(out.content[0].text).toContain("Next goal");
  });

  it("get_advice reports when nothing posted", async () => {
    const out = await tools.get_advice.run();
    expect(out.content[0].text).toMatch(/no advice/i);
  });
});
