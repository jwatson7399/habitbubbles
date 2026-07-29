import { describe, it, expect } from "vitest";
import {
  habitHistoryFor,
  lastDoneLabel,
  lastDoneDayStatus,
  completionImpact,
} from "./habitHistory.js";
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

  it("provides compact whole-day recency for bubble labels", () => {
    expect(lastDoneDayStatus(comps, "nope", NOW)).toEqual({
      days: null,
      compact: "never",
      spoken: "never done",
    });
    expect(lastDoneDayStatus([{ habitId: "h", at: NOW - 23 * 3600000 }], "h", NOW)).toEqual({
      days: 0,
      compact: "0d",
      spoken: "last done today",
    });
    expect(lastDoneDayStatus(comps, "h", NOW)).toEqual({
      days: 1,
      compact: "1d",
      spoken: "last done 1 day ago",
    });
  });

  it("ignores future and malformed completions when finding the last done day", () => {
    const history = [
      { habitId: "h", at: NOW - 2 * DAY },
      { habitId: "h", at: NOW + DAY },
      { habitId: "h", at: "not a date" },
    ];
    expect(lastDoneDayStatus(history, "h", NOW).compact).toBe("2d");
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
