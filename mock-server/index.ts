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
        (i) => i.agentName.toLowerCase().includes(q) || i.shortDescription.toLowerCase().includes(q)
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
app.get(/^\/api\/console\/Ideas\(([^)]+)\)$/, (req: express.Request, res: express.Response) => {
  const raw = (req.params as Record<string, string>)[0];
  const id = raw.replace(/^'|'$/g, "");
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

app.get(/^\/api\/console\/getDashboard\(\)$/, (_req, res) => {
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