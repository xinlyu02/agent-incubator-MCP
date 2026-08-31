# Incubator MCP — Design Spec

**Date:** 2026-08-14
**Status:** Approved
**Project:** F&S Agent Incubator MCP (`incubator-mcp`)

---

## 1. Goal

Build a new standalone MCP server that allows Joule Work users to query Agent Incubator data using natural language.

```
Joule Work  →  incubator-mcp (NEW)  →  Existing Incubator API (/api/console/*)
```

The Incubator app itself is **never modified**. The MCP is a pure consumer of its existing OData v4 API.

---

## 2. Existing Incubator — Key Facts

| Property | Value |
|---|---|
| App name | `agent-factory-console` |
| Framework | SAP CAP (Node.js), OData v4 |
| Auth | SAP Approuter + XSUAA (JWT bearer tokens) |
| API base path | `/api/console` |
| Database | SAP HANA (prod), SQLite (dev) |
| Deployment | SAP BTP Cloud Foundry |

### Core entities used by the MCP

| Entity | Key fields |
|---|---|
| `Ideas` | `id`, `agentName`, `shortDescription`, `businessArea`, `valueType`, `customer`, `ideaDescription`, `ownerEmail`, `ownerName`, `stageIndex` (0–6), `live`, `assessorEmail`, `assessorName`, `views` |
| `Questionnaires` | `idea`, `useCase`, `asIsActions`, `toBeEffort`, `timeReduction`, `affectedFte` |
| `Rollouts` | `idea`, `customer`, `live` |

### Stage index → label mapping

| stageIndex | Label |
|---|---|
| 0 | Idea |
| 1 | Nominated |
| 2 | Scoping |
| 3 | Prototype |
| 4 | Piloting |
| 5 | Scaling |
| 6 | Live |

---

## 3. Architecture

### Approach: Normalized MCP (Approach B)

The MCP translates MCP tool calls into OData requests and normalizes responses into clean, LLM-friendly JSON before returning them to Joule Work. It does not pass raw OData envelopes.

**Rationale:** Joule Work passes tool responses to an LLM. Raw OData output (`@odata.context`, `value` arrays, integer stage codes) reduces LLM accuracy. A thin normalization layer (unwrapping envelopes, mapping stage integers to labels) costs little but meaningfully improves response quality.

### System diagram

```
┌──────────────────────────────────────────┐
│  Joule Work                              │
│  (natural language → tool calls)         │
└──────────────────┬───────────────────────┘
                   ↓ HTTPS POST /mcp
                   Authorization: Bearer <Joule Work JWT>
┌──────────────────────────────────────────┐
│  incubator-mcp  (THIS PROJECT)           │
│  Node.js/TypeScript, CF app              │
│                                          │
│  POST /mcp     ← MCP protocol endpoint   │
│  GET  /health  ← Health check            │
│                                          │
│  Tools:                                  │
│    search_ideas                          │
│    get_idea_detail                       │
│    get_dashboard                         │
└──────────────────┬───────────────────────┘
                   ↓ OData v4
                   Authorization: Bearer <exchanged JWT>
┌──────────────────────────────────────────┐
│  Incubator API  (EXISTING, NOT MODIFIED) │
│  /api/console/* via Approuter + XSUAA    │
└──────────────────┬───────────────────────┘
                   ↓
              SAP HANA (prod)
```

### Project structure

```
incubator-mcp/
├── src/
│   ├── server.ts            ← Express app, /mcp and /health endpoints
│   ├── tools/
│   │   ├── searchIdeas.ts   ← Tool definition + handler
│   │   ├── getIdeaDetail.ts
│   │   └── getDashboard.ts
│   ├── incubator/
│   │   ├── client.ts        ← OData HTTP calls, token injection
│   │   └── normalize.ts     ← OData → clean JSON, stage label mapping
│   └── auth/
│       └── tokenExchange.ts ← XSUAA token exchange logic
├── mock-server/
│   ├── index.ts             ← Local fake Incubator API (dev only)
│   └── fixtures/            ← Realistic seed data (15 ideas, all stages)
├── test/
│   ├── normalize.test.ts    ← Unit tests for normalization layer
│   └── tools.test.ts        ← Integration tests using mock server
├── manifest.yml             ← CF push config (needs BTP owner input)
├── package.json
└── tsconfig.json
```

---

## 4. MCP Tools

All tools are **read-only**. No write operations in v1.

### 4.1 `search_ideas`

