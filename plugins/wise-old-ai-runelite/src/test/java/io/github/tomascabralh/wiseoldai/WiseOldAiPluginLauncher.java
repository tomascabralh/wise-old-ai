package io.github.tomascabralh.wiseoldai;

import net.runelite.client.RuneLite;
import net.runelite.client.externalplugins.ExternalPluginManager;

/**
 * Local development launcher (not a unit test). Side-loads the Wise Old AI plugin
 * into a real RuneLite client so you can see live state export. Run with `gradle run`.
 *
 * It lives in src/test so it can use the RuneLite client on the test runtime
 * classpath without shipping it in the plugin jar.
 */
public class WiseOldAiPluginLauncher
{
	public static void main(String[] args) throws Exception
	{
		ExternalPluginManager.loadBuiltin(WiseOldAiPlugin.class);
		RuneLite.main(args);
	}
}
