import { describe, it, expect } from "vitest";
import { habitPressure, contributingCompletions } from "./habitPressure.js";
import { DAY } from "./habitData.js";

const NOW = 1750000000000;
const bjj = { id: "bjj", quota: 2, periodDays: 7 };
const meditate = { id: "med", quota: 1, periodDays: 1 };
const lift = { id: "lift", quota: 1, periodDays: 2 };
const at = (habitId, daysAgo) => ({ habitId, at: NOW - daysAgo * DAY });

describe("habitPressure", () => {
  it("is 1.00 with nothing logged", () => {
    expect(habitPressure(bjj, [], NOW)).toBeCloseTo(1, 5);
  });

  it("is 0.50 with one of two slots just filled", () => {
    expect(habitPressure(bjj, [at("bjj", 0)], NOW)).toBeCloseTo(0.5, 5);
  });

  it("is 0.00 with both slots just filled", () => {
    expect(habitPressure(bjj, [at("bjj", 0), at("bjj", 0)], NOW)).toBeCloseTo(0, 5);
  });

  it("regrows as slots drain", () => {
    const three = [at("bjj", 3), at("bjj", 3)];
    const six = [at("bjj", 6), at("bjj", 6)];
    expect(habitPressure(bjj, three, NOW)).toBeCloseTo(0.428571, 5);
    expect(habitPressure(bjj, six, NOW)).toBeCloseTo(0.857143, 5);
  });

  it("reduces to age/P for a single-slot habit", () => {
    expect(habitPressure(meditate, [{ habitId: "med", at: NOW - DAY / 2 }], NOW)).toBeCloseTo(0.5, 5);
    expect(habitPressure(meditate, [at("med", 1)], NOW)).toBeCloseTo(1, 5);
    expect(habitPressure(lift, [at("lift", 1)], NOW)).toBeCloseTo(0.5, 5);
  });

  it("does not let over-quota completions bank relief", () => {
    const two = [at("bjj", 0), at("bjj", 0)];
    const three = [at("bjj", 0), at("bjj", 0), at("bjj", 0)];
    expect(habitPressure(bjj, three, NOW)).toBeCloseTo(habitPressure(bjj, two, NOW), 5);

    // and still identical three days later
    const later = NOW + 3 * DAY;
    expect(habitPressure(bjj, three, later)).toBeCloseTo(habitPressure(bjj, two, later), 5);
    expect(habitPressure(bjj, three, later)).toBeCloseTo(0.428571, 5);
  });

  it("never permanently excludes a completion (no stale exclusion)", () => {
    // Sessions at day 0, day 0 and day 6, evaluated at day 8. The day-6 session
    // must contribute: reusing the historical credit pass would exclude it
    // forever and report 1.00 two days after training.
    const completions = [at("bjj", 8), at("bjj", 8), at("bjj", 2)];
    expect(habitPressure(bjj, completions, NOW)).toBeCloseTo(0.642857, 5);
  });

  it("holds a never-completed habit steady at 1.00", () => {
    for (let d = 0; d < 40; d++) {
      expect(habitPressure(bjj, [], NOW + d * DAY)).toBeCloseTo(1, 5);
    }
  });

  it("ignores completions belonging to other habits", () => {
    expect(habitPressure(bjj, [at("med", 0), at("lift", 0)], NOW)).toBeCloseTo(1, 5);
  });

  it("contributes at most quota completions", () => {
    const many = [at("bjj", 0), at("bjj", 0), at("bjj", 0), at("bjj", 1)];
    expect(contributingCompletions(bjj, many, NOW)).toHaveLength(2);
  });

  it("returns 0 rather than NaN for invalid quota or period", () => {
    expect(habitPressure({ id: "x", quota: 0, periodDays: 7 }, [], NOW)).toBe(0);
    expect(habitPressure({ id: "x", quota: 2, periodDays: 0 }, [], NOW)).toBe(0);
    expect(habitPressure({ id: "x", quota: -1, periodDays: -1 }, [], NOW)).toBe(0);
  });
});
