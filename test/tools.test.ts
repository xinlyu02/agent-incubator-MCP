import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function waitForHealth(url: string, maxMs = 8000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${url} not ready after ${maxMs}ms`);
}

let mockProc: ChildProcess;
let mcpProc: ChildProcess;
let client: Client;

beforeAll(async () => {
  mockProc = spawn(
    process.execPath,
    ["--import", "tsx/esm", join(ROOT, "mock-server/index.ts")],
    { env: { ...process.env, MOCK_PORT: "13001" }, stdio: "pipe" }
  );
  mcpProc = spawn(
    process.execPath,
    ["--import", "tsx/esm", join(ROOT, "src/server.ts")],
    {
      env: {
        ...process.env,
        PORT: "13099",
        AUTH_MODE: "mock",
        INCUBATOR_BASE_URL: "http://localhost:13001",
      },
      stdio: "pipe",
    }
  );
  await Promise.all([
    waitForHealth("http://localhost:13001/health"),
    waitForHealth("http://localhost:13099/health"),
  ]);
  client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL("http://localhost:13099/mcp"))
  );
}, 20000);

afterAll(async () => {
  await client.close().catch(() => {});
  mcpProc.kill();
  mockProc.kill();
});

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

function parseText(result: ToolResult): unknown {
  return JSON.parse(result.content[0].text);
}

describe("search_ideas", () => {
  it("returns paginated results with no filters", async () => {
    const data = parseText(
      await client.callTool({ name: "search_ideas", arguments: { limit: 5 } })
    ) as { ideas: unknown[]; total: number; hasMore: boolean };
    expect(Array.isArray(data.ideas)).toBe(true);
    expect(data.ideas.length).toBeLessThanOrEqual(5);
    expect(data.total).toBe(15);
    expect(data.hasMore).toBe(true);
  });

  it("filters by stage label", async () => {
    const data = parseText(
      await client.callTool({ name: "search_ideas", arguments: { stage: "Prototype" } })
    ) as { ideas: Array<{ stage: string }> };
    expect(data.ideas.length).toBeGreaterThan(0);
    expect(data.ideas.every((i) => i.stage === "Prototype")).toBe(true);
  });

  it("filters by stage index", async () => {
    const data = parseText(
      await client.callTool({ name: "search_ideas", arguments: { stage: 3 } })
    ) as { ideas: Array<{ stageIndex: number }> };
    expect(data.ideas.every((i) => i.stageIndex === 3)).toBe(true);
  });

  it("filters liveOnly", async () => {
    const data = parseText(
      await client.callTool({ name: "search_ideas", arguments: { liveOnly: true } })
    ) as { ideas: Array<{ live: boolean }> };
    expect(data.ideas.length).toBeGreaterThan(0);
    expect(data.ideas.every((i) => i.live === true)).toBe(true);
  });

  it("paginates correctly", async () => {
    const page1 = parseText(
      await client.callTool({ name: "search_ideas", arguments: { limit: 10, offset: 0 } })
    ) as { ideas: Array<{ id: string }> };
    const page2 = parseText(
      await client.callTool({ name: "search_ideas", arguments: { limit: 10, offset: 10 } })
    ) as { ideas: Array<{ id: string }> };
    expect(page1.ideas[0].id).not.toBe(page2.ideas[0].id);
  });
});

describe("get_idea_detail", () => {
  it("returns full idea with stage label, questionnaire, and rollouts", async () => {
    const data = parseText(
      await client.callTool({ name: "get_idea_detail", arguments: { id: "idea-010" } })
    ) as { id: string; stage: string; ideaDescription: string; questionnaire: object | null; rollouts: unknown[] };
    expect(data.id).toBe("idea-010");
    expect(data.stage).toBe("Live");
    expect(data.ideaDescription.length).toBeGreaterThan(0);
    expect(data.questionnaire).not.toBeNull();
    expect(Array.isArray(data.rollouts)).toBe(true);
  });

  it("returns null questionnaire for an idea with no questionnaire", async () => {
    const data = parseText(
      await client.callTool({ name: "get_idea_detail", arguments: { id: "idea-001" } })
    ) as { questionnaire: null };
    expect(data.questionnaire).toBeNull();
  });

  it("returns isError for a non-existent idea id", async () => {
    const result = await client.callTool({ name: "get_idea_detail", arguments: { id: "does-not-exist" } });
    expect((result as { isError?: boolean }).isError).toBe(true);
  });
});

describe("get_dashboard", () => {
  it("returns totalIdeas, liveIdeas, byStage, totalTeamMembers", async () => {
    const data = parseText(
      await client.callTool({ name: "get_dashboard", arguments: {} })
    ) as { totalIdeas: number; liveIdeas: number; byStage: Array<{ stageIndex: number; stage: string; count: number }>; totalTeamMembers: number };
    expect(data.totalIdeas).toBe(15);
    expect(data.liveIdeas).toBe(3);
    expect(Array.isArray(data.byStage)).toBe(true);
    expect(data.byStage).toHaveLength(7);
    const liveStage = data.byStage.find((s) => s.stageIndex === 6);
    expect(liveStage?.stage).toBe("Live");
    expect(liveStage?.count).toBe(3);
    expect(typeof data.totalTeamMembers).toBe("number");
  });
});