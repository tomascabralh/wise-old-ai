# Connecting Wise Old AI to Claude Desktop

This guide wires the Wise Old AI MCP server into Claude Desktop so it can read
your exported OSRS account state.

There are two routes:

- **[Easiest: no build](#easiest-no-build-via-npx)**: install the plugin from the
  RuneLite Plugin Hub and run the server with `npx`. Recommended for players.
- **[From source](#from-source)**: clone and build both halves. For development or
  if you want to run unreleased changes.

## Easiest: no build (via npx)

**Prerequisites:** [Claude Desktop](https://claude.ai/download), Node.js 18+
(`node -v`), and RuneLite with the **Wise Old AI** plugin installed from the
Plugin Hub (RuneLite → wrench/Configuration → Plugin Hub → search "Wise Old AI").

Add this to your Claude Desktop config (paths below), then restart Claude Desktop:

```json
{
  "mcpServers": {
    "wise-old-ai": {
      "command": "npx",
      "args": ["-y", "wise-old-ai-mcp"]
    }
  }
}
```

That's it — `npx` fetches and runs the published server, which reads the state the
plugin writes to `~/.wise-old-ai/state/`. Skip to
[§2 Export live state](#2-export-live-state-from-runelite) to start the plugin.

## From source

## Prerequisites

- [Claude Desktop](https://claude.ai/download)
- Node.js 18+ (`node -v`)
- The MCP server built: from the repo root,
  ```bash
  cd shared/schemas && npm install && npm run build
  cd ../../mcp-server && npm install && npm run build
  ```
  This produces `mcp-server/dist/index.js`.

## 1. Add the server to Claude Desktop

Open your Claude Desktop config:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add a `wise-old-ai` entry (use the **absolute** path to `dist/index.js`):

```json
{
  "mcpServers": {
    "wise-old-ai": {
      "command": "node",
      "args": ["/absolute/path/to/wise-old-ai/mcp-server/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. You should see the Wise Old AI tools appear.

### Trying it without the game

To verify the connection before the plugin is running, point the server at the
bundled fixtures by adding an env block:

```json
"wise-old-ai": {
  "command": "node",
  "args": ["/absolute/path/to/wise-old-ai/mcp-server/dist/index.js"],
  "env": { "WISE_OLD_AI_STATE_DIR": "/absolute/path/to/wise-old-ai/examples/state" }
}
```

Then ask Claude *"What should I train next?"* — it will reason over the sample
mid-game account in `examples/state/`.

## 2. Export live state from RuneLite

Launch the live RuneLite client with the plugin side-loaded:

```bash
cd plugins/wise-old-ai-runelite
gradle run
```

This opens a normal RuneLite client with the Wise Old AI plugin already loaded
(it uses RuneLite's `ExternalPluginManager.loadBuiltin` dev path; the launcher is
`WiseOldAiPluginLauncher` in the plugin's test sources). Log in to a character and
it writes to `~/.wise-old-ai/state/` every game tick — but only when a slice's
data actually changes.

Then remove the `WISE_OLD_AI_STATE_DIR` override above so the server reads that
live directory (its default is `~/.wise-old-ai/state`). For eventual one-click
distribution, the plugin is also structured for the
[Plugin Hub](https://github.com/runelite/plugin-hub).

## Troubleshooting

- **"No <slice>.json found yet"** — the plugin isn't running, no character is
  logged in, or `WISE_OLD_AI_STATE_DIR` points at the wrong folder.
- **Tools don't appear in Claude** — check the config JSON is valid and the path
  to `dist/index.js` is absolute, then fully restart Claude Desktop.
- **Stale data** — `metadata.json` records when each slice was last written.
