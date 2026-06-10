import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { z, type ZodTypeAny } from "zod";
import { SCHEMA_VERSION } from "@wise-old-ai/schemas";

/** Directory the RuneLite plugin writes state files into. Overridable for tests. */
export const stateDir = (): string =>
  process.env.WISE_OLD_AI_STATE_DIR ?? join(homedir(), ".wise-old-ai", "state");

export type ReadResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Read one state slice from disk and validate it. Never throws: a missing file,
 * unparseable JSON, or schema mismatch all return a friendly { ok: false } so
 * tools can tell the user the plugin probably isn't running yet.
 */
export async function readSlice<S extends ZodTypeAny>(
  slice: string,
  schema: S,
): Promise<ReadResult<z.output<S>>> {
  let raw: string;
  try {
    raw = await readFile(join(stateDir(), `${slice}.json`), "utf8");
  } catch {
    return {
      ok: false,
      error: `No ${slice}.json found yet — is RuneLite running with the Wise Old AI plugin enabled and a character logged in?`,
    };
  }
  try {
    return { ok: true, data: schema.parse(JSON.parse(raw)) };
  } catch (e) {
    return { ok: false, error: `Could not read ${slice}.json: ${(e as Error).message}` };
  }
}

/** Lenient read of just the version field — tolerates a future schema's extra fields. */
const VersionOnlySchema = z.object({ schemaVersion: z.number().int() });

/**
 * If the on-disk state was written by a different schema version than this server
 * expects, return a human-readable warning; otherwise null. Missing/unreadable
 * metadata returns null (the plugin simply isn't running yet — readSlice already
 * gives a friendly per-tool message for that case).
 */
export async function schemaVersionWarning(): Promise<string | null> {
  const r = await readSlice("metadata", VersionOnlySchema);
  if (!r.ok) return null;
  if (r.data.schemaVersion !== SCHEMA_VERSION) {
    return (
      `State files were written with schema version ${r.data.schemaVersion}, ` +
      `but this server expects ${SCHEMA_VERSION}. Update the Wise Old AI plugin and ` +
      `MCP server to matching versions — some tools may misbehave until you do.`
    );
  }
  return null;
}

/** Atomically write a slice (tmp file + rename) so a reader never sees partial JSON. */
export async function writeSlice(slice: string, data: unknown): Promise<void> {
  const dir = stateDir();
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `${slice}.json.tmp`);
  const target = join(dir, `${slice}.json`);
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await rename(tmp, target);
}
