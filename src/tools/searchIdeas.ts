import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IncubatorClient } from "../incubator/client.js";
import { unwrapODataList, normalizeIdea, resolveStageIndex } from "../incubator/normalize.js";

function escapeOData(v: string): string {
  return v.replace(/'/g, "''");
}

function buildFilter(p: {
  query?: string;
  stage?: number | string;
  businessArea?: string;
  valueType?: string;
  ownerEmail?: string;
  customer?: string;
  liveOnly?: boolean;
}): string | undefined {
  const clauses: string[] = [];
  const stageIdx = resolveStageIndex(p.stage);
  if (stageIdx !== undefined) clauses.push(`stageIndex eq ${stageIdx}`);
  if (p.businessArea) clauses.push(`businessArea eq '${escapeOData(p.businessArea)}'`);
  if (p.valueType) clauses.push(`valueType eq '${escapeOData(p.valueType)}'`);
  if (p.ownerEmail) clauses.push(`ownerEmail eq '${escapeOData(p.ownerEmail)}'`);
  if (p.customer) clauses.push(`customer eq '${escapeOData(p.customer)}'`);
  if (p.liveOnly) clauses.push(`live eq true`);
  if (p.query) {
    const q = escapeOData(p.query);
    clauses.push(`(contains(agentName,'${q}') or contains(shortDescription,'${q}'))`);
  }
  return clauses.length ? clauses.join(" and ") : undefined;
}

export function registerSearchIdeas(server: McpServer, client: IncubatorClient): void {
  server.tool(
    "search_ideas",
    "Search and filter agent ideas by stage, business area, value type, owner, keyword, or customer. Supports pagination.",
    {
      query: z.string().optional().describe("Free-text keyword — searches agentName and shortDescription"),
      stage: z.union([z.number(), z.string()]).optional().describe("Stage index 0–6 or label e.g. 'Prototype'"),
      businessArea: z.string().optional().describe("Business area e.g. 'HR', 'Finance', 'CX'"),
      valueType: z.enum(["customer", "internal"]).optional().describe("Value type filter"),
      ownerEmail: z.string().optional().describe("Filter by idea owner email"),
      customer: z.string().optional().describe("Filter by customer name"),
      liveOnly: z.boolean().optional().describe("Return only live ideas"),
      limit: z.number().min(1).max(100).default(20).describe("Max results, default 20"),
      offset: z.number().min(0).default(0).describe("Pagination offset, default 0"),
    },
    async (params) => {
      const body = await client.listIdeas({
        filter: buildFilter(params),
        top: params.limit,
        skip: params.offset,
        count: true,
      });
      const { items, count } = unwrapODataList(body);
      const ideas = items.map(normalizeIdea);
      const total = count ?? ideas.length;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(
            { ideas, total, limit: params.limit, offset: params.offset, hasMore: params.offset + ideas.length < total },
            null, 2
          ),
        }],
      };
    }
  );
}