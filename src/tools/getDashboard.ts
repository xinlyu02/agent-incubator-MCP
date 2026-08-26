import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IncubatorClient } from "../incubator/client.js";
import { STAGE_LABELS, type NormalizedDashboard } from "../incubator/normalize.js";

function normalizeDashboard(raw: Record<string, unknown>): NormalizedDashboard {
  const stageCounts = (raw.stageCounts ?? raw.byStage ?? {}) as Record<string, number>;
  const byStage = Object.entries(STAGE_LABELS).map(([idx, label]) => ({
    stageIndex: Number(idx),
    stage: label,
    count: Number(stageCounts[idx] ?? stageCounts[label] ?? 0),
  }));
  return {
    totalIdeas: Number(raw.total ?? raw.totalIdeas ?? 0),
    liveIdeas: Number(raw.live ?? raw.liveIdeas ?? 0),
    byStage,
    totalTeamMembers: Number(raw.totalTeamMembers ?? raw.teamMembers ?? 0),
  };
}

export function registerGetDashboard(server: McpServer, client: IncubatorClient): void {
  server.tool(
    "get_dashboard",
    "Get aggregate KPI counters for the agent incubator: total ideas, live count, breakdown by stage.",
    {},
    async () => {
      const raw = await client.getDashboard();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(normalizeDashboard(raw), null, 2) }],
      };
    }
  );
}