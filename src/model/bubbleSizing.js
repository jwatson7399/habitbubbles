import { habitPressure } from "./habitPressure.js";
import { habitPriority, habitRadii } from "./habitPriority.js";

// One node per active habit. Sizing is absolute — each habit's radius depends
// only on its own state, never on the rest of the field. Field-relative
// normalization (as ChoreBubbles uses) would inflate a near-zero habit to full
// size on a day when everything is done.
export function habitBubbleNodes(habits, completions, now) {
  return (habits || [])
    .filter((h) => !h.archived)
    .map((habit) => {
      const pressure = habitPressure(habit, completions, now);
      const priority = habitPriority({ pressure, importance: habit.importance });
      return { id: habit.id, habit, pressure, priority, ...habitRadii(priority) };
    });
}
