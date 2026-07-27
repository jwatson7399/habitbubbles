import { habitPressure } from "./habitPressure.js";
import { habitPriority } from "./habitPriority.js";
import { isWarmingUp } from "./rhythmModel.js";

// Effort coefficient is deliberately small: it should surface a five-minute
// habit ahead of an hour-long one at similar urgency, never outrank a habit
// that genuinely needs doing. Tuning value, not a derived constant.
export const EFFORT_WEIGHT = 0.15;

export function suggestionScore(habit, pressure) {
  const priority = habitPriority({ pressure, importance: habit.importance });
  const effortPenalty = (EFFORT_WEIGHT * ((Number(habit.effort) || 3) - 1)) / 4;
  return priority - effortPenalty;
}

export function rankSuggestions(habits, completions, now) {
  return (habits || [])
    .filter((h) => !h.archived && !isWarmingUp(h, now))
    .map((h) => ({ habit: h, score: suggestionScore(h, habitPressure(h, completions, now)) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.habit.importance - a.habit.importance ||
        a.habit.anchorAt - b.habit.anchorAt
    )
    .map((entry) => entry.habit);
}
