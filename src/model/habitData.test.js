import { describe, it, expect } from "vitest";
import { defaultData, normalizeData, applyOperation, uid, DAY, STARTER_HABITS } from "./habitData.js";

const op = (type, extra) => ({ id: `op-${type}`, type, createdAt: 1, ...extra });

describe("habitData", () => {
  it("DAY is one day in milliseconds", () => {
    expect(DAY).toBe(86400000);
  });

  it("generates distinct ids", () => {
    expect(new Set(Array.from({ length: 200 }, () => uid())).size).toBe(200);
  });

  it("defaults to habits, not chores, with no pause list", () => {
    const d = defaultData();
    expect(Array.isArray(d.habits)).toBe(true);
    expect(d.chores).toBeUndefined();
    expect(d.pauses).toBeUndefined();
    expect(d.settings.rhythmWindowDays).toBe(14);
    expect(d.settings.greenStart).toBe(0.8);
  });

  it("normalizes null into a usable shape", () => {
    const d = normalizeData(null);
    expect(Array.isArray(d.habits)).toBe(true);
    expect(Array.isArray(d.completions)).toBe(true);
  });

  it("is idempotent under repeated normalization", () => {
    const once = normalizeData(defaultData());
    expect(normalizeData(once)).toEqual(once);
  });

  it("drops inherited chore-era fields", () => {
    const d = normalizeData({ chores: [{ id: "c" }], pauses: [{ id: "p" }] });
    expect(d.chores).toBeUndefined();
    expect(d.pauses).toBeUndefined();
    expect(d.habits).toEqual([]);
  });

  it("replays completion:add idempotently", () => {
    const base = normalizeData(defaultData());
    const o = op("completion:add", { completion: { id: "c1", habitId: "h", at: 1000 } });
    expect(applyOperation(applyOperation(base, o), o).completions).toHaveLength(1);
  });

  it("upserts and updates a habit", () => {
    const base = normalizeData(defaultData());
    const added = applyOperation(base, op("habit:upsert", { habit: { id: "h", name: "Read" } }));
    expect(added.habits).toHaveLength(1);
    const updated = applyOperation(added, op("habit:upsert", { habit: { id: "h", name: "Read more" } }));
    expect(updated.habits).toHaveLength(1);
    expect(updated.habits[0].name).toBe("Read more");
  });

  it("deletes a habit and its completions together", () => {
    let d = normalizeData(defaultData());
    d = applyOperation(d, op("habit:upsert", { habit: { id: "h", name: "Read" } }));
    d = applyOperation(d, op("completion:add", { completion: { id: "c1", habitId: "h", at: 1 } }));
    d = applyOperation(d, op("completion:add", { completion: { id: "c2", habitId: "other", at: 1 } }));
    const after = applyOperation(d, op("habit:delete", { habitId: "h" }));
    expect(after.habits).toHaveLength(0);
    expect(after.completions.map((c) => c.id)).toEqual(["c2"]);
  });

  it("removes completions by id", () => {
    let d = normalizeData(defaultData());
    d = applyOperation(d, op("completion:add", { completion: { id: "c1", habitId: "h", at: 1 } }));
    expect(applyOperation(d, op("completion:remove", { ids: ["c1"] })).completions).toHaveLength(0);
  });

  it("ignores unknown operation types", () => {
    const base = normalizeData(defaultData());
    const after = applyOperation(base, op("nope:nope"));
    expect(after.habits).toEqual(base.habits);
    expect(after.completions).toEqual(base.completions);
    expect(after.settings).toEqual(base.settings);
  });

  it("no longer supports two-step operations", () => {
    const base = normalizeData(defaultData());
    const o = op("completion:add-and-advance", { completion: { id: "c1", habitId: "h", at: 1 } });
    const after = applyOperation(base, o);
    expect(after.completions).toEqual([]);
    expect(after.habits).toEqual([]);
  });

  it("ships the owner's seven starter habits", () => {
    expect(STARTER_HABITS).toHaveLength(7);
    const byName = Object.fromEntries(STARTER_HABITS.map((h) => [h.name, h]));
    expect(byName["Meditate"]).toMatchObject({ quota: 1, periodDays: 1 });
    expect(byName["Brazilian jiujitsu"]).toMatchObject({ quota: 2, periodDays: 7 });
    expect(byName["Lift weights"]).toMatchObject({ quota: 1, periodDays: 2 });
    expect(byName["Cardio"]).toMatchObject({ quota: 2, periodDays: 7 });
  });

  it("gives every starter a valid importance and effort", () => {
    for (const h of STARTER_HABITS) {
      expect(h.importance).toBeGreaterThanOrEqual(1);
      expect(h.importance).toBeLessThanOrEqual(5);
      expect(h.effort).toBeGreaterThanOrEqual(1);
      expect(h.effort).toBeLessThanOrEqual(5);
    }
  });
});
