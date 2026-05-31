#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { tools } from "./tools.js";

const server = new McpServer({ name: "wise-old-ai", version: "0.1.0" });

for (const [name, tool] of Object.entries(tools)) {
  server.registerTool(name, { description: tool.description }, async () => tool.run());
}

await server.connect(new StdioServerTransport());
