import { uid, DAY } from "./habitData.js";

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export function normalizeHabit(raw, now) {
  const source = raw || {};
  const name = String(source.name ?? "").trim();
  const createdAt = Number.isFinite(Number(source.createdAt)) ? Number(source.createdAt) : now;
  const periodDays = clampInt(source.periodDays, 1, 60, 1);
  const anchorAt = Number.isFinite(Number(source.anchorAt))
    ? Number(source.anchorAt)
    // Offset by half a period so the boundary sits as far as possible from the
    // time of day the habit is actually performed. Without this, a habit done
    // near its own creation time straddles the boundary most days and loses
    // roughly half its credit.
    : createdAt - (periodDays * DAY) / 2;

  return {
    id: source.id || uid(),
    name: name || "Habit",
    importance: clampInt(source.importance, 1, 5, 3),
    effort: clampInt(source.effort, 1, 5, 3),
    quota: clampInt(source.quota, 1, 20, 1),
    periodDays,
    createdAt,
    anchorAt,
    archived: !!source.archived,
  };
}

// Completions before the anchor are rejected rather than clamped: clamping
// would silently misdate the entry, and allowing it would produce negative
// period keys and an ill-defined warm-up.
export function canLogCompletion(habit, at) {
  return Number.isFinite(Number(at)) && Number(at) >= habit.anchorAt;
}

export function archiveHabit(habit) {
  return { ...habit, archived: true };
}

// Resuming after a gap starts a fresh warm-up. Historical completions are kept,
// but a months-old anchor must not be inherited.
export function unarchiveHabit(habit, now) {
  return { ...habit, archived: false, anchorAt: now };
}
