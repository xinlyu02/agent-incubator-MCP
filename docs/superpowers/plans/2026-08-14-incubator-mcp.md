# Incubator MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node.js/TypeScript MCP server that exposes three read-only tools (`search_ideas`, `get_idea_detail`, `get_dashboard`) backed by the existing Incubator OData API, deployable to SAP BTP Cloud Foundry.

**Architecture:** Normalized MCP — each tool call translates to an OData v4 request against `/api/console/*`, with a thin normalization layer that unwraps OData envelopes and maps `stageIndex` integers to human-readable labels before returning clean JSON to Joule Work. Identity passthrough is handled per-request: the incoming Bearer token is forwarded (or exchanged) for every Incubator API call. A local mock server replaces the real Incubator during development and testing.

**Tech Stack:** Node.js ≥20, TypeScript 5, `@modelcontextprotocol/sdk` ^1.15, Express ^4, Zod ^3, Vitest ^2, tsx (dev runner)

---

## File Map

| File | Responsibility |
|---|---|
| `src/config.ts` | Parse and expose env vars |
| `src/server.ts` | Express app — `/mcp` and `/health` endpoints |
| `src/auth/tokenExchange.ts` | Bearer token handling (mock + XSUAA stub) |
| `src/incubator/client.ts` | OData HTTP calls to Incubator API |
| `src/incubator/normalize.ts` | OData → clean JSON, stage label mapping |
| `src/tools/index.ts` | Build McpServer with all tools registered |
| `src/tools/searchIdeas.ts` | `search_ideas` tool definition + handler |
| `src/tools/getIdeaDetail.ts` | `get_idea_detail` tool definition + handler |
| `src/tools/getDashboard.ts` | `get_dashboard` tool definition + handler |
| `mock-server/fixtures/ideas.ts` | 15 realistic agent ideas across all stages |
| `mock-server/index.ts` | Fake Incubator OData API for local dev |
| `test/normalize.test.ts` | Unit tests for normalization layer |
| `test/tools.test.ts` | Integration tests via MCP client |
| `manifest.yml` | CF deployment config (placeholder) |
| `.env.example` | Documented env vars |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p src/auth src/incubator src/tools mock-server/fixtures test
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "incubator-mcp",
  "version": "1.0.0",
  "description": "MCP server for F&S Agent Incubator",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "mock-server": "tsx mock-server/index.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.15.0",
    "dotenv": "^16.4.0",
    "express": "^4.21.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "mock-server/**/*", "test/**/*"]
}
```

- [ ] **Step 4: Write `.env.example`**

```bash
# Local development — set AUTH_MODE=mock to skip XSUAA token exchange
PORT=3000
AUTH_MODE=mock
MOCK_USER_EMAIL=user@fs.com
INCUBATOR_BASE_URL=http://localhost:3001

# Required for CF deployment (provided by BTP/CF owner — see spec Section 6)
# AUTH_MODE=xsuaa
# XSUAA_URL=https://<subdomain>.authentication.<region>.hana.ondemand.com
# XSUAA_CLIENT_ID=sb-incubator-mcp!t12345
# XSUAA_CLIENT_SECRET=<secret>
# INCUBATOR_BASE_URL=https://agent-factory-console.<region>.cfapps.hana.ondemand.com
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git init
echo "node_modules/\ndist/\n.env\n.superpowers/" > .gitignore
git add package.json tsconfig.json .env.example .gitignore
git commit -m "feat: scaffold incubator-mcp project"
```

---

## Task 2: Config Module

**Files:**
- Create: `src/config.ts`

- [ ] **Step 1: Write `src/config.ts`**

```typescript
import "dotenv/config";

function opt(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(opt("PORT", "3000")),
  authMode: opt("AUTH_MODE", "mock") as "mock" | "xsuaa",
  mockUserEmail: opt("MOCK_USER_EMAIL", "user@fs.com"),
  incubatorBaseUrl: opt("INCUBATOR_BASE_URL", "http://localhost:3001"),
  xsuaaUrl: opt("XSUAA_URL", ""),
  xsuaaClientId: opt("XSUAA_CLIENT_ID", ""),
  xsuaaClientSecret: opt("XSUAA_CLIENT_SECRET", ""),
};
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsx -e "import('./src/config.js').then(m => console.log(m.config.port))"
```

Expected output: `3000`

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat: add config module"
```

---

## Task 3: Normalization Layer (TDD)

**Files:**
- Create: `src/incubator/normalize.ts`
- Create: `test/normalize.test.ts`

