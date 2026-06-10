import { z } from "zod";

/** One skill's level + experience. `real` is the trained level, `boosted` the current in-game level. */
export const SkillEntrySchema = z.object({
  real: z.number().int().min(1).max(99),
  boosted: z.number().int(),
  xp: z.number().int().min(0),
});

/** Map of skill name (lowercase, e.g. "attack") -> SkillEntry. */
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
  id: z.number().int(),
  name: z.string(),
  quantity: z.number().int().min(1),
});
export const InventoryStateSchema = z.object({ items: z.array(InventoryItemSchema) });

/**
 * An equipment slot is either a worn item or null (empty). Defaults to null so a
 * producer that omits empty slots (e.g. a JSON serializer that drops null fields)
 * still validates.
 */
export const EquipmentSlotSchema = InventoryItemSchema.nullable().default(null);
export const EquipmentStateSchema = z.object({
  weapon: EquipmentSlotSchema,
  shield: EquipmentSlotSchema,
  helm: EquipmentSlotSchema,
  body: EquipmentSlotSchema,
  legs: EquipmentSlotSchema,
  cape: EquipmentSlotSchema,
  amulet: EquipmentSlotSchema,
  ring: EquipmentSlotSchema,
  gloves: EquipmentSlotSchema,
  boots: EquipmentSlotSchema,
  ammo: EquipmentSlotSchema,
});

export const LocationStateSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  plane: z.number().int(),
  regionId: z.number().int(),
});

/** Quest progress. `quests` maps quest name -> state. */
export const QuestStateEnum = z.enum(["NOT_STARTED", "IN_PROGRESS", "FINISHED"]);
export const QuestsStateSchema = z.object({
  questPoints: z.number().int(),
  quests: z.record(z.string(), QuestStateEnum),
});

/** One achievement-diary area's four tiers. */
export const DiaryTiersSchema = z.object({
  easy: z.boolean(),
  medium: z.boolean(),
  hard: z.boolean(),
  elite: z.boolean(),
});
/** Map of area name (e.g. "ardougne") -> tier completion. */
export const DiariesStateSchema = z.record(z.string(), DiaryTiersSchema);

/** A bank entry: like an inventory item plus its unit GE price (0 for untradeables). */
export const BankItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  quantity: z.number().int().min(1),
  gePrice: z.number().int().min(0),
});
/** Bank contents + total GE value. Only populated once the player opens their bank. */
export const BankStateSchema = z.object({
  geValue: z.number().int().min(0),
  items: z.array(BankItemSchema),
});

/** Current activity. For now this is the Slayer task (the monster name isn't tracked yet). */
export const ActivitiesStateSchema = z.object({
  slayer: z.object({
    // taskName/taskLocation come from the Slayer assignment chat message; null until
    // captured (e.g. assigned before the plugin started) or when there's no task.
    taskName: z.string().nullable().default(null),
    taskLocation: z.string().nullable().default(null),
    taskAmountRemaining: z.number().int(),
    points: z.number().int(),
    streak: z.number().int(),
    bossTask: z.boolean(),
  }),
});

/**
 * A piece of advice posted by the MCP client (e.g. Claude) for display on the
 * in-game panel. Written by the server, read by the plugin — the reverse channel.
 */
export const AdviceSchema = z.object({
  title: z.string().optional(),
  body: z.string(),
  createdAt: z.string(), // ISO-8601
});

/**
 * The state-file schema version. Bump when the on-disk contract changes in a
 * breaking way: the plugin stamps it into metadata.json and the MCP server warns
 * on drift, so a mismatched plugin/server pair is obvious instead of cryptic.
 */
export const SCHEMA_VERSION = 1 as const;

/** Written every export so consumers can report data staleness. */
export const MetadataSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  updatedAt: z.record(z.string(), z.string()), // slice name -> ISO-8601 timestamp
});

export type SkillEntry = z.infer<typeof SkillEntrySchema>;
export type SkillsState = z.infer<typeof SkillsStateSchema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type InventoryItem = z.infer<typeof InventoryItemSchema>;
export type InventoryState = z.infer<typeof InventoryStateSchema>;
export type EquipmentState = z.infer<typeof EquipmentStateSchema>;
export type LocationState = z.infer<typeof LocationStateSchema>;
export type QuestsState = z.infer<typeof QuestsStateSchema>;
export type DiariesState = z.infer<typeof DiariesStateSchema>;
export type ActivitiesState = z.infer<typeof ActivitiesStateSchema>;
export type BankItem = z.infer<typeof BankItemSchema>;
export type BankState = z.infer<typeof BankStateSchema>;
export type Advice = z.infer<typeof AdviceSchema>;
export type Metadata = z.infer<typeof MetadataSchema>;
