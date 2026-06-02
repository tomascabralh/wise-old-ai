package io.github.tomascabralh.wiseoldai.model;

/** A bank stack with its unit GE price (0 for untradeables). Mirrors BankItemSchema. */
public class BankItem
{
	public int id;
	public String name;
	public int quantity;
	public int gePrice;

	public BankItem(int id, String name, int quantity, int gePrice)
	{
		this.id = id;
		this.name = name;
		this.quantity = quantity;
		this.gePrice = gePrice;
	}
}
