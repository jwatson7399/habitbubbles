import { describe, it, expect } from "vitest";
import {
  creditedCompletions,
  attainment,
  isWarmingUp,
  rhythmScore,
  rhythmZone,
  quotaStreak,
} from "./rhythmModel.js";
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
      habitId: "h", id: `t${i}`, at: NOW - (i + 1) * 3600000,
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

  it("credits both days when a daily habit drifts earlier (the anchored-period bug)", () => {
    const habit = { id: "h", quota: 1, periodDays: 1, anchorAt: NOW - 30 * DAY };
    const evening = [
      { habitId: "h", id: "d8", at: habit.anchorAt + 8 * DAY + 21.6 * 3600000 },
      { habitId: "h", id: "d9", at: habit.anchorAt + 9 * DAY + 20.4 * 3600000 },
    ];
    expect(creditedCompletions(habit, evening).map((c) => c.id)).toEqual(["d8", "d9"]);
  });

  it("credits every day of a perfect fortnight despite time-of-day jitter", () => {
    const habit = { id: "h", quota: 1, periodDays: 1, anchorAt: NOW - 30 * DAY };
    const offsets = [20.9, 18.4, 21.7, 19.2, 20.1, 18.8, 21.9, 19.6, 20.4, 18.1, 21.2, 19.9, 20.7, 18.3];
    const done = offsets.map((h, i) => ({
      habitId: "h",
      id: `j${i}`,
      at: habit.anchorAt + i * DAY + h * 3600000,
    }));
    expect(creditedCompletions(habit, done)).toHaveLength(14);
  });

  it("still caps a burst inside one period", () => {
    const habit = { id: "h", quota: 1, periodDays: 1, anchorAt: NOW - 30 * DAY };
    const burst = Array.from({ length: 7 }, (_, i) => ({
      habitId: "h",
      id: `b${i}`,
      at: habit.anchorAt + 3 * DAY + (8 + i) * 3600000,
    }));
    expect(creditedCompletions(habit, burst)).toHaveLength(1);
  });
});

