import { describe, it, expect } from "vitest";
import {
  PlayerStateSchema,
  SkillsStateSchema,
  LocationStateSchema,
  EquipmentStateSchema,
  InventoryStateSchema,
} from "./index";

describe("schemas", () => {
  it("accepts a valid player state", () => {
    const ok = {
      username: "Zezima",
      combatLevel: 126,
      totalLevel: 2277,
      world: 330,
      hitpoints: { current: 99, max: 99 },
      prayer: 99,
      runEnergy: 100,
    };
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
    expect(
      LocationStateSchema.parse({ x: 3200, y: 3200, plane: 0, regionId: 12850 }),
    ).toBeTruthy();
  });

  it("accepts an empty inventory and a null equipment slot", () => {
    expect(InventoryStateSchema.parse({ items: [] }).items).toHaveLength(0);
    const eq = {
      weapon: { id: 4151, name: "Abyssal whip", quantity: 1 },
      shield: null, helm: null, body: null, legs: null, cape: null,
      amulet: null, ring: null, gloves: null, boots: null, ammo: null,
    };
    expect(EquipmentStateSchema.parse(eq).weapon?.name).toBe("Abyssal whip");
  });

  it("treats omitted equipment slots as null (producer dropped null fields)", () => {
    const partial = { helm: { id: 1, name: "Helm", quantity: 1 } };
    const parsed = EquipmentStateSchema.parse(partial);
    expect(parsed.weapon).toBeNull();
    expect(parsed.ammo).toBeNull();
    expect(parsed.helm?.name).toBe("Helm");
  });
});
