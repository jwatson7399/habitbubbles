import { describe, it, expect } from "vitest";
import { periodKey, currentPeriodKey, periodsAgo } from "./habitPeriods.js";
import { DAY } from "./habitData.js";

const ANCHOR = 1750000000000;
const daily = { anchorAt: ANCHOR, periodDays: 1 };
const weekly = { anchorAt: ANCHOR, periodDays: 7 };

describe("habitPeriods", () => {
  it("assigns period 0 to the anchor instant", () => {
    expect(periodKey(daily, ANCHOR)).toBe(0);
  });

  it("increments exactly once per period length", () => {
    expect(periodKey(daily, ANCHOR + DAY)).toBe(1);
    expect(periodKey(daily, ANCHOR + 3 * DAY)).toBe(3);
    expect(periodKey(weekly, ANCHOR + 7 * DAY)).toBe(1);
  });

  it("places a boundary instant in the later period", () => {
    expect(periodKey(daily, ANCHOR + DAY - 1)).toBe(0);
    expect(periodKey(daily, ANCHOR + DAY)).toBe(1);
  });

  it("keeps a completion's period key permanently stable as now advances", () => {
    const completionAt = ANCHOR + 2 * DAY + 3600000;
    const expected = periodKey(daily, completionAt);
    for (let d = 0; d < 60; d++) {
      const later = completionAt + d * DAY + 12345;
      expect(periodKey(daily, completionAt)).toBe(expected);
      expect(later).toBeGreaterThan(completionAt);
    }
  });

  it("advances the current period key at boundaries", () => {
    expect(currentPeriodKey(daily, ANCHOR)).toBe(0);
    expect(currentPeriodKey(daily, ANCHOR + 5 * DAY)).toBe(5);
  });

  it("increases periodsAgo as time passes, while the key itself does not move", () => {
    const completionAt = ANCHOR + DAY;
    expect(periodsAgo(daily, completionAt, ANCHOR + DAY)).toBe(0);
    expect(periodsAgo(daily, completionAt, ANCHOR + 4 * DAY)).toBe(3);
    expect(periodKey(daily, completionAt)).toBe(1);
  });

  it("is unaffected by a daylight-saving transition", () => {
    // 2026-03-08 is the US DST spring-forward date. Absolute-millisecond
    // arithmetic must not notice it.
    const beforeDst = Date.UTC(2026, 2, 7, 12, 0, 0);
    const habit = { anchorAt: beforeDst, periodDays: 1 };
    expect(periodKey(habit, beforeDst + DAY)).toBe(1);
    expect(periodKey(habit, beforeDst + 2 * DAY)).toBe(2);
    expect(periodKey(habit, beforeDst + 3 * DAY)).toBe(3);
  });
});
