import { describe, it, expect } from "vitest";
import { defaultData, normalizeData, applyOperation, uid, DAY } from "./habitData.js";

describe("habitData", () => {
  it("DAY is one day in milliseconds", () => {
    expect(DAY).toBe(86400000);
  });

  it("generates distinct ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => uid()));
    expect(ids.size).toBe(200);
  });

  it("normalizes null into a usable default shape", () => {
    const data = normalizeData(null);
    expect(Array.isArray(data.chores)).toBe(true);
    expect(Array.isArray(data.completions)).toBe(true);
    expect(data.settings).toBeTruthy();
  });

  it("is idempotent under repeated normalization", () => {
    const once = normalizeData(defaultData());
    expect(normalizeData(once)).toEqual(once);
  });

  it("replays a completion:add operation idempotently", () => {
    const base = normalizeData(defaultData());
    const op = { id: "op-1", type: "completion:add", completion: { id: "c-1", at: 1000 } };
    const first = applyOperation(base, op);
    const second = applyOperation(first, op);
    expect(second.completions.filter((c) => c.id === "c-1")).toHaveLength(1);
  });

  it("returns the value unchanged for an unknown operation type", () => {
    const base = normalizeData(defaultData());
    expect(applyOperation(base, { id: "op-x", type: "nope:nope" })).toEqual(base);
  });
});
