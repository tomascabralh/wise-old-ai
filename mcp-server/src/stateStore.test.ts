import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { readSlice } from "./stateStore";

const Schema = z.object({ a: z.number() });
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "woai-store-"));
  process.env.WISE_OLD_AI_STATE_DIR = dir;
});
afterEach(async () => {
  delete process.env.WISE_OLD_AI_STATE_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("readSlice", () => {
  it("parses a valid file", async () => {
    await writeFile(join(dir, "thing.json"), JSON.stringify({ a: 1 }));
    const r = await readSlice("thing", Schema);
    expect(r).toEqual({ ok: true, data: { a: 1 } });
  });

  it("returns a friendly error for a missing file", async () => {
    const r = await readSlice("nope", Schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/is RuneLite running/i);
  });

  it("does not throw on malformed json", async () => {
    await writeFile(join(dir, "bad.json"), "{not json");
    const r = await readSlice("bad", Schema);
    expect(r.ok).toBe(false);
  });

  it("does not throw on schema mismatch", async () => {
    await writeFile(join(dir, "wrong.json"), JSON.stringify({ a: "x" }));
    const r = await readSlice("wrong", Schema);
    expect(r.ok).toBe(false);
  });
});
