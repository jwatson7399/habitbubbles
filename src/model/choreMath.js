// Chore-era urgency and health math, inherited from ChoreBubbles Solo.
// Superseded by habitPressure.js / rhythmModel.js; deleted in Stage 5 once
// the screens no longer reference it.
import { DAY } from "./habitData.js";
import { pausedDuration } from "../logModel.js";
import { now } from "../utils/clock.js";

export const activePause = (pauses, scope) => (pauses || []).find((p) => p.scope === scope && p.end == null);

export function lastDone(chore, completions) {
  let t = chore.createdAt || 0;
  for (const c of completions) if (c.choreId === chore.id && c.ts > t) t = c.ts;
  return t;
}

export function activeDaysSinceDone(chore, completions, pauses) {
  const last = lastDone(chore, completions);
  return Math.max(0, (now() - last - pausedDuration(pauses, ["house"], last, now())) / DAY);
}

export function urgencyOf(chore, completions, pauses) {
  return activeDaysSinceDone(chore, completions, pauses) / Math.max(chore.freqDays, 0.25);
}

// Weighted share of chores currently inside their frequency window
export function healthScore(chores, completions, pauses) {
  if (!chores.length) return 1;
  let num = 0, den = 0;
  for (const ch of chores) {
    const u = urgencyOf(ch, completions, pauses);
    const s = Math.max(0, Math.min(2 - u, 1));
    num += s * ch.importance;
    den += ch.importance;
  }
  return den ? num / den : 1;
}
