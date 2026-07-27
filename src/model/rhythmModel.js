import { DAY } from "./habitData.js";
import { periodKey, currentPeriodKey } from "./habitPeriods.js";
import { trackingOrigin } from "./habitSchema.js";

export const DEFAULT_RHYTHM_WINDOW_DAYS = 14;

// A habit is excluded from rhythm until one full period has elapsed. This is an
// age test, not a size test: an earlier draft used `expected < 1`, which made a
// monthly habit (1 x 14/30 = 0.47) permanently report 100%.
//
// Warm-up asks whether tracking has run long enough to judge, so it measures
// from trackingOrigin — which restarts when a habit is unarchived, and is not
// pulled backwards by anchorAt's half-period offset.
export function isWarmingUp(habit, now) {
  const period = habit.periodDays * DAY;
  if (!(period > 0)) return true;
  return now - trackingOrigin(habit) < period;
}

// Only completions representing distinct opportunities earn credit. Walking in
// ascending order, a completion is credited unless `quota` already-credited
// completions fall in the SAME anchored period.
//
// This is deliberately per anchored period, not a rolling window: `quotaStreak`
// buckets by the same period keys, and a rolling cap silently disagreed with it.
// A daily habit done at 21:36 and then 20:24 the next day is 22.8h apart — one
// rolling window, but two real periods — and the second completion was being
// dropped, so a perfect fortnight scored 0.64 with a streak of 1.
export function creditedCompletions(habit, completions) {
  const period = habit.periodDays * DAY;
  if (!(period > 0) || !(habit.quota > 0)) return [];

  const sorted = (completions || [])
    .filter((c) => c.habitId === habit.id)
    .slice()
    .sort((a, b) => a.at - b.at);

  const credited = [];
  const perPeriod = new Map();
  for (const c of sorted) {
    const key = periodKey(habit, c.at);
    const used = perPeriod.get(key) || 0;
    if (used < habit.quota) {
      credited.push(c);
      perPeriod.set(key, used + 1);
    }
  }
  return credited;
}

// The raw window figures behind attainment. Exported so the Log screen can show
// `credited / expected` without re-deriving the windowing math — if the two
// disagreed, the screen would contradict the score printed beside it.
// Returns null while warming up, matching attainment().
//
// The window is measured from trackingOrigin, NOT anchorAt. anchorAt sits half a
// period earlier by design (to keep period boundaries away from the hour a habit
// is performed), so windowing from it invents expectation for time before the
// habit existed: a daily habit created and completed once read 67% at warm-up
// exit instead of 100%. Measured across 7 cadences x 10 timing offsets x 7
// evaluation days, moving the origin here is better in 183 cases, identical in
// 246, and worse in none.
export function attainmentStats(habit, completions, now, windowDays = DEFAULT_RHYTHM_WINDOW_DAYS) {
  if (isWarmingUp(habit, now)) return null;

  const period = habit.periodDays * DAY;
  const windowMs = Math.max(windowDays * DAY, 2 * period);
  const effectiveW = Math.min(windowMs, now - trackingOrigin(habit));
  const expected = habit.quota * (effectiveW / period);
  if (!(expected > 0)) return null;

  const from = now - effectiveW;
  const credited = creditedCompletions(habit, completions).filter(
    (c) => c.at >= from && c.at <= now
  ).length;

  return { credited, expected, ratio: credited / expected };
}

export function attainment(habit, completions, now, windowDays = DEFAULT_RHYTHM_WINDOW_DAYS) {
  const stats = attainmentStats(habit, completions, now, windowDays);
  return stats === null ? null : Math.min(1, stats.ratio);
}

export const AMBER_START = 0.4;
export const DEFAULT_GREEN_START = 0.8;

// Each habit contributes equally regardless of cadence. Counting raw
// opportunities instead would give four daily habits 79% of the score and make
// a completely blank fortnight of a twice-weekly habit cost only 5.6%.
export function rhythmScore(habits, completions, now, windowDays = DEFAULT_RHYTHM_WINDOW_DAYS) {
  const scores = (habits || [])
    .filter((h) => !h.archived)
    .map((h) => attainment(h, completions, now, windowDays))
    .filter((v) => v !== null);

  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function rhythmZone(score, greenStart = DEFAULT_GREEN_START) {
  const green = Math.min(1, Math.max(AMBER_START + 0.0001, Number(greenStart) || DEFAULT_GREEN_START));
  const value = Number(score) || 0;
  if (value >= green) return { key: "green", label: "On top of it! 👌", emoji: "👌" };
  if (value >= AMBER_START) return { key: "amber", label: "Maintaining 👍", emoji: "👍" };
  return { key: "red", label: "Getting started ⚠️", emoji: "⚠️" };
}

// A period qualifies if it holds at least `quota` credited completions. The
// in-progress period can only help: if its quota is met it extends the streak,
// and if not it is skipped rather than treated as a failure.
export function quotaStreak(habit, completions, now) {
  const credited = creditedCompletions(habit, completions);
  if (!credited.length) return 0;

  const counts = new Map();
  for (const c of credited) {
    const key = periodKey(habit, c.at);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const met = (key) => (counts.get(key) || 0) >= habit.quota;

  const current = currentPeriodKey(habit, now);
  let streak = 0;
  let key = current;

  if (met(current)) streak += 1;
  key = current - 1;

  while (met(key)) {
    streak += 1;
    key -= 1;
  }

  return streak;
}
