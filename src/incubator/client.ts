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