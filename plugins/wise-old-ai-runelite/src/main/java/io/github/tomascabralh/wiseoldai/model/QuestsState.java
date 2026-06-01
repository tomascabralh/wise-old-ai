package io.github.tomascabralh.wiseoldai.model;

import java.util.LinkedHashMap;
import java.util.Map;

/** Quest points + per-quest state (NOT_STARTED / IN_PROGRESS / FINISHED). Mirrors QuestsStateSchema. */
public class QuestsState
{
	public int questPoints;
	public Map<String, String> quests = new LinkedHashMap<>();
}
