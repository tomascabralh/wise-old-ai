package io.github.tomascabralh.wiseoldai.model;

import java.util.ArrayList;
import java.util.List;

/** Mirrors InventoryStateSchema: { "items": [...] }. */
public class InventoryState
{
	public List<InventoryItem> items = new ArrayList<>();
}
