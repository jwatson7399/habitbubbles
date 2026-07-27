import React, { useState, useEffect, useRef, useCallback } from "react";
import { getRecord, saveRecord, INTRO_KEY } from "./storage.js";
import { completionIds, shouldPulseRhythm } from "./model/rhythmPulse.js";
import { rhythmScore, rhythmZone } from "./model/rhythmModel.js";
import { DAY, uid, defaultData, normalizeData, applyOperation } from "./model/habitData.js";
import { normalizeHabit, canLogCompletion } from "./model/habitSchema.js";
import { faceFor } from "./utils/format.js";
import { realNow, now, setTimeOffset } from "./utils/clock.js";
import { Modal } from "./components/Modal.jsx";
import { btnStyle, Stepper } from "./components/controls.jsx";
import RhythmBar from "./components/RhythmBar.jsx";
import { OwnerNameEditor } from "./components/OwnerNameEditor.jsx";
import { theme } from "./theme.js";
import BubblesScreen from "./screens/BubblesScreen.jsx";
import LogScreen from "./screens/LogScreen.jsx";
import HabitsScreen from "./screens/HabitsScreen.jsx";

// HabitBubbles: a personal habit ecosystem.
// Bubbles swell as opportunities come due. Tap to complete, drag to rearrange.

// ---------- Main app ----------
export default function HabitBubbles() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("bubbles");
  const [toast, setToast] = useState(null);
  const [popId, setPopId] = useState(null);
  const [syncState, setSyncState] = useState("");
  const [simDays, setSimDays] = useState(0);
  const [simData, setSimData] = useState(null);
  const [simOpen, setSimOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [healthPulse, setHealthPulse] = useState(0);
  const prevHealthRef = useRef(null);
  const knownCreditedCompletionIdsRef = useRef(null);
  const pulseTimer = useRef(null);
  const toastTimer = useRef(null);
  const popTimer = useRef(null);
  const dataRef = useRef(null);
  const simDaysRef = useRef(0);
  dataRef.current = data;
  simDaysRef.current = simDays;

  // While the time machine is running, edits (completing habits) apply to a
  // local sandbox copy that is never saved and is discarded on returning to
  // today. This keeps simulated play out of saved data.
  const view = simDays > 0 && simData ? simData : data;

  const showToast = useCallback((msg, undoFn = null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, undoFn });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const load = useCallback(() => {
    try {
      const stored = getRecord();
      setData(normalizeData(stored));
      setSyncState("");
    } catch (error) {
      setSyncState(error.message || "Unable to load your habits.");
      if (!dataRef.current) setData(defaultData());
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data || simDays > 0) return;
    try {
      if (!localStorage.getItem(INTRO_KEY)) setIntroOpen(true);
    } catch {}
  }, [data, simDays]);

  useEffect(() => {
    const refresh = () => load();
    const iv = setInterval(refresh, 20000);
    const onVis = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  const commit = useCallback((operation) => {
    // In the time machine, stamp with simulated "now" and keep edits local.
    if (simDaysRef.current > 0) {
      const simStamped = { ...operation, id: operation.id || uid(), createdAt: now() };
      setSimData((current) => applyOperation(current || dataRef.current, simStamped));
      return true;
    }
    const stamped = { ...operation, id: operation.id || uid(), createdAt: realNow() };
    const next = applyOperation(normalizeData(getRecord()), stamped);
    saveRecord(next);
    dataRef.current = next;
    setData(next);
    return true;
  }, []);

  const dismissIntro = () => {
    try { localStorage.setItem(INTRO_KEY, "1"); } catch {}
    setIntroOpen(false);
  };

  const setSim = (days) => {
    const d = Math.max(0, days);
    setTimeOffset(d * DAY);
    simDaysRef.current = d;
    // Seed the sandbox from real data when entering; drop it when back to today.
    if (d === 0) setSimData(null);
    else setSimData((current) => current || dataRef.current);
    setSimDays(d);
  };

  const resetActivity = () => {
    commit({ type: "completion:remove", ids: view.completions.map((item) => item.id) });
  };

  // Remove a single logged completion: drops it from the activity log and
  // regrows that habit's bubble. Undoable.
  const removeCompletion = (entry) => {
    if (!commit({ type: "completion:remove", ids: [entry.id] })) return;
    showToast(`Removed ${entry.habitName}`, () => {
      commit({ type: "completion:add", completion: entry });
      setToast(null);
    });
  };

  // "whenDays" lets you backdate a habit you forgot to log (e.g. done yesterday).
  // Returns true/false so callers (the completion sheet) know whether to close.
  const logCompletion = (habit, whenDays = 0) => {
    const at = now() - whenDays * DAY;
    if (!canLogCompletion(habit, at)) {
      showToast("That's before this habit started tracking.");
      return false;
    }
    const comp = { id: uid(), habitId: habit.id, habitName: habit.name, at };
    if (!commit({ type: "completion:add", completion: comp })) return false;
    setPopId(habit.id);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPopId(null), 1000);
    const when = whenDays === 0 ? "" : whenDays === 1 ? " (yesterday)" : ` (${whenDays}d ago)`;
    showToast(`${habit.name} done${when}`, () => {
      commit({ type: "completion:remove", ids: [comp.id] });
      setToast(null);
    });
    return true;
  };

  const saveHabit = (habit) => {
    commit({ type: "habit:upsert", habit: normalizeHabit(habit, now()) });
  };

  const deleteHabit = (id) => {
    commit({ type: "habit:delete", habitId: id });
  };

  const addManyHabits = (habits) => {
    commit({ type: "habit:add-many", habits });
  };

  const clearHabits = () => {
    commit({ type: "habit:clear" });
    showToast("All habits cleared");
  };

  // Pulse for every newly observed completion, including a gain too small to
  // change the rounded percentage. Exact score comparisons preserve the
  // previous behavior for other rhythm improvements. Uses view.settings
  // directly (not the `settings` destructured later in render) because this
  // effect is declared before that destructuring is in scope.
  useEffect(() => {
    if (!view) return;
    const score = rhythmScore(view.habits, view.completions, now(), view.settings?.rhythmWindowDays);
    if (shouldPulseRhythm(
      prevHealthRef.current,
      score,
      knownCreditedCompletionIdsRef.current,
      view.completions
    )) {
      setHealthPulse((sequence) => sequence + 1);
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setHealthPulse(0), 1400);
    }
    prevHealthRef.current = score;
    knownCreditedCompletionIdsRef.current = completionIds(view.completions);
  }, [view]);

  if (!data) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", gap: 10, alignItems: "center", justifyContent: "center", textAlign: "center", padding: 28, background: theme.night, color: theme.textMuted, fontFamily: "'Nunito Sans', sans-serif" }}>
        <div>Loading your habits...</div>
        {syncState && <div style={{ color: theme.danger, fontSize: 13, maxWidth: 380 }}>{syncState}</div>}
      </div>
    );
  }

  const { settings } = view;
  // Rhythm replaces the old chore-era healthScore. `rhythm` is null while
  // every habit is still warming up (its first period hasn't elapsed) — that
  // must render as a distinct "warming up" state, not a fabricated 0%, or a
  // brand-new user's blank slate would read as failure (rhythmZone(null)
  // resolves to the red "Getting started ⚠️" zone).
  const rhythm = rhythmScore(view.habits, view.completions, now(), settings.rhythmWindowDays);
  const rhythmZoneInfo = rhythm == null ? null : rhythmZone(rhythm, settings.greenStart);
  const healthPct = rhythm == null ? null : Math.round(rhythm * 100);
  const healthColor = !rhythmZoneInfo ? theme.textMuted : rhythmZoneInfo.key === "green" ? theme.zoneTop : rhythmZoneInfo.key === "amber" ? theme.zoneMiddle : theme.zoneBehind;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: `radial-gradient(120% 100% at 50% 0%, ${theme.surface} 0%, ${theme.night} 70%)`, fontFamily: "'Nunito Sans', sans-serif", color: theme.text, overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700&family=Nunito+Sans:wght@400;600;700&display=swap');
        @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.045)} }
        @keyframes pop { 0%{transform:scale(1.15)} 45%{transform:scale(0.82)} 100%{transform:scale(1)} }
        @keyframes sparkleUp { 0%{opacity:1; transform:translateY(0) scale(0.7)} 100%{opacity:0; transform:translateY(-26px) scale(1.25)} }
        @keyframes barSwell { 0%{transform:scaleY(1)} 25%{transform:scaleY(1.9)} 55%{transform:scaleY(1.25)} 100%{transform:scaleY(1)} }
        @keyframes wilt { 0%,100%{transform:rotate(-6deg) translateY(1px)} 50%{transform:rotate(-10deg) translateY(3px)} }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
        * { box-sizing: border-box; margin: 0; }
        button:active { transform: scale(0.96); }
        input { outline: none; }
        .bubble-hit { outline: none; }
        .bubble-hit:focus-visible {
          outline: 3px solid ${theme.suggest};
          outline-offset: 3px;
          box-shadow: 0 0 0 6px ${theme.suggest}55;
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: "calc(env(safe-area-inset-top) + 14px) 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: 0.3 }}>
          Habit<span style={{ color: theme.zoneTop }}>Bubbles</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, color: simDays > 0 ? theme.zoneMiddle : theme.textMuted, fontWeight: simDays > 0 ? 700 : 400 }}>
            {simDays > 0
              ? `⏩ +${simDays}d`
              : syncState || "local only"}
          </div>
          <button onClick={() => setSimOpen(true)} style={{ background: "none", border: "none", fontSize: 17, cursor: "pointer", padding: 2, WebkitTapHighlightColor: "transparent", opacity: 0.75 }}>
            🧪
          </button>
        </div>
      </div>

      {/* Rhythm bar */}
      {view.habits.length > 0 && (
        <div style={{ padding: "2px 20px 10px" }}>
          {healthPct === null ? (
            <div style={{ textAlign: "center", color: theme.textMuted, fontSize: 13, padding: "8px 0" }}>
              🌱 Warming up — your rhythm shows once a habit has run a full period.
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 2 }}>
                <span
                  key={faceFor(healthPct)}
                  style={{
                    fontSize: 30,
                    display: "inline-block",
                    animation: healthPct >= 90 ? "breathe 4s ease-in-out infinite" : healthPct < 15 ? "wilt 3.5s ease-in-out infinite" : "none",
                    transition: "transform 0.5s ease",
                  }}
                >
                  {faceFor(healthPct)}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 13, fontWeight: 600, color: theme.textDim, letterSpacing: 0.4 }}>My rhythm</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: healthPulse ? theme.zoneTop : healthColor, transition: "color 0.5s ease" }}>
                  {healthPct}%
                </span>
              </div>
              <RhythmBar score={rhythm} greenStart={settings.greenStart} height={10} pulse={!!healthPulse} pulseSeq={healthPulse} />
            </>
          )}
        </div>
      )}

      {/* Body */}
      {tab === "bubbles" && (
        <BubblesScreen
          habits={view.habits}
          completions={view.completions}
          simDays={simDays}
          popId={popId}
          onComplete={logCompletion}
          showToast={showToast}
        />
      )}

      {tab === "log" && (
        <LogScreen
          habits={view.habits}
          completions={view.completions}
          rhythmWindowDays={settings.rhythmWindowDays}
          greenStart={settings.greenStart}
          onRemoveCompletion={removeCompletion}
        />
      )}

      {tab === "habits" && (
        <HabitsScreen
          habits={view.habits}
          completions={view.completions}
          simDays={simDays}
          onSaveHabit={saveHabit}
          onDeleteHabit={deleteHabit}
          onAddManyHabits={addManyHabits}
        >
          <div style={{ paddingTop: 26 }}>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 600 }}>Settings</div>
            <Stepper
              label="Top zone starts at"
              value={Math.round(settings.greenStart * 100)}
              min={40}
              max={100}
              step={5}
              onChange={(v) => commit({ type: "settings:patch", patch: { greenStart: v / 100 } })}
              format={(v) => `${v}%`}
            />
            <div style={{ color: theme.textMuted, fontSize: 11.5, margin: "-4px 0 8px" }}>
              Your rhythm reads &ldquo;On top of it&rdquo; once it reaches this percentage.
            </div>
            <OwnerNameEditor settings={settings} onSave={(ownerName) => commit({ type: "settings:patch", patch: { ownerName } })} />
            {view.habits.length > 0 && (
              <>
                <div style={{ marginTop: 26, fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 600 }}>Start over</div>
                <div style={{ fontSize: 12, color: theme.textMuted, margin: "4px 0 10px" }}>
                  Clearing removes every habit so you can build a fresh list.
                </div>
                <button disabled={simDays > 0} onClick={() => window.confirm("Clear all habits? This removes every habit and cannot be undone.") && clearHabits()} style={{ ...btnStyle(theme.surface, theme.zoneBehind), width: "100%", border: `1px solid ${theme.border}`, opacity: simDays > 0 ? 0.45 : 1 }}>
                  🗑 Clear all habits
                </button>
              </>
            )}
            <button onClick={() => window.confirm("Clear the activity log? This cannot be undone.") && resetActivity()} style={{ ...btnStyle(theme.surface, theme.zoneBehind), width: "100%", marginTop: 8, border: `1px solid ${theme.border}`, fontSize: 13 }}>
              Clear activity log
            </button>
          </div>
        </HabitsScreen>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", borderTop: `1px solid ${theme.border}`, background: theme.night, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {[
          { id: "bubbles", label: "Bubbles", icon: "🫧" },
          { id: "log", label: "The Log", icon: "📊" },
          { id: "habits", label: "Habits", icon: "📝" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ flex: 1, background: "none", border: "none", padding: "12px 0 14px", cursor: "pointer", color: tab === t.id ? theme.zoneTop : theme.textMuted, fontFamily: "'Baloo 2', sans-serif", fontSize: 13, fontWeight: 600, WebkitTapHighlightColor: "transparent" }}
          >
            <div style={{ fontSize: 19 }}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 92, left: "50%", transform: "translateX(-50%)", background: theme.border, borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 6px 24px rgba(0,0,0,0.45)", zIndex: 60, maxWidth: "92%" }}>
          <span style={{ fontSize: 14 }}>{toast.msg}</span>
          {toast.undoFn && <button onClick={toast.undoFn} style={{ background: "none", border: "none", color: theme.zoneTop, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Undo</button>}
        </div>
      )}

      {/* Simulation panel */}
      {simOpen && (
        <Modal onClose={() => setSimOpen(false)} title="Time machine">
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Time machine 🧪</div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 16 }}>
            Fast-forward this phone&apos;s clock to preview how bubbles grow and how your rhythm moves. Test completions stay in a local sandbox and disappear when you return to today.
          </div>
          <div style={{ textAlign: "center", fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 700, color: simDays > 0 ? theme.zoneMiddle : theme.text, marginBottom: 14 }}>
            {simDays === 0 ? "Today" : `Today + ${simDays} day${simDays === 1 ? "" : "s"}`}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button onClick={() => setSim(simDays + 1)} style={{ ...btnStyle(theme.surface, theme.text), flex: 1, border: `1px solid ${theme.border}` }}>+1 day</button>
            <button onClick={() => setSim(simDays + 3)} style={{ ...btnStyle(theme.surface, theme.text), flex: 1, border: `1px solid ${theme.border}` }}>+3 days</button>
            <button onClick={() => setSim(simDays + 7)} style={{ ...btnStyle(theme.surface, theme.text), flex: 1, border: `1px solid ${theme.border}` }}>+1 week</button>
          </div>
          <button onClick={() => setSim(0)} style={{ ...btnStyle(theme.zoneTop), width: "100%", marginBottom: 10 }}>Back to today</button>
        </Modal>
      )}

      {/* One-time explanation */}
      {introOpen && (
        <Modal onClose={dismissIntro} title="How HabitBubbles works">
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 21, fontWeight: 700, marginBottom: 14 }}>How HabitBubbles works 🫧</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, color: theme.text, fontSize: 14, lineHeight: 1.45, marginBottom: 20 }}>
            <div><strong style={{ color: theme.zoneTop }}>1.</strong> Set how often you want to do each habit — daily, twice a week, every other day.</div>
            <div><strong style={{ color: theme.zoneTop }}>2.</strong> Its bubble grows as that opportunity comes due; tap it to log the habit as done.</div>
            <div><strong style={{ color: theme.zoneTop }}>3.</strong> Your rhythm tracks how well you're keeping up over the last fortnight.</div>
          </div>
          <button onClick={dismissIntro} style={{ ...btnStyle(theme.zoneTop), width: "100%" }}>Got it</button>
        </Modal>
      )}
    </div>
  );
}
