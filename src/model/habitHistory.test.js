import { describe, it, expect } from "vitest";
import { habitHistoryFor, lastDoneLabel, completionImpact } from "./habitHistory.js";
import { DAY } from "./habitData.js";

const NOW = 1750000000000;

describe("habitHistory", () => {
  const comps = [
    { id: "a", habitId: "h", at: NOW - 3 * DAY },
    { id: "b", habitId: "h", at: NOW - DAY },
    { id: "c", habitId: "other", at: NOW },
  ];

  it("returns only that habit's completions, newest first", () => {
    expect(habitHistoryFor(comps, "h").map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("returns an empty list for an unknown habit", () => {
    expect(habitHistoryFor(comps, "nope")).toEqual([]);
  });

  it("labels a never-done habit", () => {
    expect(lastDoneLabel(undefined, NOW)).toBe("○ never");
  });

  it("labels a recent completion", () => {
    expect(lastDoneLabel({ at: NOW - 2 * 3600000 }, NOW)).toMatch(/^✓ /);
  });

  it("marks quota completions counted and over-quota ones extra", () => {
    const habit = { id: "h", quota: 1, periodDays: 1, anchorAt: NOW - 30 * DAY };
    const taps = [
      { id: "t1", habitId: "h", at: NOW - 5 * 3600000 },
      { id: "t2", habitId: "h", at: NOW - 4 * 3600000 },
    ];
    expect(completionImpact(habit, taps, taps[0])).toBe("counted");
    expect(completionImpact(habit, taps, taps[1])).toBe("extra");
  });
});
