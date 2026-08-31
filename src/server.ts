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

async function handleMcp(req: express.Request, res: express.Response): Promise<void> {
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
}

app.post("/mcp", handleMcp);
app.get("/mcp", handleMcp);

app.listen(config.port, () => console.log(`incubator-mcp listening on :${config.port}`));

export { app };