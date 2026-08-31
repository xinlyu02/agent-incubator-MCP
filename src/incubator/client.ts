import { config } from "../config.js";

type Raw = Record<string, unknown>;

export class IncubatorClient {
  constructor(
    private readonly baseUrl: string,
    private readonly bearerToken: string
  ) {}

  private async get(path: string): Promise<Raw> {
    const authHeader = config.incubatorBasicAuth
      ? `Basic ${Buffer.from(config.incubatorBasicAuth).toString("base64")}`
      : `Bearer ${this.bearerToken}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: authHeader, Accept: "application/json" },
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
    const parts: string[] = [];
    if (params.filter) parts.push(`$filter=${encodeURIComponent(params.filter)}`);
    if (params.top !== undefined) parts.push(`$top=${params.top}`);
    if (params.skip !== undefined) parts.push(`$skip=${params.skip}`);
    if (params.count) parts.push(`$count=true`);
    const q = parts.join("&");
    return this.get(`/api/console/Ideas${q ? `?${q}` : ""}`);
  }

  async getIdea(id: string): Promise<Raw> {
    return this.get(`/api/console/Ideas(${id})?$expand=questionnaire,rollouts`);
  }

  async getDashboard(): Promise<Raw> {
    return this.get("/api/console/getDashboard()");
  }
}