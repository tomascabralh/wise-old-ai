import { z, type ZodTypeAny } from "zod";
import { readSlice, writeSlice } from "./stateStore.js";
import {
  PlayerStateSchema,
  SkillsStateSchema,
  InventoryStateSchema,
  EquipmentStateSchema,
  LocationStateSchema,
  QuestsStateSchema,
  DiariesStateSchema,
  ActivitiesStateSchema,
  AdviceSchema,
} from "@wise-old-ai/schemas";

export type ToolResult = { content: { type: "text"; text: string }[] };
const text = (s: string): ToolResult => ({ content: [{ type: "text", text: s }] });

export interface Tool {
  description: string;
  /** Zod raw shape for tools that take arguments; omitted for no-arg tools. */
  inputSchema?: Record<string, ZodTypeAny>;
  run: (args?: any) => Promise<ToolResult>;
}

export const tools: Record<string, Tool> = {
  get_player_state: {
    description:
      "Player overview: username, combat & total level, world, hitpoints, prayer, run energy.",
    run: async () => {
      const r = await readSlice("player", PlayerStateSchema);
      return text(r.ok ? JSON.stringify(r.data, null, 2) : r.error);
    },
  },
  get_stats: {
    description: "All skill levels with current (boosted) level and total experience.",
    run: async () => {
      const r = await readSlice("skills", SkillsStateSchema);
      if (!r.ok) return text(r.error);
      const lines = Object.entries(r.data).map(
        ([skill, v]) => `${skill}: ${v.real} (boosted ${v.boosted}, xp ${v.xp})`,
      );
      return text(lines.join("\n"));
    },
  },
  get_combat_level: {
    description: "The player's combat level.",
    run: async () => {
      const r = await readSlice("player", PlayerStateSchema);
      return text(r.ok ? `Combat level: ${r.data.combatLevel}` : r.error);
    },
  },
  get_total_level: {
    description: "The player's total level.",
    run: async () => {
      const r = await readSlice("player", PlayerStateSchema);
      return text(r.ok ? `Total level: ${r.data.totalLevel}` : r.error);
    },
  },
  get_inventory: {
    description: "Items currently in the player's inventory.",
    run: async () => {
      const r = await readSlice("inventory", InventoryStateSchema);
      return text(r.ok ? JSON.stringify(r.data.items, null, 2) : r.error);
    },
  },
  get_equipment: {
    description: "Items the player is wearing, by equipment slot.",
    run: async () => {
      const r = await readSlice("equipment", EquipmentStateSchema);
      return text(r.ok ? JSON.stringify(r.data, null, 2) : r.error);
    },
  },
  get_location: {
    description: "The player's world position: x, y, plane, and region id.",
    run: async () => {
      const r = await readSlice("location", LocationStateSchema);
      return text(r.ok ? JSON.stringify(r.data, null, 2) : r.error);
    },
  },
  get_quests: {
    description: "Quest progress: quest points, how many are completed, what's in progress, and what hasn't been started.",
    run: async () => {
      const r = await readSlice("quests", QuestsStateSchema);
      if (!r.ok) return text(r.error);
      const entries = Object.entries(r.data.quests);
      const inProgress = entries.filter(([, s]) => s === "IN_PROGRESS").map(([n]) => n);
      const notStarted = entries.filter(([, s]) => s === "NOT_STARTED").map(([n]) => n);
      const finished = entries.length - inProgress.length - notStarted.length;
      const cap = (xs: string[]) => xs.slice(0, 25).join(", ") + (xs.length > 25 ? `, …(+${xs.length - 25})` : "");
      return text(
        `Quest points: ${r.data.questPoints}\n` +
        `Completed: ${finished} / ${entries.length}\n` +
        `In progress (${inProgress.length}): ${inProgress.length ? cap(inProgress) : "none"}\n` +
        `Not started (${notStarted.length}): ${notStarted.length ? cap(notStarted) : "none"}`,
      );
    },
  },
  get_diaries: {
    description: "Achievement diary completion per area and tier (easy/medium/hard/elite).",
    run: async () => {
      const r = await readSlice("diaries", DiariesStateSchema);
      if (!r.ok) return text(r.error);
      let done = 0;
      const lines = Object.entries(r.data).map(([area, t]) => {
        const tiers = (["easy", "medium", "hard", "elite"] as const).filter((k) => t[k]);
        done += tiers.length;
        return `${area}: ${tiers.length ? tiers.join(", ") : "none"}`;
      });
      return text(`Diary tiers complete: ${done} / ${Object.keys(r.data).length * 4}\n${lines.join("\n")}`);
    },
  },
  get_current_activity: {
    description: "The player's current activity — currently the Slayer task (amount remaining, points, streak).",
    run: async () => {
      const r = await readSlice("activities", ActivitiesStateSchema);
      if (!r.ok) return text(r.error);
      const s = r.data.slayer;
      const task = s.taskAmountRemaining > 0
        ? `${s.taskAmountRemaining} remaining${s.bossTask ? " (boss task)" : ""}`
        : "no active task";
      return text(`Slayer task: ${task}\nSlayer points: ${s.points}, streak: ${s.streak}\n(Note: the task's monster name isn't tracked yet.)`);
    },
  },
  push_advice: {
    description:
      "Post a short piece of advice to the player's in-game Wise Old AI panel (e.g. what to train or do next). Shows in RuneLite until replaced.",
    inputSchema: {
      body: z.string().min(1).describe("The advice text to show in the panel."),
      title: z.string().optional().describe("Optional short heading, e.g. \"Next goal\"."),
    },
    run: async (args: { body: string; title?: string }) => {
      const advice = { title: args.title, body: args.body, createdAt: new Date().toISOString() };
      await writeSlice("advice", advice);
      return text(`Posted advice to the in-game panel${args.title ? ` ("${args.title}")` : ""}.`);
    },
  },
  get_advice: {
    description: "Read the advice currently shown on the player's in-game panel.",
    run: async () => {
      const r = await readSlice("advice", AdviceSchema);
      if (!r.ok) return text("No advice has been posted to the panel yet.");
      const heading = r.data.title ? `${r.data.title}\n\n` : "";
      return text(`${heading}${r.data.body}\n\n(posted ${r.data.createdAt})`);
    },
  },
};