- [ ] **Step 1: Write the failing tests in `test/normalize.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import {
  resolveStageIndex,
  normalizeIdea,
  normalizeIdeaDetail,
  unwrapODataList,
} from "../src/incubator/normalize.js";

describe("resolveStageIndex", () => {
  it("returns a number input unchanged", () => {
    expect(resolveStageIndex(3)).toBe(3);
  });
  it("maps label to index case-insensitively", () => {
    expect(resolveStageIndex("Prototype")).toBe(3);
    expect(resolveStageIndex("prototype")).toBe(3);
    expect(resolveStageIndex("LIVE")).toBe(6);
  });
  it("returns undefined for an unknown label", () => {
    expect(resolveStageIndex("Bogus")).toBeUndefined();
  });
  it("returns undefined when input is undefined", () => {
    expect(resolveStageIndex(undefined)).toBeUndefined();
  });
});

describe("normalizeIdea", () => {
  it("maps stageIndex to a stage label", () => {
    const r = normalizeIdea({ ID: "1", stageIndex: 3 });
    expect(r.stage).toBe("Prototype");
    expect(r.stageIndex).toBe(3);
  });
  it("accepts both ID (CAP) and id as the key field", () => {
    expect(normalizeIdea({ ID: "abc" }).id).toBe("abc");
    expect(normalizeIdea({ id: "xyz" }).id).toBe("xyz");
  });
  it("coerces live to boolean", () => {
    expect(normalizeIdea({ live: true }).live).toBe(true);
    expect(normalizeIdea({ live: false }).live).toBe(false);
    expect(normalizeIdea({}).live).toBe(false);
  });
  it("uses Unknown for an out-of-range stageIndex", () => {
    expect(normalizeIdea({ stageIndex: 99 }).stage).toBe("Unknown");
  });
});

describe("normalizeIdeaDetail", () => {
  it("includes questionnaire fields when present", () => {
    const r = normalizeIdeaDetail({
      ID: "1",
      stageIndex: 0,
      questionnaire: { useCase: "uc", asIsActions: "aia", toBeEffort: 2, timeReduction: 30, affectedFte: 1 },
      rollouts: [{ customer: "Acme", live: true }],
    });
    expect(r.questionnaire).not.toBeNull();
    expect(r.questionnaire?.timeReduction).toBe(30);
    expect(r.rollouts).toHaveLength(1);
    expect(r.rollouts[0].customer).toBe("Acme");
  });
  it("sets questionnaire to null when absent", () => {
    expect(normalizeIdeaDetail({ ID: "1", stageIndex: 0 }).questionnaire).toBeNull();
  });
  it("defaults rollouts to empty array when absent", () => {
    expect(normalizeIdeaDetail({ ID: "1", stageIndex: 0 }).rollouts).toEqual([]);
  });
});

describe("unwrapODataList", () => {
  it("extracts value array and @odata.count", () => {
    const { items, count } = unwrapODataList({ value: [{ ID: "1" }], "@odata.count": 5 });
    expect(items).toHaveLength(1);
    expect(count).toBe(5);
  });
  it("returns undefined count when @odata.count is absent", () => {
    expect(unwrapODataList({ value: [] }).count).toBeUndefined();
  });
  it("returns empty items when value is absent", () => {
    expect(unwrapODataList({}).items).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- normalize
```

Expected: multiple failures — `normalize.js` not found.

- [ ] **Step 3: Write `src/incubator/normalize.ts`**

