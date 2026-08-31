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
  // Real Incubator API fields (present when connected to actual service)
  liveTarget?: number;
  nominatedCF?: number;
  nominatedIE?: number;
  customersTouched?: number;
  gtmCount?: number;
  activeCount?: number;
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