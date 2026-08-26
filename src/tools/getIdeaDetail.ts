import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IncubatorClient } from "../incubator/client.js";
import { normalizeIdeaDetail } from "../incubator/normalize.js";

export function registerGetIdeaDetail(server: McpServer, client: IncubatorClient): void {
  server.tool(
    "get_idea_detail",
    "Get the full profile of a specific agent idea, including its business case questionnaire and customer rollouts.",
    {
      id: z.string().describe("Idea UUID — obtain from search_ideas"),
    },
    async (params) => {
      const raw = await client.getIdea(params.id);
      const idea = normalizeIdeaDetail(raw);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(idea, null, 2) }],
      };
    }
  );
}