```typescript
export const STAGE_LABELS: Record<number, string> = {
  0: "Idea",
  1: "Nominated",
  2: "Scoping",
  3: "Prototype",
  4: "Piloting",
  5: "Scaling",
  6: "Live",
};

const LABEL_TO_INDEX: Record<string, number> = Object.fromEntries(
  Object.entries(STAGE_LABELS).map(([k, v]) => [v.toLowerCase(), Number(k)])
);

export function resolveStageIndex(stage: number | string | undefined): number | undefined {
  if (stage === undefined) return undefined;
  if (typeof stage === "number") return stage;
  return LABEL_TO_INDEX[stage.toLowerCase()];
}

export interface NormalizedIdea {
  id: string;
  agentName: string;
  shortDescription: string;
  stage: string;
  stageIndex: number;
  live: boolean;
  businessArea: string;
  valueType: string;
  ownerName: string;
  ownerEmail: string;
  customer: string;
}

export interface NormalizedIdeaDetail extends NormalizedIdea {
  ideaDescription: string;
  assessorName: string;
  views: number;
  questionnaire: {
    useCase: string;
    asIsActions: string;
    toBeEffort: number;
    timeReduction: number;
    affectedFte: number;
  } | null;
  rollouts: Array<{ customer: string; live: boolean }>;
}

export interface NormalizedDashboard {
  totalIdeas: number;
  liveIdeas: number;
  byStage: Array<{ stageIndex: number; stage: string; count: number }>;
  totalTeamMembers: number;
}

type Raw = Record<string, unknown>;

export function normalizeIdea(raw: Raw): NormalizedIdea {
  const stageIndex = Number(raw.stageIndex ?? 0);
  return {
    id: String(raw.ID ?? raw.id ?? ""),
    agentName: String(raw.agentName ?? ""),
    shortDescription: String(raw.shortDescription ?? ""),
    stage: STAGE_LABELS[stageIndex] ?? "Unknown",
    stageIndex,
    live: Boolean(raw.live),
    businessArea: String(raw.businessArea ?? ""),
    valueType: String(raw.valueType ?? ""),
    ownerName: String(raw.ownerName ?? ""),
    ownerEmail: String(raw.ownerEmail ?? ""),
    customer: String(raw.customer ?? ""),
  };
}

export function normalizeIdeaDetail(raw: Raw): NormalizedIdeaDetail {
  const base = normalizeIdea(raw);
  const q = raw.questionnaire as Raw | null | undefined;
  const rollouts = (raw.rollouts as Raw[] | undefined) ?? [];
  return {
    ...base,
    ideaDescription: String(raw.ideaDescription ?? ""),
    assessorName: String(raw.assessorName ?? ""),
    views: Number(raw.views ?? 0),
    questionnaire: q
      ? {
          useCase: String(q.useCase ?? ""),
          asIsActions: String(q.asIsActions ?? ""),
          toBeEffort: Number(q.toBeEffort ?? 0),
          timeReduction: Number(q.timeReduction ?? 0),
          affectedFte: Number(q.affectedFte ?? 0),
        }
      : null,
    rollouts: rollouts.map((r) => ({ customer: String(r.customer ?? ""), live: Boolean(r.live) })),
  };
}

export function unwrapODataList(body: Raw): { items: Raw[]; count: number | undefined } {
  const items = (body.value as Raw[]) ?? [];
  const count = body["@odata.count"] !== undefined ? Number(body["@odata.count"]) : undefined;
  return { items, count };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- normalize
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/incubator/normalize.ts test/normalize.test.ts
git commit -m "feat: add normalization layer with tests"
```

---

## Task 4: Mock Server Fixtures

**Files:**
- Create: `mock-server/fixtures/ideas.ts`

- [ ] **Step 1: Write `mock-server/fixtures/ideas.ts`**

