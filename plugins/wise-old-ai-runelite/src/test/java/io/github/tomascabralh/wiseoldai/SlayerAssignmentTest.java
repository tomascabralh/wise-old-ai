package io.github.tomascabralh.wiseoldai;

import org.junit.Test;
import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertNull;

public class SlayerAssignmentTest
{
	@Test
	public void parsesPlainAssignment()
	{
		assertArrayEquals(
			new String[]{"aberrant spectres", null},
			WiseOldAiPlugin.parseSlayerAssignment("You're assigned to kill aberrant spectres; only 134 more to go."));
	}

	@Test
	public void parsesKonarAssignmentWithLocation()
	{
		assertArrayEquals(
			new String[]{"aberrant spectres", "Catacombs of Kourend"},
			WiseOldAiPlugin.parseSlayerAssignment("You're assigned to kill aberrant spectres in the Catacombs of Kourend; only 134 more to go."));
	}

	@Test
	public void parsesNewTaskWithLeadingAmount()
	{
		assertArrayEquals(
			new String[]{"aberrant spectres", null},
			WiseOldAiPlugin.parseSlayerAssignment("Your new task is to kill 134 aberrant spectres."));
	}

	@Test
	public void parsesCurrentlyAssignedCheck()
	{
		assertArrayEquals(
			new String[]{"hellhounds", null},
			WiseOldAiPlugin.parseSlayerAssignment("You're currently assigned to kill hellhounds; only 90 more to go."));
	}

	@Test
	public void ignoresUnrelatedMessages()
	{
		assertNull(WiseOldAiPlugin.parseSlayerAssignment("You have completed your task!"));
		assertNull(WiseOldAiPlugin.parseSlayerAssignment("Oh dear, you are dead!"));
	}
}
