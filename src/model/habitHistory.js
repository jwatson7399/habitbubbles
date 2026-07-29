import { creditedCompletions } from "./rhythmModel.js";
import { timeAgo } from "../utils/format.js";
import { DAY } from "./habitData.js";

export function habitHistoryFor(completions, habitId) {
  return (completions || [])
    .filter((c) => c.habitId === habitId)
    .slice()
    .sort((a, b) => b.at - a.at);
}

export function lastDoneLabel(entry, now) {
  if (!entry) return "○ never";
  return `✓ ${timeAgo(entry.at, now)}`;
}

// A compact, stable readout for the bubble face. Whole elapsed days match the
// app's rolling-period model: a completion less than 24 hours old is "today",
// then the count advances once per full day.
export function lastDoneDayStatus(completions, habitId, now) {
  const latest = (completions || []).reduce((mostRecent, entry) => {
    const at = Number(entry?.at);
    if (entry?.habitId !== habitId || !Number.isFinite(at) || at > now) return mostRecent;
    return mostRecent === null || at > mostRecent ? at : mostRecent;
  }, null);

  if (latest === null) {
    return { days: null, compact: "never", spoken: "never done" };
  }

  const days = Math.max(0, Math.floor((now - latest) / DAY));
  if (days === 0) {
    return { days, compact: "0d", spoken: "last done today" };
  }
  return {
    days,
    compact: `${days}d`,
    spoken: `last done ${days} day${days === 1 ? "" : "s"} ago`,
  };
}

// "counted" means this completion earned rhythm credit; "extra" means it was
// over quota for its period — still real, still shown, but not double-counted.
export function completionImpact(habit, completions, entry) {
  const credited = new Set(creditedCompletions(habit, completions).map((c) => c.id));
  return credited.has(entry.id) ? "counted" : "extra";
}
