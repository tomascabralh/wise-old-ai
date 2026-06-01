package io.github.tomascabralh.wiseoldai.model;

/** Current activity. For now the Slayer task. Mirrors ActivitiesStateSchema. */
public class ActivitiesState
{
	public Slayer slayer = new Slayer();

	public static class Slayer
	{
		public int taskAmountRemaining;
		public int points;
		public int streak;
		public boolean bossTask;
	}
}
