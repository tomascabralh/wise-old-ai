import type {
  PlayerState,
  SkillsState,
  QuestsState,
  DiariesState,
  ActivitiesState,
  BankState,
  EquipmentState,
} from "@wise-old-ai/schemas";

/**
 * The derived "judgment" layer. Pure and deterministic: given whatever slices are
 * available, it produces an experienced-player read of the account. All heuristics
 * are intentionally simple, transparent, and table-driven — tune the tables freely.
 * This is the only place account *interpretation* lives (no LLM here; the model is
 * the client). Estimates (GP/hr, gear tiers) are rough guidance, not gospel.
 */

export interface AccountContextInput {
  player?: PlayerState;
  skills?: SkillsState;
  quests?: QuestsState;
  diaries?: DiariesState;
  activities?: ActivitiesState;
  bank?: BankState;
  equipment?: EquipmentState;
}

export interface BossReadiness {
  boss: string;
  ready: boolean;
  reason: string;
  /** Internal: unmet requirements, used to derive weaknesses. */
  missing: string[];
}

export interface AccountContext {
  accountStage: string;
  combatReadiness: BossReadiness[];
  slayerAdvice?: string;
  moneyMakers: string[];
  upgradeAdvice: string[];
  weaknesses: string[];
  recommendedGoals: string[];
}

// --- small helpers ---

const lvl = (input: AccountContextInput, skill: string): number => input.skills?.[skill]?.real ?? 0;

const questDone = (input: AccountContextInput, quest: string): boolean =>
  input.quests?.quests?.[quest] === "FINISHED";

function ownedNames(input: AccountContextInput): Set<string> {
  const names = new Set<string>();
  for (const it of input.bank?.items ?? []) names.add(it.name.toLowerCase());
  if (input.equipment) {
    for (const slot of Object.values(input.equipment)) {
      if (slot) names.add(slot.name.toLowerCase());
    }
  }
  return names;
}

const ownsAny = (owned: Set<string>, anyOf: string[]): boolean =>
  anyOf.some((want) => [...owned].some((name) => name.includes(want)));

function liquidCash(input: AccountContextInput): number {
  const coins = input.bank?.items.find((i) => i.id === 995 || i.name.toLowerCase() === "coins");
  return coins?.quantity ?? 0;
}

