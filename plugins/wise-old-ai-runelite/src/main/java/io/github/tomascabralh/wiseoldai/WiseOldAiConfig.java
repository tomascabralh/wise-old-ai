package io.github.tomascabralh.wiseoldai;

import net.runelite.client.config.Config;
import net.runelite.client.config.ConfigGroup;
import net.runelite.client.config.ConfigItem;

@ConfigGroup("wiseoldai")
public interface WiseOldAiConfig extends Config
{
	@ConfigItem(
		keyName = "stateDir",
		name = "State directory",
		description = "Folder to export state files into. Leave blank for ~/.wise-old-ai/state."
	)
	default String stateDir()
	{
		return "";
	}

	@ConfigItem(
		keyName = "minWriteIntervalMs",
		name = "Min write interval (ms)",
		description = "Minimum time between exports. Lower is more live, higher is gentler on disk."
	)
	default int minWriteIntervalMs()
	{
		return 600;
	}
}