```typescript
export interface RawIdea {
  ID: string;
  agentName: string;
  shortDescription: string;
  ideaDescription: string;
  businessArea: string;
  valueType: "customer" | "internal";
  customer: string;
  ownerName: string;
  ownerEmail: string;
  assessorName: string;
  stageIndex: number;
  live: boolean;
  views: number;
}

export const ideasFixtures: RawIdea[] = [
  {
    ID: "idea-001",
    agentName: "HR Onboarding Agent",
    shortDescription: "Automates new employee onboarding workflows",
    ideaDescription: "A comprehensive agent that guides new employees through all onboarding steps including document collection, system access provisioning, and buddy assignment.",
    businessArea: "HR",
    valueType: "internal",
    customer: "",
    ownerName: "Alice Müller",
    ownerEmail: "alice.mueller@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 0,
    live: false,
    views: 45,
  },
  {
    ID: "idea-002",
    agentName: "Invoice Processing Agent",
    shortDescription: "Automates AP invoice matching and approval routing",
    ideaDescription: "Leverages LLM to extract invoice data, match against purchase orders, and route to the right approver automatically.",
    businessArea: "Finance",
    valueType: "internal",
    customer: "",
    ownerName: "Bob Chen",
    ownerEmail: "bob.chen@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 1,
    live: false,
    views: 82,
  },
  {
    ID: "idea-003",
    agentName: "Customer Inquiry Agent",
    shortDescription: "Handles first-line customer support queries via chat",
    ideaDescription: "Routes incoming customer questions, fetches account data, and provides answers without human intervention for the top 80% of query types.",
    businessArea: "CX",
    valueType: "customer",
    customer: "Acme Corp",
    ownerName: "Carol Schmidt",
    ownerEmail: "carol.schmidt@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 2,
    live: false,
    views: 134,
  },
  {
    ID: "idea-004",
    agentName: "Contract Review Agent",
    shortDescription: "Flags non-standard clauses in supplier contracts",
    ideaDescription: "Reads uploaded contract PDFs, compares against standard templates, and highlights deviations requiring legal review.",
    businessArea: "Legal",
    valueType: "internal",
    customer: "",
    ownerName: "David Park",
    ownerEmail: "david.park@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 3,
    live: false,
    views: 97,
  },
  {
    ID: "idea-005",
    agentName: "Sales Pipeline Agent",
    shortDescription: "Summarises CRM activity and suggests next actions",
    ideaDescription: "Reads Salesforce data daily, generates a personalised briefing for each account executive, and proposes follow-up actions.",
    businessArea: "Sales",
    valueType: "customer",
    customer: "Beta GmbH",
    ownerName: "Eva Hoffmann",
    ownerEmail: "eva.hoffmann@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 3,
    live: false,
    views: 211,
  },
  {
    ID: "idea-006",
    agentName: "IT Ticket Triage Agent",
    shortDescription: "Categorises and prioritises incoming IT support tickets",
    ideaDescription: "Reads incoming service desk tickets, assigns priority and category, and routes to the correct resolver group without manual intervention.",
    businessArea: "IT",
    valueType: "internal",
    customer: "",
    ownerName: "Frank Weber",
    ownerEmail: "frank.weber@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 4,
    live: false,
    views: 178,
  },
  {
    ID: "idea-007",
    agentName: "Procurement Spend Agent",
    shortDescription: "Analyses procurement data and identifies savings opportunities",
    ideaDescription: "Aggregates procurement transactions, detects maverick spend, and surfaces consolidation opportunities across supplier categories.",
    businessArea: "Procurement",
    valueType: "internal",
    customer: "",
    ownerName: "Grace Kim",
    ownerEmail: "grace.kim@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 4,
    live: false,
    views: 156,
  },
  {
    ID: "idea-008",
    agentName: "Employee Feedback Agent",
    shortDescription: "Synthesises pulse survey results into team-level insights",
    ideaDescription: "Collects anonymous pulse survey responses, clusters themes using NLP, and delivers manager-level insight reports.",
    businessArea: "HR",
    valueType: "internal",
    customer: "",
    ownerName: "Hans Becker",
    ownerEmail: "hans.becker@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 5,
    live: false,
    views: 203,
  },
  {
    ID: "idea-009",
    agentName: "Compliance Monitoring Agent",
    shortDescription: "Monitors transactions for regulatory compliance breaches",
    ideaDescription: "Runs automated compliance checks on financial transactions against current regulatory rules and flags violations in real time.",
    businessArea: "Finance",
    valueType: "customer",
    customer: "Acme Corp",
    ownerName: "Iris Lehmann",
    ownerEmail: "iris.lehmann@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 5,
    live: false,
    views: 289,
  },
  {
    ID: "idea-010",
    agentName: "Meeting Summary Agent",
    shortDescription: "Transcribes and summarises meetings with action items",
    ideaDescription: "Joins scheduled meetings, transcribes audio, produces a structured summary with owners and due dates, and posts to the team channel.",
    businessArea: "Productivity",
    valueType: "internal",
    customer: "",
    ownerName: "Jan Fischer",
    ownerEmail: "jan.fischer@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 6,
    live: true,
    views: 412,
  },
  {
    ID: "idea-011",
    agentName: "Customer Churn Agent",
    shortDescription: "Predicts at-risk customers and triggers retention workflows",
    ideaDescription: "Scores customers by churn risk weekly, triggers personalised outreach via CRM, and measures retention campaign effectiveness.",
    businessArea: "CX",
    valueType: "customer",
    customer: "Beta GmbH",
    ownerName: "Klaus Braun",
    ownerEmail: "klaus.braun@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 6,
    live: true,
    views: 334,
  },
  {
    ID: "idea-012",
    agentName: "Inventory Forecast Agent",
    shortDescription: "Predicts stock shortages and recommends reorder quantities",
    ideaDescription: "Analyses sales velocity, seasonal patterns, and lead times to recommend optimal reorder points per SKU.",
    businessArea: "Supply Chain",
    valueType: "internal",
    customer: "",
    ownerName: "Laura Vogel",
    ownerEmail: "laura.vogel@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 6,
    live: true,
    views: 267,
  },
  {
    ID: "idea-013",
    agentName: "Knowledge Base Agent",
    shortDescription: "Answers employee questions from internal wikis and docs",
    ideaDescription: "Provides a conversational interface to internal knowledge bases, retrieves relevant articles, and escalates when confidence is low.",
    businessArea: "IT",
    valueType: "internal",
    customer: "",
    ownerName: "Max Richter",
    ownerEmail: "max.richter@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 1,
    live: false,
    views: 91,
  },
  {
    ID: "idea-014",
    agentName: "Vendor Risk Agent",
    shortDescription: "Scores supplier risk using public and internal data",
    ideaDescription: "Aggregates news feeds, financial reports, and internal quality data to produce a monthly supplier risk score and alert.",
    businessArea: "Procurement",
    valueType: "internal",
    customer: "",
    ownerName: "Nina Koch",
    ownerEmail: "nina.koch@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 2,
    live: false,
    views: 118,
  },
  {
    ID: "idea-015",
    agentName: "Expense Anomaly Agent",
    shortDescription: "Detects unusual expense claims for audit review",
    ideaDescription: "Scans submitted expense reports for outliers — amounts, vendor types, submission timing — and flags suspicious claims for finance review.",
    businessArea: "Finance",
    valueType: "internal",
    customer: "",
    ownerName: "Otto Wagner",
    ownerEmail: "otto.wagner@fs.com",
    assessorName: "Boss Smith",
    stageIndex: 0,
    live: false,
    views: 63,
  },
];

export const questionnaireFixtures: Record<string, object> = {
  "idea-004": {
    useCase: "Legal team reviews 50+ contracts per month. Manual review takes 4 hours per contract.",
    asIsActions: "Lawyer reads PDF, compares to template, marks deviations, writes risk memo.",
    toBeEffort: 0.5,
    timeReduction: 87,
    affectedFte: 3,
  },
  "idea-010": {
    useCase: "Each meeting produces a summary that currently takes 30 min to write manually.",
    asIsActions: "Attendee writes notes, formats action items, emails team.",
    toBeEffort: 0.05,
    timeReduction: 90,
    affectedFte: 12,
  },
};

export const rolloutFixtures: Record<string, Array<{ customer: string; live: boolean }>> = {
  "idea-011": [
    { customer: "Beta GmbH", live: true },
    { customer: "Delta AG", live: false },
  ],
  "idea-009": [
    { customer: "Acme Corp", live: true },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add mock-server/fixtures/ideas.ts
git commit -m "feat: add mock server fixtures (15 ideas across all stages)"
```

