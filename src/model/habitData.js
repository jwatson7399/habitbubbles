import { advanceTwoStepChore } from "../twoStepChore.js";

export const uid = () => Math.random().toString(36).slice(2, 10);
export const DAY = 86400000;

export const defaultData = () => ({
  chores: [],
  completions: [],
  pauses: [],
  settings: { mode: "solo", ownerName: "You", weeklyGoal: 14 },
  updatedAt: 0,
});

export function normalizeData(value) {
  const defaults = defaultData();
  const source = value && typeof value === "object" ? value : {};
  return {
    ...defaults,
    ...source,
    chores: Array.isArray(source.chores) ? source.chores : [],
    completions: Array.isArray(source.completions) ? source.completions : [],
    pauses: Array.isArray(source.pauses) ? source.pauses : [],
    settings: {
      ...defaults.settings,
      ...(source.settings || {}),
      mode: "solo",
      ownerName:
        source.settings?.ownerName ||
        source.settings?.nameA ||
        defaults.settings.ownerName,
    },
  };
}

// Operations are intentionally small and replayable so offline changes can be
// applied safely to the newest saved state.
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
      next = { ...data, completions: [...data.completions, ...(op.completions || []).filter((item) => !known.has(item.id))] };
      break;
    }
    case "completion:add-and-advance": {
      if (data.completions.some((item) => item.id === op.completion.id)) break;
      const chores = data.chores.map((item) =>
        item.id === op.choreId ? advanceTwoStepChore(item) : item
      );
      next = { ...data, chores, completions: [...data.completions, op.completion] };
      break;
    }
    case "completion:remove-and-restore": {
      const ids = new Set(op.ids || []);
      const chores = data.chores.map((item) =>
        item.id === op.chore?.id ? op.chore : item
      );
      next = { ...data, chores, completions: data.completions.filter((item) => !ids.has(item.id)) };
      break;
    }
    case "completion:remove": {
      const ids = new Set(op.ids || []);
      next = { ...data, completions: data.completions.filter((item) => !ids.has(item.id)) };
      break;
    }
    case "chore:upsert": {
      const exists = data.chores.some((item) => item.id === op.chore.id);
      const chores = exists
        ? data.chores.map((item) => (item.id === op.chore.id ? op.chore : item))
        : [...data.chores, op.chore];
      next = { ...data, chores };
      break;
    }
    case "chore:add-many": {
      const known = new Set(data.chores.map((item) => item.id));
      next = { ...data, chores: [...data.chores, ...(op.chores || []).filter((item) => !known.has(item.id))] };
      break;
    }
    case "chore:delete":
      next = { ...data, chores: data.chores.filter((item) => item.id !== op.choreId) };
      break;
    case "chore:clear":
      next = { ...data, chores: [] };
      break;
    case "pause:set": {
      let pauses = [...data.pauses];
      const active = pauses.filter((item) => item.scope === op.scope && item.end == null);
      if (op.active && active.length === 0) {
        pauses.push({ id: op.pauseId, scope: op.scope, start: op.at, end: null });
      } else if (!op.active && active.length > 0) {
        const activeIds = new Set(active.map((item) => item.id));
        pauses = pauses.map((item) => (activeIds.has(item.id) ? { ...item, end: op.at } : item));
      }
      next = { ...data, pauses };
      break;
    }
    case "settings:patch":
      next = { ...data, settings: { ...data.settings, ...op.patch } };
      break;
    default:
      break;
  }

  return { ...next, updatedAt: Math.max(next.updatedAt || 0, op.createdAt || 0) };
}
