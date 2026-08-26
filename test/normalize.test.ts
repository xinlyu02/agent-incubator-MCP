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