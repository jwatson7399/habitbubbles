import { describe, it, expect } from "vitest";
import { normalizeHabit, canLogCompletion, archiveHabit, unarchiveHabit } from "./habitSchema.js";
import { creditedCompletions } from "./rhythmModel.js";
import { DAY } from "./habitData.js";

const NOW = 1750000000000;

describe("normalizeHabit", () => {
  it("fills defaults for an empty habit", () => {
    const h = normalizeHabit({}, NOW);
    expect(h.name).toBe("Habit");
    expect(h.importance).toBe(3);
    expect(h.effort).toBe(3);
    expect(h.quota).toBe(1);
    expect(h.periodDays).toBe(1);
    expect(h.archived).toBe(false);
    expect(h.createdAt).toBe(NOW);
    expect(h.anchorAt).toBe(NOW - DAY / 2);
    expect(typeof h.id).toBe("string");
  });

  it("clamps importance and effort to 1-5", () => {
    expect(normalizeHabit({ importance: 99, effort: -4 }, NOW).importance).toBe(5);
    expect(normalizeHabit({ importance: 99, effort: -4 }, NOW).effort).toBe(1);
  });

  it("clamps quota and period to sane whole numbers", () => {
    const h = normalizeHabit({ quota: 0, periodDays: 0 }, NOW);
    expect(h.quota).toBeGreaterThanOrEqual(1);
    expect(h.periodDays).toBeGreaterThanOrEqual(1);
    expect(normalizeHabit({ quota: 2.7, periodDays: 6.2 }, NOW).quota).toBe(3);
    expect(normalizeHabit({ quota: 2.7, periodDays: 6.2 }, NOW).periodDays).toBe(6);
  });

  it("trims the name and falls back when blank", () => {
    expect(normalizeHabit({ name: "  Meditate  " }, NOW).name).toBe("Meditate");
    expect(normalizeHabit({ name: "   " }, NOW).name).toBe("Habit");
  });

  it("preserves an existing anchorAt and createdAt", () => {
    const h = normalizeHabit({ createdAt: 5, anchorAt: 9 }, NOW);
    expect(h.createdAt).toBe(5);
    expect(h.anchorAt).toBe(9);
  });

  it("offsets anchorAt back from createdAt by half a period when absent", () => {
    expect(normalizeHabit({ createdAt: 42 }, NOW).anchorAt).toBe(42 - DAY / 2);
  });

  it("never produces NaN from garbage input", () => {
    const h = normalizeHabit({ quota: "x", periodDays: null, importance: undefined }, NOW);
    for (const v of [h.quota, h.periodDays, h.importance, h.effort, h.anchorAt]) {
      expect(Number.isNaN(v)).toBe(false);
    }
  });

  it("offsets a new habit's anchor by half a period", () => {
    const h = normalizeHabit({ periodDays: 1 }, NOW);
    expect(h.createdAt).toBe(NOW);
    expect(h.anchorAt).toBe(NOW - DAY / 2);
  });

  it("scales the offset with the period length", () => {
    expect(normalizeHabit({ periodDays: 7 }, NOW).anchorAt).toBe(NOW - 3.5 * DAY);
    expect(normalizeHabit({ periodDays: 2 }, NOW).anchorAt).toBe(NOW - DAY);
  });

  it("still honours an explicitly supplied anchorAt", () => {
    expect(normalizeHabit({ periodDays: 1, anchorAt: 42 }, NOW).anchorAt).toBe(42);
  });

  it("credits every day when a habit is performed near its creation time", () => {
    // The residual this offset closes: without it, a habit done within minutes
    // of its own anchor instant straddles the boundary most days.
    const habit = normalizeHabit({ periodDays: 1, quota: 1 }, NOW - 30 * DAY);
    const done = Array.from({ length: 14 }, (_, i) => ({
      habitId: habit.id,
      id: `n${i}`,
      at: NOW - 30 * DAY + i * DAY + (i % 2 ? 5 : -5) * 60000,
    }));
    expect(creditedCompletions(habit, done)).toHaveLength(14);
  });
});

describe("canLogCompletion", () => {
  const habit = normalizeHabit({ anchorAt: NOW - 10 * DAY }, NOW);

  it("accepts a timestamp at or after the anchor", () => {
    expect(canLogCompletion(habit, habit.anchorAt)).toBe(true);
    expect(canLogCompletion(habit, NOW)).toBe(true);
  });

  it("rejects a timestamp before the anchor rather than clamping it", () => {
    expect(canLogCompletion(habit, habit.anchorAt - 1)).toBe(false);
    expect(canLogCompletion(habit, 0)).toBe(false);
  });
});

describe("archiving", () => {
  it("archives without touching history or the anchor", () => {
    const h = normalizeHabit({ anchorAt: NOW - 30 * DAY }, NOW);
    const a = archiveHabit(h);
    expect(a.archived).toBe(true);
    expect(a.anchorAt).toBe(h.anchorAt);
    expect(a.createdAt).toBe(h.createdAt);
  });

  it("unarchiving starts a fresh warm-up with a new anchor", () => {
    const h = archiveHabit(normalizeHabit({ anchorAt: NOW - 90 * DAY }, NOW - 90 * DAY));
    const u = unarchiveHabit(h, NOW);
    expect(u.archived).toBe(false);
    expect(u.anchorAt).toBe(NOW);
    expect(u.createdAt).toBe(h.createdAt);
  });
});
