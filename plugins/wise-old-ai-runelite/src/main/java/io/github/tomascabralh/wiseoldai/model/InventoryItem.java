package io.github.tomascabralh.wiseoldai.model;

/** A single stack of items. Mirrors InventoryItemSchema. */
public class InventoryItem
{
	public int id;
	public String name;
	public int quantity;

	public InventoryItem(int id, String name, int quantity)
	{
		this.id = id;
		this.name = name;
		this.quantity = quantity;
	}
}