---

## Task 5: Mock Server

**Files:**
- Create: `mock-server/index.ts`

- [ ] **Step 1: Write `mock-server/index.ts`**

```typescript
import express from "express";
import {
  ideasFixtures,
  questionnaireFixtures,
  rolloutFixtures,
  type RawIdea,
} from "./fixtures/ideas.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "mock-incubator" }));

app.get("/api/console/Ideas", (req, res) => {
  let ideas: RawIdea[] = [...ideasFixtures];

  const filter = req.query["$filter"] as string | undefined;
  if (filter) {
    const stageMatch = filter.match(/stageIndex eq (\d+)/);
    if (stageMatch) ideas = ideas.filter((i) => i.stageIndex === Number(stageMatch[1]));

    const liveMatch = filter.match(/live eq (true|false)/);
    if (liveMatch) ideas = ideas.filter((i) => i.live === (liveMatch[1] === "true"));

    const areaMatch = filter.match(/businessArea eq '([^']+)'/);
    if (areaMatch) ideas = ideas.filter((i) => i.businessArea === areaMatch[1]);

    const typeMatch = filter.match(/valueType eq '([^']+)'/);
    if (typeMatch) ideas = ideas.filter((i) => i.valueType === typeMatch[1]);

    const ownerMatch = filter.match(/ownerEmail eq '([^']+)'/);
    if (ownerMatch) ideas = ideas.filter((i) => i.ownerEmail === ownerMatch[1]);

    const customerMatch = filter.match(/customer eq '([^']+)'/);
    if (customerMatch) ideas = ideas.filter((i) => i.customer === customerMatch[1]);

    const containsMatch = filter.match(/contains\(agentName,'([^']*)'\)/);
    if (containsMatch) {
      const q = containsMatch[1].toLowerCase();
      ideas = ideas.filter(
        (i) =>
          i.agentName.toLowerCase().includes(q) ||
          i.shortDescription.toLowerCase().includes(q)
      );
    }
  }

  const total = ideas.length;
  const top = req.query["$top"] ? Number(req.query["$top"]) : 20;
  const skip = req.query["$skip"] ? Number(req.query["$skip"]) : 0;
  const withCount = req.query["$count"] === "true";

  const body: Record<string, unknown> = {
    "@odata.context": "$metadata#Ideas",
    value: ideas.slice(skip, skip + top),
  };
  if (withCount) body["@odata.count"] = total;
  res.json(body);
});

// OData single-entity: /api/console/Ideas(idea-001)
app.get(/^\/api\/console\/Ideas\(([^)]+)\)$/, (req, res) => {
  const raw = (req as express.Request & { params: Record<string, string> }).params[0];
  const id = raw.replace(/^'|'$/g, ""); // strip surrounding quotes if present
  const idea = ideasFixtures.find((i) => i.ID === id);
  if (!idea) {
    res.status(404).json({ error: { code: "404", message: `Idea '${id}' not found` } });
    return;
  }
  res.json({
    "@odata.context": "$metadata#Ideas/$entity",
    ...idea,
    questionnaire: questionnaireFixtures[id] ?? null,
    rollouts: rolloutFixtures[id] ?? [],
  });
});

app.get("/api/console/getDashboard()", (_req, res) => {
  const total = ideasFixtures.length;
  const live = ideasFixtures.filter((i) => i.live).length;
  const stageCounts: Record<number, number> = {};
  for (const idea of ideasFixtures) {
    stageCounts[idea.stageIndex] = (stageCounts[idea.stageIndex] ?? 0) + 1;
  }
  res.json({ total, live, stageCounts });
});

const port = Number(process.env.MOCK_PORT ?? 3001);
app.listen(port, () => console.log(`Mock Incubator API on :${port}`));

export { app };
```

- [ ] **Step 2: Start the mock server to verify it works**

```bash
npm run mock-server
```

