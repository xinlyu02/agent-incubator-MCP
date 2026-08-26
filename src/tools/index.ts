import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IncubatorClient } from "../incubator/client.js";
import { registerSearchIdeas } from "./searchIdeas.js";
import { registerGetIdeaDetail } from "./getIdeaDetail.js";
import { registerGetDashboard } from "./getDashboard.js";

export function buildMcpServer(client: IncubatorClient): McpServer {
  const server = new McpServer({ name: "incubator-mcp", version: "1.0.0" });
  registerSearchIdeas(server, client);
  registerGetIdeaDetail(server, client);
  registerGetDashboard(server, client);
  return server;
}