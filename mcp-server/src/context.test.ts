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

  // --- v2 ---

  const bankWith = (names: string[], coins = 0) => ({
    geValue: 0,
    items: [
      ...names.map((name, i) => ({ id: 1000 + i, name, quantity: 1, gePrice: 0 })),
      ...(coins ? [{ id: 995, name: "Coins", quantity: coins, gePrice: 1 }] : []),
    ],
  });

  it("gear-aware readiness: fails a boss when the gear isn't owned", () => {
    const noGear = computeContext({
      skills: maxedCombatSkills,
      quests: { questPoints: 0, quests: { "Dragon Slayer II": "FINISHED" } },
      bank: bankWith(["Rune platebody", "Coins"]),
    });
    const vork = noGear.combatReadiness.find((b) => b.boss === "Vorkath");
    expect(vork?.ready).toBe(false);
    expect(vork?.reason).toMatch(/ranged weapon/i);

    const withGear = computeContext({
      skills: maxedCombatSkills,
      quests: { questPoints: 0, quests: { "Dragon Slayer II": "FINISHED" } },
      bank: bankWith(["Dragon hunter crossbow"]),
    });
    expect(withGear.combatReadiness.find((b) => b.boss === "Vorkath")?.ready).toBe(true);
  });

  it("gear is 'unverified' rather than failed when the bank hasn't been opened", () => {
    const ctx = computeContext({
      skills: maxedCombatSkills,
      quests: { questPoints: 0, quests: { "Dragon Slayer II": "FINISHED" } },
    });
    const vork = ctx.combatReadiness.find((b) => b.boss === "Vorkath");
    expect(vork?.ready).toBe(true);
    expect(vork?.reason).toMatch(/unverified/i);
  });

  it("money-makers are filtered by what the account qualifies for", () => {
    const ctx = computeContext({
      skills: maxedCombatSkills,
      quests: { questPoints: 0, quests: { "Dragon Slayer II": "FINISHED" } },
    });
    expect(ctx.moneyMakers.some((m) => m.includes("Vorkath"))).toBe(true);
  });

  it("upgrade advice flags missing BiS and frames liquid cash", () => {
    const ctx = computeContext({
      skills: maxedCombatSkills,
      bank: bankWith(["Dragon hunter crossbow"], 41_000_000),
    });
    expect(ctx.upgradeAdvice.join(" ")).toMatch(/41\.0M/);
    expect(ctx.upgradeAdvice.some((u) => /Tumeken|Twisted bow|Scythe/i.test(u))).toBe(true);
  });

  it("slayer advice: 'do it' for a good task, 'block' for a bad one", () => {
    const good = computeContext({ activities: { slayer: { taskName: "Bloodveld", taskLocation: null, taskAmountRemaining: 230, points: 1000, streak: 1, bossTask: false } } });
    expect(good.slayerAdvice).toMatch(/do it/i);
    const bad = computeContext({ activities: { slayer: { taskName: "Crawling hands", taskLocation: null, taskAmountRemaining: 50, points: 1000, streak: 1, bossTask: false } } });
    expect(bad.slayerAdvice).toMatch(/block|skip/i);
  });

  it("weaknesses surface a one-step-away boss and the lowest combat stat", () => {
    const ctx = computeContext({
      skills: { ...maxedCombatSkills, prayer: { real: 70, boosted: 70, xp: 1 } },
      quests: { questPoints: 0, quests: { "Dragon Slayer II": "FINISHED" } },
      bank: bankWith(["Dragon hunter crossbow"]),
    });
    expect(ctx.weaknesses.some((w) => /Vorkath/.test(w) && /prayer/.test(w))).toBe(true);
    expect(ctx.weaknesses.some((w) => /Lowest combat stat: prayer 70/.test(w))).toBe(true);
  });
});
