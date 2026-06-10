import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCHEMA_VERSION } from "@wise-old-ai/schemas";
import { schemaVersionWarning } from "./stateStore";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "woai-ver-"));
  process.env.WISE_OLD_AI_STATE_DIR = dir;
});
afterEach(async () => {
  delete process.env.WISE_OLD_AI_STATE_DIR;
  await rm(dir, { recursive: true, force: true });
});

const writeMeta = (version: unknown) =>
  writeFile(join(dir, "metadata.json"), JSON.stringify({ schemaVersion: version, updatedAt: {} }));

describe("schemaVersionWarning", () => {
  it("returns null when the on-disk version matches", async () => {
    await writeMeta(SCHEMA_VERSION);
    expect(await schemaVersionWarning()).toBeNull();
  });

  it("warns when the on-disk version is newer than expected", async () => {
    await writeMeta(SCHEMA_VERSION + 1);
    const w = await schemaVersionWarning();
    expect(w).toMatch(/schema version/i);
    expect(w).toContain(String(SCHEMA_VERSION + 1));
    expect(w).toContain(String(SCHEMA_VERSION));
  });

  it("returns null when metadata is absent (plugin not running yet)", async () => {
    expect(await schemaVersionWarning()).toBeNull();
  });

  it("returns null on unreadable metadata rather than throwing", async () => {
    await writeFile(join(dir, "metadata.json"), "{not json");
    expect(await schemaVersionWarning()).toBeNull();
  });
});
