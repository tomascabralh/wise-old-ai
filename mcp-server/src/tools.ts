import { readSlice } from "./stateStore.js";
import {
  PlayerStateSchema,
  SkillsStateSchema,
  InventoryStateSchema,
  EquipmentStateSchema,
  LocationStateSchema,
} from "@wise-old-ai/schemas";

export type ToolResult = { content: { type: "text"; text: string }[] };
const text = (s: string): ToolResult => ({ content: [{ type: "text", text: s }] });

export interface Tool {
  description: string;
  run: () => Promise<ToolResult>;
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
};
