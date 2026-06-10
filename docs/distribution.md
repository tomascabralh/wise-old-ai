# Distribution — publishing the server and the plugin

The two halves ship through different channels and are installed independently:

- **MCP server** → npm (so players run `npx wise-old-ai-mcp`).
- **RuneLite plugin** → the RuneLite **Plugin Hub**.

Both steps need credentials or a PR to a repo you don't own, so they are run by a
human. This doc is the checklist. Do the [closeout cycle](#0-before-you-publish)
first.

## 0. Before you publish

- [ ] CI is green on `main` (the `CI` workflow builds + tests both halves).
- [ ] `shared/schemas` and `mcp-server` build cleanly: `npm run build` in each.
- [ ] Plugin builds via the wrapper: `cd plugins/wise-old-ai-runelite && ./gradlew build`.
- [ ] Bump versions intentionally (server `package.json`, plugin `build.gradle`).

---

## 1. Publish the MCP server to npm

The setup guide tells users to run `npx wise-old-ai-mcp`. Two things must be true
for that command to resolve, and **neither is true of the repo as-is** — handle
both before `npm publish`:

### a. Package name

`npx wise-old-ai-mcp` looks up a package literally named `wise-old-ai-mcp`. The
package is currently `@wise-old-ai/mcp-server` (scoped). Either:

- **Recommended:** rename it to `wise-old-ai-mcp` (unscoped) in
  `mcp-server/package.json`. Check the name is free: `npm view wise-old-ai-mcp`.
- Or keep the scope and change the setup guide to `npx @wise-old-ai/mcp-server`.

### b. The `@wise-old-ai/schemas` dependency

`mcp-server` depends on schemas via `"@wise-old-ai/schemas": "file:../shared/schemas"`.
A `file:` path does **not** install from npm — published as-is it would break for
everyone. Pick one:

- **Recommended — bundle it.** Compile the server into a single file with the
  schemas inlined, so the published package has no workspace dependency. Add esbuild
  and a publish build:

  ```bash
  cd mcp-server
  npm i -D esbuild
  npx esbuild src/index.ts --bundle --platform=node --format=esm \
    --packages=external --outfile=dist/index.js \
    --banner:js='#!/usr/bin/env node'
  ```

  Mark `@wise-old-ai/schemas` so it is *not* treated as external (drop it from
  `--packages=external` handling by bundling it): the simplest reliable form is to
  bundle everything and externalize only `@modelcontextprotocol/sdk` and `zod`:

  ```bash
  npx esbuild src/index.ts --bundle --platform=node --format=esm \
    --external:@modelcontextprotocol/sdk --external:zod \
    --outfile=dist/index.js --banner:js='#!/usr/bin/env node'
  ```

  Then remove `@wise-old-ai/schemas` from `dependencies` (it is now inlined) and set
  `"prepublishOnly": "<the esbuild command>"`.

- **Or publish schemas too.** `npm publish` `@wise-old-ai/schemas` first, then change
  the server dep to `"@wise-old-ai/schemas": "^0.1.0"`. Two packages to version
  forever; only do this if the schemas are independently useful.

### c. Publish

```bash
cd mcp-server
npm login              # needs your npm account + 2FA
npm publish --access public
```

### d. Register it for discovery (optional)

- Add an entry to [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers)
  (community list) and/or [Smithery](https://smithery.ai).
- A one-line `npx` install snippet in the README is the highest-leverage discovery.

---

## 2. Submit the plugin to the RuneLite Plugin Hub

> **Blocker to decide first: repo layout.** The Plugin Hub clones your repo at a
> pinned commit and builds it **from the repository root** — in `build=standard` it
> even replaces your `build.gradle`/`settings.gradle` with its own, and it reads
> `icon.png` from the **repo root**. This plugin lives in a *subdirectory*
> (`plugins/wise-old-ai-runelite/`) of a monorepo, so the Hub cannot build it as-is.

**Recommended:** extract the plugin into its own dedicated repository with the
conventional RuneLite layout at the root, and submit that:

```
wise-old-ai-runelite/        (new repo)
├── src/main/java/...         (moved up from plugins/wise-old-ai-runelite/src)
├── src/test/java/...
├── runelite-plugin.properties
├── icon.png                  (≤ 48×72 px) — currently only inside the jar resources
├── build.gradle
├── settings.gradle
├── gradlew + gradle/wrapper/ (already generated)
└── LICENSE (MIT) + README
```

Keep this monorepo as the canonical source / dev home; the extracted repo is the
publish target the Hub builds from. (Alternatively, keep one repo and restructure
so the plugin is at root — but that fights the schemas/server layout. A separate
plugin repo is cleaner.)

### Steps

1. **Create `icon.png` at the repo root** of the plugin repo (≤ 48×72). An owl icon
   already exists at
   `src/main/resources/io/github/tomascabralh/wiseoldai/icon.png` — reuse/resize it.
2. **Confirm `runelite-plugin.properties`** is correct (it already exists):
   ```
   displayName=Wise Old AI
   author=tomascabralh
   description=Exports read-only account state for the Wise Old AI advisor.
   tags=external,utility,account
   plugins=io.github.tomascabralh.wiseoldai.WiseOldAiPlugin
   ```
3. **Push the plugin repo** and note the full 40-char commit hash you want to pin.
4. **Fork [`runelite/plugin-hub`](https://github.com/runelite/plugin-hub)** and add a
   file `plugins/wise-old-ai` (no extension):
   ```
   repository=https://github.com/tomascabralh/wise-old-ai-runelite.git
   commit=<full-40-char-commit-hash>
   ```
5. **Open the PR.** In the description, lead with the safety story so reviewers don't
   have to infer it:
   > Read-only. Writes account state to local disk only. No network calls, no
   > external program execution, no input control or automation. Advisor, not a bot.
6. Expect review back-and-forth. New dependencies slow review (manual hash
   verification) — this plugin has none beyond RuneLite + Lombok, keep it that way.

### Honest risks (also in the Notion wrap-up)

- The "exports my whole account for an AI" framing is novel; reviewers may pause
  even though it's strictly advisory and local.
- A Hub plugin that breaks against a future RuneLite API change and isn't updated
  gets removed. Since the project is in maintenance mode, treat the listing as
  best-effort.

---

## 3. Tag a release

After both are published and the Hub PR is merged:

```bash
git tag -a v1.0.0 -m "wise-old-ai v1.0.0 — feature-complete, on npm + Plugin Hub"
git push origin v1.0.0
gh release create v1.0.0 --generate-notes
```
