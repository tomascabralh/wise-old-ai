# Connecting Wise Old AI to Claude Desktop

This guide wires the Wise Old AI MCP server into Claude Desktop so it can read
your exported OSRS account state.

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

The plugin in `plugins/wise-old-ai-runelite/` compiles against the RuneLite API
and is structured for the [Plugin Hub](https://github.com/runelite/plugin-hub).
Running it inside the live client today uses RuneLite's **external-plugin
developer workflow** (run a RuneLite dev build with this plugin on the
classpath). Packaging a one-command standalone dev-runner and a Plugin Hub
submission are tracked as follow-ups after Milestone 1.

Once the plugin is enabled and a character is logged in, it writes to
`~/.wise-old-ai/state/` every game tick (only when data changes). Remove the
`WISE_OLD_AI_STATE_DIR` override above so the server reads that live directory
(its default is `~/.wise-old-ai/state`).

## Troubleshooting

- **"No <slice>.json found yet"** — the plugin isn't running, no character is
  logged in, or `WISE_OLD_AI_STATE_DIR` points at the wrong folder.
- **Tools don't appear in Claude** — check the config JSON is valid and the path
  to `dist/index.js` is absolute, then fully restart Claude Desktop.
- **Stale data** — `metadata.json` records when each slice was last written.
