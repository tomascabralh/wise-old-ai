package io.github.tomascabralh.wiseoldai.model;

/** Worn equipment by slot. Each field is an InventoryItem or null. Mirrors EquipmentStateSchema. */
public class EquipmentState
{
	public InventoryItem weapon;
	public InventoryItem shield;
	public InventoryItem helm;
	public InventoryItem body;
	public InventoryItem legs;
	public InventoryItem cape;
	public InventoryItem amulet;
	public InventoryItem ring;
	public InventoryItem gloves;
	public InventoryItem boots;
	public InventoryItem ammo;
}
