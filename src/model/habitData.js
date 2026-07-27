export const uid = () => Math.random().toString(36).slice(2, 10);
export const DAY = 86400000;

// The owner's real habits, shipped as first-run defaults. Effort is a static
// time-cost used only to rank suggestions; it is not duration logging.
export const STARTER_HABITS = [
  { name: "Meditate", importance: 4, effort: 1, quota: 1, periodDays: 1 },
  { name: "Read book A", importance: 3, effort: 2, quota: 1, periodDays: 1 },
  { name: "Read book B", importance: 2, effort: 2, quota: 1, periodDays: 1 },
  { name: "Journal", importance: 3, effort: 2, quota: 1, periodDays: 1 },
  { name: "Lift weights", importance: 4, effort: 4, quota: 1, periodDays: 2 },
  { name: "Brazilian jiujitsu", importance: 5, effort: 5, quota: 2, periodDays: 7 },
  { name: "Cardio", importance: 4, effort: 3, quota: 2, periodDays: 7 },
];

export const defaultData = () => ({
  habits: [],
  completions: [],
  settings: { ownerName: "You", rhythmWindowDays: 14, greenStart: 0.8 },
  updatedAt: 0,
});

export function normalizeData(value) {
  const defaults = defaultData();
  const source = value && typeof value === "object" ? value : {};
  const { chores, pauses, ...rest } = source;
  return {
    ...defaults,
    ...rest,
    habits: Array.isArray(source.habits) ? source.habits : [],
    completions: Array.isArray(source.completions) ? source.completions : [],
    settings: {
      ...defaults.settings,
      ...(source.settings || {}),
      ownerName: source.settings?.ownerName || defaults.settings.ownerName,
    },
  };
}

// Operations are small and replayable so queued changes can be applied safely
// to the newest saved state.
export function applyOperation(value, op) {
  const data = normalizeData(value);
  let next = data;

  switch (op.type) {
    case "completion:add": {
      if (data.completions.some((item) => item.id === op.completion.id)) break;
      next = { ...data, completions: [...data.completions, op.completion] };
      break;
    }
    case "completion:add-many": {
      const known = new Set(data.completions.map((item) => item.id));
      next = {
        ...data,
        completions: [...data.completions, ...(op.completions || []).filter((item) => !known.has(item.id))],
      };
      break;
    }
    case "completion:remove": {
      const ids = new Set(op.ids || []);
      next = { ...data, completions: data.completions.filter((item) => !ids.has(item.id)) };
      break;
    }
    case "habit:upsert": {
      const exists = data.habits.some((item) => item.id === op.habit.id);
      const habits = exists
        ? data.habits.map((item) => (item.id === op.habit.id ? op.habit : item))
        : [...data.habits, op.habit];
      next = { ...data, habits };
      break;
    }
    case "habit:add-many": {
      const known = new Set(data.habits.map((item) => item.id));
      next = { ...data, habits: [...data.habits, ...(op.habits || []).filter((item) => !known.has(item.id))] };
      break;
    }
    // Deleting a habit takes its completions with it — orphaned completions
    // would otherwise keep counting toward nothing and clutter history.
    case "habit:delete":
      next = {
        ...data,
        habits: data.habits.filter((item) => item.id !== op.habitId),
        completions: data.completions.filter((item) => item.habitId !== op.habitId),
      };
      break;
    case "habit:clear":
      next = { ...data, habits: [], completions: [] };
      break;
    case "settings:patch":
      next = { ...data, settings: { ...data.settings, ...op.patch } };
      break;
    default:
      break;
  }

  return { ...next, updatedAt: Math.max(next.updatedAt || 0, op.createdAt || 0) };
}
