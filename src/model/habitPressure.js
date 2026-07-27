import { DAY } from "./habitData.js";

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

// Each habit has N slots. A completion fills one, which then drains linearly
// over P days. Only the N most recent in-window completions contribute, so work
// beyond quota banks no future relief.
//
// This selection is deliberately NOT the historical credit pass used by
// rhythmModel: pressure asks which slots are full *right now*, so it must be
// re-evaluated at every moment.

export function contributingCompletions(habit, completions, now) {
  const period = habit.periodDays * DAY;
  if (!(period > 0) || !(habit.quota > 0)) return [];
  return (completions || [])
    .filter((c) => c.habitId === habit.id && c.at <= now && now - c.at < period)
    .sort((a, b) => b.at - a.at)
    .slice(0, habit.quota);
}

export function habitPressure(habit, completions, now) {
  const period = habit.periodDays * DAY;
  if (!(period > 0) || !(habit.quota > 0)) return 0;

  const filled = contributingCompletions(habit, completions, now).reduce(
    (sum, c) => sum + clamp01(1 - (now - c.at) / period),
    0
  );

  return clamp01(1 - filled / habit.quota);
}