**Description:** Search and filter agent ideas by stage, business area, value type, owner, keyword, or customer. Supports pagination.

**Use it for:** "Show me all stage-3 ideas", "Find HR automation agents", "Which ideas are live?", "What ideas does Sarah own?"

**Inputs:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | No | Free-text keyword — searches `agentName` and `shortDescription` via OData `$search` or `contains()` filter |
| `stage` | number \| string | No | Stage index (0–6) or label (e.g. "Prototype"); if a label is passed, the MCP converts it to the corresponding index before building the OData filter |
| `businessArea` | string | No | e.g. "HR", "Finance", "CX" |
| `valueType` | "customer" \| "internal" | No | Value type filter |
| `ownerEmail` | string | No | Filter by idea owner's email |
| `customer` | string | No | Filter by customer name |
| `liveOnly` | boolean | No | If true, return only live ideas |
| `limit` | number | No | Max results, default 20, max 100 |
| `offset` | number | No | Pagination offset, default 0 |

**Output:**

```json
{
  "ideas": [
    {
      "id": "uuid",
      "agentName": "HR Onboarding Agent",
      "shortDescription": "Automates new employee onboarding",
      "stage": "Prototype",
      "stageIndex": 3,
      "live": false,
      "businessArea": "HR",
      "valueType": "internal",
      "ownerName": "Jane Smith",
      "ownerEmail": "jane.smith@example.com",
      "customer": "ACME Corp"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}
```

**Incubator API mapping:** `GET /api/console/Ideas?$filter=...&$top=...&$skip=...&$count=true`

---

### 4.2 `get_idea_detail`

**Description:** Get the full profile of a specific agent idea, including its business case questionnaire and customer rollouts.

**Use it for:** "Tell me about the CX Automation idea", "What's the business case for idea X?", "Which customers is idea Y rolled out to?"

**Inputs:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Idea UUID |

**Output:**

```json
{
  "id": "uuid",
  "agentName": "CX Automation Agent",
  "shortDescription": "...",
  "ideaDescription": "Full description text...",
  "stage": "Piloting",
  "stageIndex": 4,
  "live": false,
  "businessArea": "CX",
  "valueType": "customer",
  "ownerName": "John Doe",
  "ownerEmail": "john.doe@example.com",
  "assessorName": "Alice Manager",
  "customer": "ACME Corp",
  "views": 127,
  "questionnaire": {
    "useCase": "...",
    "asIsActions": "...",
    "toBeEffort": 2.5,
    "timeReduction": 40,
    "affectedFte": 3
  },
  "rollouts": [
    { "customer": "ACME Corp", "live": true },
    { "customer": "Beta Co", "live": false }
  ]
}
```

**Incubator API mapping:** `GET /api/console/Ideas(:id)?$expand=questionnaire,rollouts`

---

### 4.3 `get_dashboard`

**Description:** Get aggregate KPI counters for the whole agent incubator.

**Use it for:** "How many ideas do we have?", "How many agents are live?", "Give me the incubator summary", "What's the stage breakdown?"

**Inputs:** None

**Output:**

```json
{
  "totalIdeas": 87,
  "liveIdeas": 12,
  "byStage": [
    { "stageIndex": 0, "stage": "Idea", "count": 23 },
    { "stageIndex": 1, "stage": "Nominated", "count": 18 },
    { "stageIndex": 2, "stage": "Scoping", "count": 14 },
    { "stageIndex": 3, "stage": "Prototype", "count": 11 },
    { "stageIndex": 4, "stage": "Piloting", "count": 9 },
    { "stageIndex": 5, "stage": "Scaling", "count": 7 },
    { "stageIndex": 6, "stage": "Live", "count": 5 }
  ],
  "totalTeamMembers": 34
}
```

**Incubator API mapping:** `GET /api/console/getDashboard()`

> **⚠ Verification needed:** The exact shape of the `getDashboard()` response (the "8 KPI counters") must be confirmed against the live API before implementation. If it does not include per-stage counts, `byStage` will be obtained via a separate `GET /api/console/Ideas?$apply=groupby((stageIndex),aggregate($count as count))` call, or omitted from the output.

---

## 5. Authentication

### Identity passthrough

Each Joule Work user sees only what their Incubator role permits. The MCP forwards a user-scoped JWT to the Incubator API; the Incubator's existing role-based filtering applies automatically (Boss sees all, Contributor sees own team, Guest sees public ideas).

### Token exchange — two options (unresolved, requires BTP owner)

