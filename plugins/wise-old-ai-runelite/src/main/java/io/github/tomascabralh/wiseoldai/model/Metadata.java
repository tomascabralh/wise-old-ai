package io.github.tomascabralh.wiseoldai.model;

import java.util.Map;

/** Staleness metadata. Mirrors MetadataSchema. */
public class Metadata
{
	public int schemaVersion = 1;
	public Map<String, String> updatedAt;
}
