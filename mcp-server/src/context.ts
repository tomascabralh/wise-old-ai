import type {
  PlayerState,
  SkillsState,
  QuestsState,
  DiariesState,
  ActivitiesState,
  BankState,
} from "@wise-old-ai/schemas";

/**
 * The derived "judgment" layer. Pure and deterministic: given whatever slices are
 * available, it produces an experienced-player read of the account. All heuristics
 * are intentionally simple and transparent — tune the BOSSES table and the goal
 * rules freely. This is the only place account *interpretation* lives.
 */

export interface AccountContextInput {
  player?: PlayerState;
  skills?: SkillsState;
  quests?: QuestsState;
  diaries?: DiariesState;
  activities?: ActivitiesState;
  bank?: BankState;
}

export interface BossReadiness {
  boss: string;
  ready: boolean;
  reason: string;
}

export interface AccountContext {
  accountStage: string;
  combatReadiness: BossReadiness[];
  recommendedGoals: string[];
}

type SkillReq = Partial<Record<string, number>>;
interface BossReq {
  boss: string;
  stats?: SkillReq;
  quests?: string[];
}

/** Rough, well-known gates — proxies for "can comfortably attempt", not exact minimums. */
const BOSSES: BossReq[] = [
  { boss: "Vorkath", stats: { ranged: 75, defence: 70, prayer: 74, hitpoints: 80 }, quests: ["Dragon Slayer II"] },
  { boss: "Zulrah", stats: { ranged: 75, magic: 75, prayer: 70 }, quests: ["Regicide"] },
  { boss: "Corrupted Gauntlet", stats: { attack: 80, ranged: 80, magic: 80, defence: 70, prayer: 77 }, quests: ["Song of the Elves"] },
  { boss: "Tombs of Amascut", stats: { ranged: 80, magic: 80, prayer: 74, hitpoints: 80 }, quests: ["Beneath Cursed Sands"] },
  { boss: "General Graardor (GWD)", stats: { attack: 70, strength: 70, defence: 70, hitpoints: 80, prayer: 60 } },
  { boss: "Fight Caves (Jad)", stats: { ranged: 75, defence: 60, prayer: 43, hitpoints: 75 } },
  { boss: "Cerberus", stats: { slayer: 91, prayer: 70, hitpoints: 80 } },
];

function evaluateBoss(req: BossReq, input: AccountContextInput): BossReadiness {
  const missing: string[] = [];
  for (const [skill, level] of Object.entries(req.stats ?? {})) {
    if ((input.skills?.[skill]?.real ?? 0) < (level as number)) {
      missing.push(`${skill} ${level}`);
    }
  }
  for (const quest of req.quests ?? []) {
    if (input.quests?.quests?.[quest] !== "FINISHED") {
      missing.push(`quest: ${quest}`);
    }
  }
  // If we have no skills data at all, we can't judge — say so rather than claim ready.
  if (!input.skills) {
    return { boss: req.boss, ready: false, reason: "no stats data yet" };
  }
  return {
    boss: req.boss,
    ready: missing.length === 0,
    reason: missing.length === 0 ? "meets stat/quest requirements" : `needs ${missing.join(", ")}`,
  };
}

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

function countTierIncomplete(diaries: DiariesState, tier: "easy" | "medium" | "hard" | "elite"): number {
  return Object.values(diaries).filter((t) => !t[tier]).length;
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
    const states = Object.values(input.quests.quests);
    const remaining = states.filter((s) => s !== "FINISHED").length;
    if (remaining > 0 && remaining <= 8) {
      goals.push(`Quest cape is close — ${remaining} quest${remaining === 1 ? "" : "s"} remain.`);
    }
  }

  const slayer = input.activities?.slayer;
  if (slayer && slayer.taskAmountRemaining > 0) {
    const name = slayer.taskName ?? "your current";
    goals.push(`Finish your ${name} Slayer task (${slayer.taskAmountRemaining} left).`);
  }

  if (goals.length === 0) {
    goals.push("You're in great shape — pick a long-term grind (megarare hunting, pets, or 200m XP skills).");
  }
  return goals;
}

export function computeContext(input: AccountContextInput): AccountContext {
  return {
    accountStage: deriveStage(input),
    combatReadiness: BOSSES.map((b) => evaluateBoss(b, input)),
    recommendedGoals: deriveGoals(input),
  };
}

/** Render the context as readable text for an MCP tool response. */
export function formatContext(ctx: AccountContext): string {
  const readiness = ctx.combatReadiness
    .map((b) => `${b.ready ? "✓" : "✗"} ${b.boss} — ${b.reason}`)
    .join("\n");
  const goals = ctx.recommendedGoals.map((g, i) => `${i + 1}. ${g}`).join("\n");
  return `Account stage: ${ctx.accountStage}\n\nCombat readiness:\n${readiness}\n\nRecommended goals:\n${goals}`;
}