function formatGp(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 1e3)}K`;
  return `${v}`;
}

// --- tables (rough, tunable) ---

interface GearReq { label: string; anyOf: string[]; }
interface BossReq { boss: string; stats?: Record<string, number>; quests?: string[]; gear?: GearReq[]; }

const RANGED_WEAPONS = ["dragon hunter crossbow", "toxic blowpipe", "twisted bow", "bow of faerdhinen", "armadyl crossbow", "zaryte crossbow", "rune crossbow"];
const MELEE_WEAPONS = ["abyssal whip", "osmumten's fang", "dragon warhammer", "scythe of vitur", "ghrazi rapier", "blade of saeldor", "saradomin sword", "zamorakian hasta", "arclight", "emberlight"];

const BOSSES: BossReq[] = [
  { boss: "Vorkath", stats: { ranged: 75, defence: 70, prayer: 74, hitpoints: 80 }, quests: ["Dragon Slayer II"], gear: [{ label: "a strong ranged weapon", anyOf: RANGED_WEAPONS }] },
  { boss: "Zulrah", stats: { ranged: 75, magic: 75, prayer: 70 }, quests: ["Regicide"], gear: [{ label: "a ranged weapon", anyOf: RANGED_WEAPONS }, { label: "a magic weapon", anyOf: ["trident", "sanguinesti staff", "tumeken's shadow"] }] },
  { boss: "Corrupted Gauntlet", stats: { attack: 80, ranged: 80, magic: 80, defence: 70, prayer: 77 }, quests: ["Song of the Elves"] },
  { boss: "Tombs of Amascut", stats: { ranged: 80, magic: 80, prayer: 74, hitpoints: 80 }, quests: ["Beneath Cursed Sands"], gear: [{ label: "a ranged weapon", anyOf: RANGED_WEAPONS }] },
  { boss: "General Graardor (GWD)", stats: { attack: 70, strength: 70, defence: 70, hitpoints: 80, prayer: 60 }, gear: [{ label: "a strong melee weapon", anyOf: MELEE_WEAPONS }] },
  { boss: "Fight Caves (Jad)", stats: { ranged: 75, defence: 60, prayer: 43, hitpoints: 75 }, gear: [{ label: "a ranged weapon", anyOf: RANGED_WEAPONS }] },
  { boss: "Cerberus", stats: { slayer: 91, prayer: 70, hitpoints: 80 }, gear: [{ label: "a strong melee weapon", anyOf: MELEE_WEAPONS }] },
];

interface MoneyMaker { name: string; gpHr: string; stats?: Record<string, number>; quests?: string[]; }
const MONEY_MAKERS: MoneyMaker[] = [
  { name: "Tombs of Amascut (raids)", gpHr: "~5–8M/hr", stats: { ranged: 80, magic: 80 }, quests: ["Beneath Cursed Sands"] },
  { name: "Vorkath", gpHr: "~3–4M/hr", stats: { ranged: 75 }, quests: ["Dragon Slayer II"] },
  { name: "Alchemical Hydra", gpHr: "~3–4M/hr", stats: { slayer: 95, ranged: 80 } },
  { name: "Zulrah", gpHr: "~2.5–3.5M/hr", stats: { ranged: 75, magic: 75 }, quests: ["Regicide"] },
  { name: "High-tier Slayer (gargoyles, nechs, abyssal demons)", gpHr: "~1.5–3M/hr", stats: { slayer: 85 } },
  { name: "Herb/tree farming runs", gpHr: "~2–4M/day (passive)", stats: { farming: 70 } },
];

interface Wish { item: string; anyOf: string[]; note: string; }
const WISHLIST: Wish[] = [
  { item: "Tumeken's shadow", anyOf: ["tumeken's shadow"], note: "BiS magic — transforms ToA/CoX/most magic" },
  { item: "Twisted bow", anyOf: ["twisted bow"], note: "BiS ranged vs high-Magic targets" },
  { item: "Scythe of Vitur", anyOf: ["scythe of vitur"], note: "BiS melee for large/multi-hit targets" },
  { item: "Masori armour", anyOf: ["masori body", "masori chaps", "masori mask"], note: "BiS ranged armour" },
  { item: "Zaryte crossbow", anyOf: ["zaryte crossbow"], note: "top crossbow for ToB/ToA" },
  { item: "Voidwaker", anyOf: ["voidwaker"], note: "reliable burst spec weapon" },
  { item: "Avernic defender", anyOf: ["avernic defender"], note: "best-in-slot melee shield" },
];

const SLAYER_GOOD = new Set(["bloodveld", "nechryael", "abyssal demons", "gargoyles", "dust devils", "kraken", "cave kraken", "smoke devils", "dark beasts", "alchemical hydra", "rune dragons", "hellhounds", "greater demons"]);
const SLAYER_BLOCK = new Set(["crawling hands", "cave bugs", "cave crawlers", "banshees", "mogres", "minotaurs", "sourhogs", "icefiends", "goblins", "monkeys", "rats", "spiders", "scorpions", "bats", "birds", "cows", "dogs", "ghosts", "lizards", "wall beasts", "lava dragons", "brine rats"]);

// --- derivations ---

function isMaxedCombat(skills?: SkillsState): boolean {
  const combat = ["attack", "strength", "defence", "ranged", "magic", "hitpoints", "prayer"];
  return !!skills && combat.every((s) => (skills[s]?.real ?? 0) >= 99);
}

function deriveStage(input: AccountContextInput): string {
  const total = input.player?.totalLevel ?? 0;
  const cb = input.player?.combatLevel ?? 0;
  const qp = input.quests?.questPoints ?? 0;

  let stage: string;
  if (total >= 2000 || cb >= 115) stage = "endgame";
  else if (total >= 1500) stage = "late-game";
  else if (total >= 1000) stage = "mid-game";
  else if (total >= 500) stage = "early-game";
  else stage = "fresh account";

  const tags: string[] = [];
  if (isMaxedCombat(input.skills)) tags.push("maxed combat");
  if (qp >= 280) tags.push("near-completionist questing");
  return tags.length ? `${stage}, ${tags.join(", ")}` : stage;
}

function evaluateBoss(req: BossReq, input: AccountContextInput): BossReadiness {
  if (!input.skills) {
    return { boss: req.boss, ready: false, reason: "no stats data yet", missing: ["stats data"] };
  }
  const missing: string[] = [];
  for (const [skill, level] of Object.entries(req.stats ?? {})) {
    if (lvl(input, skill) < level) missing.push(`${skill} ${level}`);
  }
  for (const quest of req.quests ?? []) {
    if (!questDone(input, quest)) missing.push(`quest: ${quest}`);
  }

  let note = "";
  if (req.gear && input.bank) {
    const owned = ownedNames(input);
    for (const g of req.gear) {
      if (!ownsAny(owned, g.anyOf)) missing.push(g.label);
    }
  } else if (req.gear) {
    note = " (gear unverified — open your bank)";
  }

  return {
    boss: req.boss,
    ready: missing.length === 0,
    reason: (missing.length === 0 ? "meets requirements" : `needs ${missing.join(", ")}`) + note,
    missing,
  };
}

function meetsReq(input: AccountContextInput, req: { stats?: Record<string, number>; quests?: string[] }): boolean {
  for (const [skill, level] of Object.entries(req.stats ?? {})) {
    if (lvl(input, skill) < level) return false;
  }
  return (req.quests ?? []).every((q) => questDone(input, q));
}

function deriveMoneyMakers(input: AccountContextInput): string[] {
  if (!input.skills) return [];
  return MONEY_MAKERS.filter((m) => meetsReq(input, m)).slice(0, 5).map((m) => `${m.name} — ${m.gpHr}`);
}

function deriveUpgrades(input: AccountContextInput): string[] {
  if (!input.bank) {
    return ["Open your bank in-game so the advisor can check gear ownership and suggest upgrades."];
  }
  const owned = ownedNames(input);
  const lacking = WISHLIST.filter((w) => !ownsAny(owned, w.anyOf));
  const cash = liquidCash(input);
  const out: string[] = [];
  if (cash < 50_000_000) {
    out.push(`~${formatGp(cash)} liquid: not enough for a tier-defining item (most BiS upgrades are 100M–1B+) — save toward one goal.`);
  } else {
    out.push(`~${formatGp(cash)} liquid available for upgrades.`);
  }
  if (lacking.length === 0) {
    out.push("You already own the headline BiS items — upgrades from here are niche/situational.");
  } else {
    for (const w of lacking.slice(0, 3)) out.push(`Consider working toward: ${w.item} — ${w.note}`);
  }
  return out;
}

function deriveSlayerAdvice(input: AccountContextInput): string | undefined {
  const s = input.activities?.slayer;
  if (!s || s.taskAmountRemaining <= 0) return undefined;
  const name = (s.taskName ?? "").toLowerCase();
  let verdict: string;
  if (SLAYER_BLOCK.has(name)) verdict = `consider blocking or skipping — low value (you have ${s.points} points)`;
  else if (SLAYER_GOOD.has(name)) verdict = "do it — good XP and/or profit";
  else verdict = "fine to do — no strong reason to skip";
  return `${s.taskName ?? "Current task"} x${s.taskAmountRemaining}: ${verdict}.`;
}

function countTierIncomplete(diaries: DiariesState, tier: "easy" | "medium" | "hard" | "elite"): number {
  return Object.values(diaries).filter((t) => !t[tier]).length;
}

function deriveWeaknesses(input: AccountContextInput, readiness: BossReadiness[]): string[] {
  const out: string[] = [];

  for (const b of readiness) {
    if (!b.ready && b.missing.length === 1 && b.missing[0] !== "stats data") {
      out.push(`One step from ${b.boss}: just need ${b.missing[0]}.`);
    }
  }

  if (input.diaries) {
    const hardsLeft = countTierIncomplete(input.diaries, "hard");
    const elitesLeft = countTierIncomplete(input.diaries, "elite");
    if (hardsLeft === 0 && elitesLeft > 0) {
      out.push(`Elite diaries (${elitesLeft} areas) are your biggest open completion goal.`);
    }
  }

  if (input.skills) {
    const combat = ["attack", "strength", "defence", "ranged", "magic", "hitpoints", "prayer"];
    const sub = combat.map((s) => ({ s, n: lvl(input, s) })).filter((x) => x.n < 99).sort((a, b) => a.n - b.n);
    if (sub.length) out.push(`Lowest combat stat: ${sub[0].s} ${sub[0].n} (rounding to 99 helps DPS/prayer access).`);
  }

  return out.slice(0, 4);
}

function deriveGoals(input: AccountContextInput): string[] {
  const goals: string[] = [];

  if (input.diaries) {
    const hardsLeft = countTierIncomplete(input.diaries, "hard");
    const elitesLeft = countTierIncomplete(input.diaries, "elite");
    if (hardsLeft === 0 && elitesLeft > 0) {
      goals.push(`Finish Elite achievement diaries — all Hards are done, ${elitesLeft} areas' Elites remain.`);
    } else if (hardsLeft > 0) {
      goals.push(`Work toward Hard achievement diaries (${hardsLeft} areas left).`);
    }
  }

  if (input.quests) {
    const remaining = Object.values(input.quests.quests).filter((s) => s !== "FINISHED").length;
    if (remaining > 0 && remaining <= 8) {
      goals.push(`Quest cape is close — ${remaining} quest${remaining === 1 ? "" : "s"} remain.`);
    }
  }

  const slayer = input.activities?.slayer;
  if (slayer && slayer.taskAmountRemaining > 0) {
    goals.push(`Finish your ${slayer.taskName ?? "current"} Slayer task (${slayer.taskAmountRemaining} left).`);
  }

  if (goals.length === 0) {
    goals.push("You're in great shape — pick a long-term grind (megarare hunting, pets, or 200m XP skills).");
  }
  return goals;
}

