#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { tools } from "./tools.js";
import { schemaVersionWarning } from "./stateStore.js";

const server = new McpServer({ name: "wise-old-ai", version: "0.1.0" });

// stdout is the MCP protocol channel — log diagnostics to stderr only.
const warning = await schemaVersionWarning();
if (warning) console.error(`[wise-old-ai] ${warning}`);

for (const [name, tool] of Object.entries(tools)) {
  const config = tool.inputSchema
    ? { description: tool.description, inputSchema: tool.inputSchema }
    : { description: tool.description };
  server.registerTool(name, config as any, async (args: any) => tool.run(args));
}

await server.connect(new StdioServerTransport());
