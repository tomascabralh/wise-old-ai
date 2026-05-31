import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ZodType } from "zod";

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
export async function readSlice<T>(
  slice: string,
  schema: ZodType<T>,
): Promise<ReadResult<T>> {
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
