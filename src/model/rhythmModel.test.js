import { describe, it, expect } from "vitest";
import { creditedCompletions, attainment, isWarmingUp } from "./rhythmModel.js";
import { DAY } from "./habitData.js";

const NOW = 1750000000000;
const mk = (over, extra = {}) => ({
  id: "h", quota: 1, periodDays: 1, anchorAt: NOW - over * DAY, ...extra,
});
const at = (daysAgo, i = 0) => ({ habitId: "h", id: `c${daysAgo}-${i}`, at: NOW - daysAgo * DAY });

describe("creditedCompletions", () => {
  it("credits one completion for a daily habit tapped seven times in a day", () => {
    const habit = mk(60);
    const taps = Array.from({ length: 7 }, (_, i) => ({
      habitId: "h", id: `t${i}`, at: NOW - i * 3600000,
    }));
    expect(creditedCompletions(habit, taps)).toHaveLength(1);
  });

  it("credits two of three same-day sessions for a 2-per-7 habit", () => {
    const habit = mk(60, { quota: 2, periodDays: 7 });
    const sessions = [at(0, 1), at(0, 2), at(0, 3)];
    expect(creditedCompletions(habit, sessions)).toHaveLength(2);
  });

  it("credits completions in separate periods independently", () => {
    const habit = mk(60);
    expect(creditedCompletions(habit, [at(0), at(2), at(4)])).toHaveLength(3);
  });
});

describe("isWarmingUp", () => {
  it("warms up until one full period has elapsed", () => {
    expect(isWarmingUp(mk(0.5), NOW)).toBe(true);
    expect(isWarmingUp(mk(2), NOW)).toBe(false);
    expect(isWarmingUp(mk(10, { quota: 1, periodDays: 30 }), NOW)).toBe(true);
    expect(isWarmingUp(mk(45, { quota: 1, periodDays: 30 }), NOW)).toBe(false);
  });
});

describe("attainment", () => {
  it("returns null while warming up rather than a flattering 1", () => {
    expect(attainment(mk(0.5), [], NOW)).toBeNull();
  });

  it("does NOT report a never-completed monthly habit as perfect", () => {
    // The expected<1 bug: 1 x 14/30 = 0.47, which a naive guard would treat
    // as "too small to judge" and score 100% forever.
    const monthly = mk(100, { quota: 1, periodDays: 30 });
    expect(attainment(monthly, [], NOW)).toBe(0);
  });

  it("widens the window so expected never falls below quota", () => {
    const monthly = mk(100, { quota: 1, periodDays: 30 });
    // W_h = max(14, 60) = 60 days -> expected 2 -> one completion is half
    expect(attainment(monthly, [at(1)], NOW)).toBeCloseTo(0.5, 5);
  });

  it("scores a daily habit against 14 expected opportunities", () => {
    const habit = mk(60);
    const done = Array.from({ length: 7 }, (_, i) => at(i));
    expect(attainment(habit, done, NOW)).toBeCloseTo(0.5, 5);
  });

  it("scores a 2-per-7 habit against 4 expected opportunities", () => {
    const habit = mk(60, { quota: 2, periodDays: 7 });
    expect(attainment(habit, [at(1, 1), at(3, 2), at(9, 3)], NOW)).toBeCloseTo(0.75, 5);
  });

  it("caps at 1 so extra work never inflates the score", () => {
    const habit = mk(60);
    const done = Array.from({ length: 30 }, (_, i) => at(i * 0.4, i));
    expect(attainment(habit, done, NOW)).toBeLessThanOrEqual(1);
  });

  it("prorates a young habit instead of tanking it", () => {
    const habit = mk(2);
    expect(attainment(habit, [at(0), at(1)], NOW)).toBeCloseTo(1, 5);
  });

  it("reports pressure-1.0 neglect as attainment 0, opposite polarities", () => {
    // Guards against confusing the two directions in later tests: a neglected
    // habit is pressure 1.00 (max urgency) AND attainment 0 (doing badly).
    const habit = mk(60, { quota: 2, periodDays: 7 });
    expect(attainment(habit, [], NOW)).toBe(0);
  });
});