export function computeContext(input: AccountContextInput): AccountContext {
  const combatReadiness = BOSSES.map((b) => evaluateBoss(b, input));
  return {
    accountStage: deriveStage(input),
    combatReadiness,
    slayerAdvice: deriveSlayerAdvice(input),
    moneyMakers: deriveMoneyMakers(input),
    upgradeAdvice: deriveUpgrades(input),
    weaknesses: deriveWeaknesses(input, combatReadiness),
    recommendedGoals: deriveGoals(input),
  };
}

/** Render the context as readable text for an MCP tool response. */
export function formatContext(ctx: AccountContext): string {
  const sections: string[] = [`Account stage: ${ctx.accountStage}`];

  sections.push(
    "Combat readiness:\n" +
      ctx.combatReadiness.map((b) => `${b.ready ? "✓" : "✗"} ${b.boss} — ${b.reason}`).join("\n"),
  );

  if (ctx.slayerAdvice) sections.push(`Current Slayer task: ${ctx.slayerAdvice}`);

  if (ctx.moneyMakers.length) {
    sections.push("Money-makers you qualify for (rough estimates):\n" + ctx.moneyMakers.map((m) => `- ${m}`).join("\n"));
  }

  sections.push("Gear upgrades:\n" + ctx.upgradeAdvice.map((u) => `- ${u}`).join("\n"));

  if (ctx.weaknesses.length) {
    sections.push("Weaknesses / gaps:\n" + ctx.weaknesses.map((w) => `- ${w}`).join("\n"));
  }

  sections.push("Recommended goals:\n" + ctx.recommendedGoals.map((g, i) => `${i + 1}. ${g}`).join("\n"));

  return sections.join("\n\n");
}
