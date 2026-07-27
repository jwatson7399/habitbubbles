import { DATA_ID } from "./config.js";

// One local record holds all state. Keys are namespaced to HabitBubbles so
// they cannot collide with ChoreBubbles or ChoreBubbles Solo, which are
// served from the same origin.

export const LOCAL_KEY = "habitbubbles:data:" + DATA_ID;
export const INTRO_KEY = "habitbubbles:seenIntro:v1";

export function getRecord() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveRecord(value) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
  return value;
}
