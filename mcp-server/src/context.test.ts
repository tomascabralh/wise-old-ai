import { describe, it, expect } from "vitest";
import { computeContext } from "./context";

const maxedCombatSkills = Object.fromEntries(
  ["attack", "strength", "defence", "ranged", "magic", "hitpoints", "prayer", "slayer"].map((s) => [
    s,
    { real: 99, boosted: 99, xp: 13000000 },
  ]),
);

describe("computeContext", () => {
  it("classifies an endgame, maxed-combat, near-completionist account", () => {
    const ctx = computeContext({
      player: { username: "x", combatLevel: 126, totalLevel: 2200, world: 1, hitpoints: { current: 99, max: 99 }, prayer: 99, runEnergy: 100 },
      skills: maxedCombatSkills,
      quests: { questPoints: 300, quests: {} },
    });
    expect(ctx.accountStage).toContain("endgame");
    expect(ctx.accountStage).toContain("maxed combat");
    expect(ctx.accountStage).toContain("near-completionist");
  });

  it("marks a boss ready only when stats AND quests are met", () => {
    const ready = computeContext({
      skills: maxedCombatSkills,
      quests: { questPoints: 0, quests: { "Dragon Slayer II": "FINISHED" } },
    });
    expect(ready.combatReadiness.find((b) => b.boss === "Vorkath")?.ready).toBe(true);

    const noQuest = computeContext({
      skills: maxedCombatSkills,
      quests: { questPoints: 0, quests: { "Dragon Slayer II": "IN_PROGRESS" } },
    });
    const vork = noQuest.combatReadiness.find((b) => b.boss === "Vorkath");
    expect(vork?.ready).toBe(false);
    expect(vork?.reason).toContain("Dragon Slayer II");
  });

  it("fails readiness with a clear reason when stats are too low", () => {
    const ctx = computeContext({
      skills: { ranged: { real: 70, boosted: 70, xp: 1 } },
      quests: { questPoints: 0, quests: { "Dragon Slayer II": "FINISHED" } },
    });
    const vork = ctx.combatReadiness.find((b) => b.boss === "Vorkath");
    expect(vork?.ready).toBe(false);
    expect(vork?.reason).toMatch(/prayer|defence|hitpoints/);
  });

  it("recommends elites when all hards are done", () => {
    const diaries = Object.fromEntries(
      ["ardougne", "varrock"].map((a) => [a, { easy: true, medium: true, hard: true, elite: false }]),
    );
    const ctx = computeContext({ diaries });
    expect(ctx.recommendedGoals.some((g) => /Elite/i.test(g))).toBe(true);
  });

  it("recommends finishing an active slayer task", () => {
    const ctx = computeContext({
      activities: { slayer: { taskName: "Bloodveld", taskLocation: null, taskAmountRemaining: 230, points: 1, streak: 1, bossTask: false } },
    });
    expect(ctx.recommendedGoals.some((g) => g.includes("Bloodveld") && g.includes("230"))).toBe(true);
  });

  it("degrades gracefully with no data", () => {
    const ctx = computeContext({});
    expect(ctx.accountStage).toBe("fresh account");
    expect(ctx.combatReadiness.every((b) => !b.ready)).toBe(true);
    expect(ctx.recommendedGoals.length).toBeGreaterThan(0);
  });
});
