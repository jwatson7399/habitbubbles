import { DAY } from "./habitData.js";

export const DEFAULT_RHYTHM_WINDOW_DAYS = 14;

// A habit is excluded from rhythm until one full period has elapsed. This is an
// age test, not a size test: an earlier draft used `expected < 1`, which made a
// monthly habit (1 x 14/30 = 0.47) permanently report 100%.
export function isWarmingUp(habit, now) {
  const period = habit.periodDays * DAY;
  if (!(period > 0)) return true;
  return now - habit.anchorAt < period;
}

// Only completions representing distinct opportunities earn credit. Walking in
// ascending order, a completion is credited unless `quota` already-credited
// completions fall within the preceding period.
export function creditedCompletions(habit, completions) {
  const period = habit.periodDays * DAY;
  if (!(period > 0) || !(habit.quota > 0)) return [];

  const sorted = (completions || [])
    .filter((c) => c.habitId === habit.id)
    .slice()
    .sort((a, b) => a.at - b.at);

  const credited = [];
  for (const c of sorted) {
    const recent = credited.filter((k) => c.at - k.at < period).length;
    if (recent < habit.quota) credited.push(c);
  }
  return credited;
}

export function attainment(habit, completions, now, windowDays = DEFAULT_RHYTHM_WINDOW_DAYS) {
  if (isWarmingUp(habit, now)) return null;

  const period = habit.periodDays * DAY;
  const windowMs = Math.max(windowDays * DAY, 2 * period);
  const effectiveW = Math.min(windowMs, now - habit.anchorAt);
  const expected = habit.quota * (effectiveW / period);
  if (!(expected > 0)) return null;

  const from = now - effectiveW;
  const credited = creditedCompletions(habit, completions).filter(
    (c) => c.at >= from && c.at <= now
  ).length;

  return Math.min(1, credited / expected);
}
