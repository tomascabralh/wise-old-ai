package io.github.tomascabralh.wiseoldai.model;

/** One skill's level + experience. Mirrors SkillEntrySchema. */
public class SkillEntry
{
	public int real;
	public int boosted;
	public int xp;

	public SkillEntry(int real, int boosted, int xp)
	{
		this.real = real;
		this.boosted = boosted;
		this.xp = xp;
	}
}
