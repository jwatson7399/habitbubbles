import { DAY } from "./habitData.js";

// Periods are anchored to habit.anchorAt, never to local midnight or a calendar
// week. A user on rotating shifts has no stable week, and a midnight boundary
// would credit a 1am post-shift completion to the wrong day. Anchoring to an
// absolute timestamp also makes every value below immune to DST.

export function periodKey(habit, t) {
  const period = habit.periodDays * DAY;
  if (!(period > 0)) return 0;
  return Math.floor((t - habit.anchorAt) / period);
}

export function currentPeriodKey(habit, now) {
  return periodKey(habit, now);
}

export function periodsAgo(habit, t, now) {
  return currentPeriodKey(habit, now) - periodKey(habit, t);
}
