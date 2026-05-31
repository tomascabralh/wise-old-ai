package io.github.tomascabralh.wiseoldai.model;

/** Mirrors PlayerStateSchema in shared/schemas. Serialized to player.json by Gson. */
public class PlayerState
{
	public String username;
	public int combatLevel;
	public int totalLevel;
	public int world;
	public Hitpoints hitpoints;
	public int prayer;
	public int runEnergy;

	public static class Hitpoints
	{
		public int current;
		public int max;
	}
}