**Option 1 — OAuth2 Token Exchange (Principal Propagation) [Preferred]**

1. MCP receives Joule Work JWT in `Authorization` header
2. MCP calls XSUAA `/oauth/token` with grant type `urn:ietf:params:oauth:grant-type:jwt-bearer`
3. XSUAA returns a user-scoped JWT valid for the Incubator
4. MCP calls Incubator API with this new JWT

Requires: trust configured between Joule Work's XSUAA and Incubator's XSUAA.

**Option 2 — Technical User + X-Act-As Header [Fallback]**

1. MCP uses its own XSUAA client credentials to obtain a technical JWT
2. MCP extracts user email from Joule Work JWT
3. MCP passes email via `X-Act-As` header (Incubator supports this for Admin users)

Requires: MCP technical user email registered in Incubator's `ADMIN_EMAILS` env var.

### Auth configuration (env vars)

| Env var | Values | Description |
|---|---|---|
| `AUTH_MODE` | `mock` \| `xsuaa` | `mock` skips token exchange (local dev only) |
| `MOCK_USER_EMAIL` | any email | Identity injected in mock mode |
| `XSUAA_URL` | URL | XSUAA token endpoint (from service binding) |
| `XSUAA_CLIENT_ID` | string | From XSUAA service binding |
| `XSUAA_CLIENT_SECRET` | string | From XSUAA service binding |
| `INCUBATOR_BASE_URL` | URL | Base URL of Incubator API |

---

## 6. What the BTP/CF Owner Must Provide

1. Incubator CF app internal URL (or route) for service-to-service calls
2. XSUAA service instance binding credentials for the MCP app (client ID + secret + token URL)
3. Decision on Option 1 vs Option 2 token exchange
4. If Option 1: confirmation that Joule Work's XSUAA trusts the Incubator's XSUAA
5. If Option 2: an Admin email registered in Incubator's `ADMIN_EMAILS` env var for the MCP technical user
6. CF space/org details for `manifest.yml` (app name, routes, memory quota)

---

## 7. What You Need from the Joule Work Team

1. How does Joule Work pass the user's JWT to an MCP server? (request header name, token format)
2. How is an MCP server registered in the Joule Work MCP library? (manifest format, URL registration)
3. Does Joule Work require a specific MCP protocol version?

---

## 8. Local Development & Mock Testing

### Running locally

```bash
# Terminal 1: fake Incubator API on :3001
npm run mock-server

# Terminal 2: MCP server on :3000
INCUBATOR_BASE_URL=http://localhost:3001 AUTH_MODE=mock npm run dev

# Terminal 3: MCP Inspector (browser UI)
npx @modelcontextprotocol/inspector http://localhost:3000/mcp
```

### Mock server

A lightweight Express app (~100 lines) in `mock-server/` that:
- Returns realistic fixture JSON matching the real OData schema
- Seeds 15 agent ideas across all 7 stages
- Supports basic `$filter`, `$top`, `$skip` query params
- Requires no auth

### Testing layers

| Layer | What it tests | Tool |
|---|---|---|
| Unit | `normalize.ts` — OData → clean JSON, stage label mapping | Jest/Vitest |
| Integration | Full tool invocations against mock server via MCP protocol | MCP SDK test client |
| Manual | Interactive tool calls in browser | MCP Inspector |

### What can be built without BTP credentials

- ✅ Full MCP server with all 3 tools
- ✅ Normalization layer (stage labels, OData unwrapping)
- ✅ OData query builder (filters, pagination)
- ✅ Mock server with realistic fixture data
- ✅ Unit and integration tests
- ✅ MCP Inspector end-to-end validation
- ⏳ Auth token exchange (needs XSUAA credentials from BTP owner)
- ⏳ `manifest.yml` CF config (needs route/service binding names from BTP owner)
- ⏳ Joule Work registration (needs MCP URL and Joule Work admin access)

---

## 9. Technology Stack

| Concern | Choice | Rationale |
|---|---|---|
| Runtime | Node.js ≥ 20 | Matches Incubator codebase |
| Language | TypeScript | Type safety for OData/MCP schemas |
| MCP SDK | `@modelcontextprotocol/sdk` | Official SDK, remote HTTPS transport |
| HTTP server | Express | Lightweight, CF-compatible |
| HTTP client | `node-fetch` or `undici` | OData calls to Incubator |
| Testing | Vitest | Fast, TypeScript-native |
| Deployment | SAP BTP Cloud Foundry | Same space as Incubator |
