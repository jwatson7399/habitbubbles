import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, DATA_ID } from "./config.js";

// One local record holds all state. Keys are namespaced to HabitBubbles so
// they cannot collide with ChoreBubbles or ChoreBubbles Solo, which are
// served from the same origin.

export const LOCAL_KEY = "habitbubbles:data:" + DATA_ID;
export const PENDING_KEY = "habitbubbles:pending:" + DATA_ID;
export const INTRO_KEY = "habitbubbles:seenIntro:v1";

let supa = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

export const isSynced = () => !!supa;

export async function getAuthSession() {
  if (!supa) return null;
  const { data, error } = await supa.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthSessionChange(callback) {
  if (!supa) return () => {};
  const { data } = supa.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function sendMagicLink(email) {
  if (!supa) return;
  const { error } = await supa.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split("#")[0] },
  });
  if (error) throw error;
}

// Verify the 6-digit code from the email. Unlike a magic link, this completes
// sign-in inside the current context, so it works in an installed iOS PWA where
// the app has separate storage from Safari.
export async function verifyEmailOtp(email, token) {
  if (!supa) return null;
  const { data, error } = await supa.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  if (!supa) return;
  const { error } = await supa.auth.signOut();
  if (error) throw error;
}

export async function getSharedRecord() {
  if (!supa) {
    const raw = localStorage.getItem(LOCAL_KEY);
    return { value: raw ? JSON.parse(raw) : null, revision: 0 };
  }

  const { data, error } = await supa
    .from("habitbubbles")
    .select("value, revision")
    .eq("id", DATA_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This account cannot access the configured HabitBubbles data.");
  return { value: data.value, revision: Number(data.revision || 0) };
}

export async function compareAndSetShared(value, expectedRevision) {
  if (!supa) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(value));
    return { ok: true, value, revision: expectedRevision + 1 };
  }

  const nextRevision = expectedRevision + 1;
  const { data, error } = await supa
    .from("habitbubbles")
    .update({ value, revision: nextRevision, updated_at: new Date().toISOString() })
    .eq("id", DATA_ID)
    .eq("revision", expectedRevision)
    .select("value, revision")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, conflict: true };
  return { ok: true, value: data.value, revision: Number(data.revision) };
}

export function getPendingOperations() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function enqueueOperation(operation) {
  const pending = getPendingOperations();
  if (!pending.some((item) => item.id === operation.id)) pending.push(operation);
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function removePendingOperations(ids) {
  const completed = new Set(ids);
  const remaining = getPendingOperations().filter((item) => !completed.has(item.id));
  localStorage.setItem(PENDING_KEY, JSON.stringify(remaining));
  return remaining;
}
