import { habitPressure } from "./habitPressure.js";
import { habitPriority } from "./habitPriority.js";

// Effort coefficient is deliberately small: it should surface a five-minute
// habit ahead of an hour-long one at similar urgency, never outrank a habit
// that genuinely needs doing. Tuning value, not a derived constant.
export const EFFORT_WEIGHT = 0.15;

export function suggestionScore(habit, pressure) {
  const priority = habitPriority({ pressure, importance: habit.importance });
  const effortPenalty = (EFFORT_WEIGHT * ((Number(habit.effort) || 3) - 1)) / 4;
  return priority - effortPenalty;
}

// Warming-up habits are deliberately INCLUDED. Warm-up exists so a habit is not
// scored before it has had a fair chance — it is not a reason to stop
// recommending one. Excluding them left this feature dead for a new user's
// entire first period, which is exactly when "what should I do now?" is asked.
// Only archived habits are out: the user has said they are not doing those.
export function rankSuggestions(habits, completions, now) {
  return (habits || [])
    .filter((h) => !h.archived)
    .map((h) => ({ habit: h, score: suggestionScore(h, habitPressure(h, completions, now)) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.habit.importance - a.habit.importance ||
        a.habit.anchorAt - b.habit.anchorAt
    )
    .map((entry) => entry.habit);
}
