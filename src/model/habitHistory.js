import { creditedCompletions } from "./rhythmModel.js";
import { timeAgo } from "../utils/format.js";

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

// "counted" means this completion earned rhythm credit; "extra" means it was
// over quota for its period — still real, still shown, but not double-counted.
export function completionImpact(habit, completions, entry) {
  const credited = new Set(creditedCompletions(habit, completions).map((c) => c.id));
  return credited.has(entry.id) ? "counted" : "extra";
}