describe("isWarmingUp", () => {
  it("warms up until one full period has elapsed", () => {
    expect(isWarmingUp(mk(0.5), NOW)).toBe(true);
    expect(isWarmingUp(mk(2), NOW)).toBe(false);
    expect(isWarmingUp(mk(10, { quota: 1, periodDays: 30 }), NOW)).toBe(true);
    expect(isWarmingUp(mk(45, { quota: 1, periodDays: 30 }), NOW)).toBe(false);
  });

  it("warms up for a full period measured from createdAt, not the offset anchor", () => {
    const period = 60;
    const created = NOW - 40 * DAY;
    const habit = { id: "h", quota: 1, periodDays: period, createdAt: created, anchorAt: created - (period * DAY) / 2 };
    expect(isWarmingUp(habit, NOW)).toBe(true);
    expect(isWarmingUp(habit, created + period * DAY + 1)).toBe(false);
  });

  it("falls back to anchorAt when createdAt is absent", () => {
    expect(isWarmingUp({ id: "h", quota: 1, periodDays: 1, anchorAt: NOW - 2 * DAY }, NOW)).toBe(false);
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

describe("rhythmScore", () => {
  const seven = [
    { id: "med", quota: 1, periodDays: 1, anchorAt: NOW - 60 * DAY },
    { id: "readA", quota: 1, periodDays: 1, anchorAt: NOW - 60 * DAY },
    { id: "readB", quota: 1, periodDays: 1, anchorAt: NOW - 60 * DAY },
    { id: "journal", quota: 1, periodDays: 1, anchorAt: NOW - 60 * DAY },
    { id: "lift", quota: 1, periodDays: 2, anchorAt: NOW - 60 * DAY },
    { id: "bjj", quota: 2, periodDays: 7, anchorAt: NOW - 60 * DAY },
    { id: "cardio", quota: 2, periodDays: 7, anchorAt: NOW - 60 * DAY },
  ];

  const perfect = () => {
    const out = [];
    for (const h of seven) {
      const opportunities = Math.ceil((14 / h.periodDays) * h.quota);
      for (let i = 0; i < opportunities; i++) {
        out.push({ habitId: h.id, id: `${h.id}-${i}`, at: NOW - i * h.periodDays * DAY / h.quota });
      }
    }
    return out;
  };

  it("is 1 when every habit meets expectation", () => {
    expect(rhythmScore(seven, perfect(), NOW)).toBeCloseTo(1, 2);
  });

  it("costs 1/7th when one twice-weekly habit is blank, not 5.6%", () => {
    const withoutBjj = perfect().filter((c) => c.habitId !== "bjj");
    const score = rhythmScore(seven, withoutBjj, NOW);
    expect(1 - score).toBeCloseTo(1 / 7, 2);
    expect(1 - score).toBeGreaterThan(0.1);
  });

  it("weights a blank daily habit exactly like a blank twice-weekly habit", () => {
    const noBjj = rhythmScore(seven, perfect().filter((c) => c.habitId !== "bjj"), NOW);
    const noMed = rhythmScore(seven, perfect().filter((c) => c.habitId !== "med"), NOW);
    expect(noBjj).toBeCloseTo(noMed, 5);
  });

  it("excludes archived habits from the denominator", () => {
    const habits = seven.map((h) => (h.id === "bjj" ? { ...h, archived: true } : h));
    const withoutBjj = perfect().filter((c) => c.habitId !== "bjj");
    expect(rhythmScore(habits, withoutBjj, NOW)).toBeCloseTo(1, 2);
  });

  it("excludes warming-up habits from the denominator", () => {
    const fresh = { id: "new", quota: 1, periodDays: 1, anchorAt: NOW - DAY / 2 };
    expect(rhythmScore([...seven, fresh], perfect(), NOW)).toBeCloseTo(1, 2);
  });

  it("returns null when nothing is scorable", () => {
    expect(rhythmScore([], [], NOW)).toBeNull();
  });
});

describe("rhythmZone", () => {
  it("uses the exact encouraging labels", () => {
    expect(rhythmZone(0.1).label).toBe("Getting started ⚠️");
    expect(rhythmZone(0.5).label).toBe("Maintaining 👍");
    expect(rhythmZone(0.9).label).toBe("On top of it! 👌");
  });

  it("places boundaries inclusively at the lower edge", () => {
    expect(rhythmZone(0.4).key).toBe("amber");
    expect(rhythmZone(0.8).key).toBe("green");
    expect(rhythmZone(0.39999).key).toBe("red");
  });

  it("honours a configured green threshold", () => {
    expect(rhythmZone(0.7, 0.65).key).toBe("green");
    expect(rhythmZone(0.7, 0.9).key).toBe("amber");
  });

  it("keeps over-goal green", () => {
    expect(rhythmZone(1).key).toBe("green");
  });

  it("exposes the emoji separately from the label", () => {
    expect(rhythmZone(0.9).emoji).toBe("👌");
    expect(rhythmZone(0.5).emoji).toBe("👍");
    expect(rhythmZone(0.1).emoji).toBe("⚠️");
  });
});

describe("quotaStreak", () => {
  const daily = { id: "h", quota: 1, periodDays: 1, anchorAt: NOW - 30 * DAY };
  const weekly = { id: "h", quota: 2, periodDays: 7, anchorAt: NOW - 70 * DAY };

  it("is 0 with no completions", () => {
    expect(quotaStreak(daily, [], NOW)).toBe(0);
  });

  it("counts consecutive met periods", () => {
    expect(quotaStreak(daily, [at(0), at(1), at(2)], NOW)).toBe(3);
  });

  it("does not break on an unmet in-progress period", () => {
    // Yesterday and the day before were met; today is not done yet.
    expect(quotaStreak(daily, [at(1), at(2), at(3)], NOW)).toBe(3);
  });

  it("extends when the in-progress period is met", () => {
    expect(quotaStreak(daily, [at(0), at(1), at(2), at(3)], NOW)).toBe(4);
  });

  it("breaks on a closed unmet period", () => {
    // Gap at 2 days ago.
    expect(quotaStreak(daily, [at(0), at(1), at(3), at(4)], NOW)).toBe(2);
  });

  it("requires the full quota within a period", () => {
    const oneOfTwo = [{ habitId: "h", id: "a", at: NOW - DAY }];
    expect(quotaStreak(weekly, oneOfTwo, NOW)).toBe(0);
  });

  it("counts a multi-quota period once when quota is met", () => {
    const met = [
      { habitId: "h", id: "a", at: NOW - DAY },
      { habitId: "h", id: "b", at: NOW - 2 * DAY },
      { habitId: "h", id: "c", at: NOW - 8 * DAY },
      { habitId: "h", id: "d", at: NOW - 9 * DAY },
    ];
    expect(quotaStreak(weekly, met, NOW)).toBe(2);
  });
});
