import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IncubatorClient } from "../incubator/client.js";
import { STAGE_LABELS, type NormalizedDashboard } from "../incubator/normalize.js";

function normalizeDashboard(raw: Record<string, unknown>): NormalizedDashboard {
  // byStage: available from mock/legacy shape {stageCounts: {0: n}}
  const stageCounts = (raw.stageCounts ?? raw.byStage ?? {}) as Record<string, number>;
  const byStage = Object.entries(STAGE_LABELS).map(([idx, label]) => ({
    stageIndex: Number(idx),
    stage: label,
    count: Number(stageCounts[idx] ?? stageCounts[label] ?? 0),
  }));

  const result: NormalizedDashboard = {
    // real API: nominatedCount covers all active ideas; legacy: total/totalIdeas
    totalIdeas: Number(raw.nominatedCount ?? raw.total ?? raw.totalIdeas ?? 0),
    liveIdeas: Number(raw.liveCount ?? raw.live ?? raw.liveIdeas ?? 0),
    byStage,
    totalTeamMembers: Number(raw.totalTeamMembers ?? raw.teamMembers ?? 0),
  };

  // Pass through real API fields when present
  if (raw.liveTarget !== undefined) result.liveTarget = Number(raw.liveTarget);
  if (raw.nominatedCF !== undefined) result.nominatedCF = Number(raw.nominatedCF);
  if (raw.nominatedIE !== undefined) result.nominatedIE = Number(raw.nominatedIE);
  if (raw.customersTouched !== undefined) result.customersTouched = Number(raw.customersTouched);
  if (raw.gtmCount !== undefined) result.gtmCount = Number(raw.gtmCount);
  if (raw.activeCount !== undefined) result.activeCount = Number(raw.activeCount);

  return result;
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