Expected: `Mock Incubator API on :3001`

- [ ] **Step 3: Smoke test the endpoints**

```bash
curl http://localhost:3001/health
# {"status":"ok","service":"mock-incubator"}

curl "http://localhost:3001/api/console/Ideas?\$top=3&\$count=true"
# {"@odata.context":"$metadata#Ideas","@odata.count":15,"value":[...3 ideas...]}

curl "http://localhost:3001/api/console/Ideas(idea-010)"
# {"@odata.context":"$metadata#Ideas/$entity","ID":"idea-010",...}

curl "http://localhost:3001/api/console/getDashboard()"
# {"total":15,"live":3,"stageCounts":{...}}
```

Stop the server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add mock-server/index.ts
git commit -m "feat: add mock Incubator OData server"
```

---

## Task 6: Auth Module

**Files:**
- Create: `src/auth/tokenExchange.ts`

- [ ] **Step 1: Write `src/auth/tokenExchange.ts`**

```typescript
import { config } from "../config.js";

export async function exchangeToken(incomingToken: string): Promise<string> {
  if (config.authMode === "mock") {
    return "mock-token";
  }
  // XSUAA token exchange requires credentials from the BTP/CF owner.
  // See spec Section 5 (auth options) and Section 6 (what BTP owner must provide).
  // Implement Option 1 (OAuth2 JWT bearer exchange) or Option 2 (client credentials
  // + X-Act-As header) once XSUAA_URL, XSUAA_CLIENT_ID, and XSUAA_CLIENT_SECRET
  // are available.
  throw new Error(
    "XSUAA token exchange is not configured. " +
      "Set AUTH_MODE=mock for local development, or provide " +
      "XSUAA_URL / XSUAA_CLIENT_ID / XSUAA_CLIENT_SECRET for production."
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/auth/tokenExchange.ts
git commit -m "feat: add auth module (mock mode; XSUAA stub for later)"
```

---

## Task 7: Incubator HTTP Client

**Files:**
- Create: `src/incubator/client.ts`

- [ ] **Step 1: Write `src/incubator/client.ts`**

```typescript
type Raw = Record<string, unknown>;

export class IncubatorClient {
  constructor(
    private readonly baseUrl: string,
    private readonly bearerToken: string
  ) {}

  private async get(path: string): Promise<Raw> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(
        `Incubator API ${res.status} ${res.statusText}: ${this.baseUrl}${path}`
      );
    }
    return res.json() as Promise<Raw>;
  }

  async listIdeas(params: {
    filter?: string;
    top?: number;
    skip?: number;
    count?: boolean;
  }): Promise<Raw> {
    const qs = new URLSearchParams();
    if (params.filter) qs.set("$filter", params.filter);
    if (params.top !== undefined) qs.set("$top", String(params.top));
    if (params.skip !== undefined) qs.set("$skip", String(params.skip));
    if (params.count) qs.set("$count", "true");
    const q = qs.toString();
    return this.get(`/api/console/Ideas${q ? `?${q}` : ""}`);
  }

  async getIdea(id: string): Promise<Raw> {
    return this.get(`/api/console/Ideas(${id})?$expand=questionnaire,rollouts`);
  }

  async getDashboard(): Promise<Raw> {
    return this.get("/api/console/getDashboard()");
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/incubator/client.ts
git commit -m "feat: add Incubator OData HTTP client"
```

---

## Task 8: `search_ideas` Tool (TDD)

**Files:**
- Create: `src/tools/searchIdeas.ts`
- Create: `test/tools.test.ts` (initial)

- [ ] **Step 1: Write the failing integration test in `test/tools.test.ts`**

```typescript
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

// Helper to parse tool result text
function parseToolText(result: Awaited<ReturnType<typeof client.callTool>>): unknown {
  const c = result.content[0] as { type: string; text: string };
  return JSON.parse(c.text);
}

// --- search_ideas ---
describe("search_ideas", () => {
  it("returns paginated results with no filters", async () => {
    const data = parseToolText(
      await client.callTool({ name: "search_ideas", arguments: { limit: 5 } })
    ) as { ideas: unknown[]; total: number; hasMore: boolean };
    expect(Array.isArray(data.ideas)).toBe(true);
    expect(data.ideas.length).toBeLessThanOrEqual(5);
    expect(typeof data.total).toBe("number");
    expect(data.total).toBe(15);
    expect(data.hasMore).toBe(true);
  });

  it("filters by stage label", async () => {
    const data = parseToolText(
      await client.callTool({ name: "search_ideas", arguments: { stage: "Prototype" } })
    ) as { ideas: Array<{ stage: string }> };
    expect(data.ideas.length).toBeGreaterThan(0);
    expect(data.ideas.every((i) => i.stage === "Prototype")).toBe(true);
  });

  it("filters by stage index", async () => {
    const data = parseToolText(
      await client.callTool({ name: "search_ideas", arguments: { stage: 3 } })
    ) as { ideas: Array<{ stageIndex: number }> };
    expect(data.ideas.every((i) => i.stageIndex === 3)).toBe(true);
  });

  it("filters liveOnly", async () => {
    const data = parseToolText(
      await client.callTool({ name: "search_ideas", arguments: { liveOnly: true } })
    ) as { ideas: Array<{ live: boolean }> };
    expect(data.ideas.length).toBeGreaterThan(0);
    expect(data.ideas.every((i) => i.live === true)).toBe(true);
  });

  it("paginates correctly", async () => {
    const page1 = parseToolText(
      await client.callTool({ name: "search_ideas", arguments: { limit: 10, offset: 0 } })
    ) as { ideas: Array<{ id: string }> };
    const page2 = parseToolText(
      await client.callTool({ name: "search_ideas", arguments: { limit: 10, offset: 10 } })
    ) as { ideas: Array<{ id: string }> };
    expect(page1.ideas[0].id).not.toBe(page2.ideas[0].id);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails (server not built yet)**

```bash
npm test -- tools
```

Expected: FAIL — `server.ts` not found or MCP endpoint missing.

- [ ] **Step 3: Write `src/tools/searchIdeas.ts`**

```typescript
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
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { ideas, total, limit: params.limit, offset: params.offset, hasMore: params.offset + ideas.length < total },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
```

The server wiring (Task 11) is needed before the integration test passes — continue to Task 9 and 10, then complete Task 11, then run all tests.

- [ ] **Step 4: Commit**

```bash
git add src/tools/searchIdeas.ts test/tools.test.ts
git commit -m "feat: add search_ideas tool and integration test scaffold"
```

---

## Task 9: `get_idea_detail` Tool

**Files:**
- Create: `src/tools/getIdeaDetail.ts`
- Modify: `test/tools.test.ts`

- [ ] **Step 1: Add tests to `test/tools.test.ts`** (append after the search_ideas describe block)

```typescript
// --- get_idea_detail ---
describe("get_idea_detail", () => {
  it("returns full idea with stage label, questionnaire, and rollouts", async () => {
    const data = parseToolText(
      await client.callTool({ name: "get_idea_detail", arguments: { id: "idea-010" } })
    ) as {
      id: string;
      stage: string;
      ideaDescription: string;
      questionnaire: object | null;
      rollouts: unknown[];
    };
    expect(data.id).toBe("idea-010");
    expect(data.stage).toBe("Live");
    expect(typeof data.ideaDescription).toBe("string");
    expect(data.ideaDescription.length).toBeGreaterThan(0);
    expect(data.questionnaire).not.toBeNull();
    expect(Array.isArray(data.rollouts)).toBe(true);
  });

  it("returns null questionnaire for an idea with no questionnaire", async () => {
    const data = parseToolText(
      await client.callTool({ name: "get_idea_detail", arguments: { id: "idea-001" } })
    ) as { questionnaire: null };
    expect(data.questionnaire).toBeNull();
  });

  it("throws for a non-existent idea id", async () => {
    await expect(
      client.callTool({ name: "get_idea_detail", arguments: { id: "does-not-exist" } })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Write `src/tools/getIdeaDetail.ts`**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/getIdeaDetail.ts test/tools.test.ts
git commit -m "feat: add get_idea_detail tool"
```

---

## Task 10: `get_dashboard` Tool

**Files:**
- Create: `src/tools/getDashboard.ts`
- Modify: `test/tools.test.ts`

- [ ] **Step 1: Add tests to `test/tools.test.ts`** (append after the get_idea_detail describe block)

```typescript
// --- get_dashboard ---
describe("get_dashboard", () => {
  it("returns totalIdeas, liveIdeas, byStage array, and totalTeamMembers", async () => {
    const data = parseToolText(
      await client.callTool({ name: "get_dashboard", arguments: {} })
    ) as {
      totalIdeas: number;
      liveIdeas: number;
      byStage: Array<{ stageIndex: number; stage: string; count: number }>;
      totalTeamMembers: number;
    };
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
```

- [ ] **Step 2: Write `src/tools/getDashboard.ts`**

The mock server returns `{ total, live, stageCounts: { "0": n, ... } }`. The real Incubator `getDashboard()` returns "8 KPI counters" whose exact shape must be verified against the live API (see spec §4.3 verification note). This normalize function handles both the mock shape and falls back gracefully.

```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { IncubatorClient } from "../incubator/client.js";
import { STAGE_LABELS, type NormalizedDashboard } from "../incubator/normalize.js";

function normalizeDashboard(raw: Record<string, unknown>): NormalizedDashboard {
  // Mock server shape: { total, live, stageCounts: { "0": n, ... } }
  // Real API shape: verify against live Incubator getDashboard() response.
  // Map whichever fields are present; unknown fields are ignored safely.
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
      const dashboard = normalizeDashboard(raw);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(dashboard, null, 2) }],
      };
    }
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/tools/getDashboard.ts test/tools.test.ts
git commit -m "feat: add get_dashboard tool"
```

---

## Task 11: MCP Server Entry Point

**Files:**
- Create: `src/tools/index.ts`
- Create: `src/server.ts`

- [ ] **Step 1: Write `src/tools/index.ts`**

```typescript
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
```

- [ ] **Step 2: Write `src/server.ts`**

```typescript
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "./config.js";
import { exchangeToken } from "./auth/tokenExchange.js";
import { IncubatorClient } from "./incubator/client.js";
import { buildMcpServer } from "./tools/index.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "incubator-mcp" });
});

app.post("/mcp", async (req, res) => {
  try {
    const incomingToken = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const bearerToken = await exchangeToken(incomingToken);
    const client = new IncubatorClient(config.incubatorBaseUrl, bearerToken);
    const server = buildMcpServer(client);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("finish", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

const port = config.port;
app.listen(port, () => console.log(`incubator-mcp listening on :${port}`));

export { app };
```

- [ ] **Step 3: Start both servers and run all tests**

Terminal 1:
```bash
npm run mock-server
```

Terminal 2 (tests — the test suite starts its own servers on ports 13001/13099):
```bash
npm test
```

Expected: all tests in `normalize.test.ts` and `tools.test.ts` pass.

- [ ] **Step 4: Manual smoke test with MCP Inspector**

```bash
# In a third terminal (mock server and src/server.ts dev must be running)
INCUBATOR_BASE_URL=http://localhost:3001 AUTH_MODE=mock npm run dev
```

```bash
npx @modelcontextprotocol/inspector http://localhost:3000/mcp
```

Open the printed URL in a browser. Verify:
- `get_dashboard` returns `totalIdeas: 15`
- `search_ideas` with `{ "stage": "Prototype" }` returns only stage-3 ideas
- `get_idea_detail` with `{ "id": "idea-010" }` returns the Meeting Summary Agent with questionnaire

- [ ] **Step 5: Commit**

```bash
git add src/tools/index.ts src/server.ts
git commit -m "feat: wire MCP server with all three tools"
```

---

## Task 12: CF Deployment Config

**Files:**
- Create: `manifest.yml`

- [ ] **Step 1: Write `manifest.yml`**

This is a placeholder. Values marked `# TODO: BTP owner` must be filled in once the CF/BTP owner provides the information listed in spec Section 6.

```yaml
---
applications:
  - name: incubator-mcp           # TODO: BTP owner — confirm app name
    memory: 256M
    instances: 1
    buildpacks:
      - nodejs_buildpack
    command: node dist/server.js
    routes:
      - route: incubator-mcp.cfapps.<region>.hana.ondemand.com  # TODO: BTP owner — CF region + route

    env:
      NODE_ENV: production
      AUTH_MODE: xsuaa             # switch from mock to xsuaa for production
      INCUBATOR_BASE_URL: https://agent-factory-console.cfapps.<region>.hana.ondemand.com  # TODO: BTP owner

    services:
      - incubator-mcp-xsuaa        # TODO: BTP owner — XSUAA service instance name
```

> **Note:** Before deploying, implement `src/auth/tokenExchange.ts` (Task 6 stub) using the credentials from the XSUAA service binding. Then run `npm run build` and `cf push`.

- [ ] **Step 2: Commit**

```bash
git add manifest.yml
git commit -m "feat: add CF manifest placeholder (BTP owner input required)"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| Goal / architecture | Tasks 1, 11 |
| `search_ideas` tool | Tasks 8, 3 |
| `get_idea_detail` tool | Tasks 9, 3 |
| `get_dashboard` tool | Tasks 10, 3 |
| Auth mock mode | Task 6 |
| Auth XSUAA stub | Task 6 (stub; production impl deferred pending BTP owner) |
| Local dev / mock server | Tasks 4, 5 |
| Unit tests (normalize) | Task 3 |
| Integration tests (tools) | Tasks 8–11 |
| MCP Inspector manual test | Task 11 |
| CF deployment config | Task 12 |
| Stage label mapping | Tasks 3, 8 |
| OData string injection defence | Task 8 (`escapeOData`) |
| `@odata.count` pagination | Tasks 7, 8 |
| `getDashboard` response shape verification note | Task 10 (handled with dual-shape normalizer) |

No gaps found.

**Placeholder scan:** `manifest.yml` contains intentional `# TODO: BTP owner` comments — these are deferred pending external input, not implementation placeholders.

**Type consistency:** `IncubatorClient` defined in Task 7 is imported by Tasks 8–10. `McpServer` passed into `register*` functions uses the same `@modelcontextprotocol/sdk` import throughout. `NormalizedDashboard` exported from `normalize.ts` (Task 3) is imported in Task 10.
