import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  getRecord,
  saveRecord,
  getPendingOperations,
  enqueueOperation,
  removePendingOperations,
  INTRO_KEY,
} from "./storage.js";
import {
  effortZone,
  effortZoneThresholds,
  pointsInActivePeriod,
  soloStreak,
  suggestCombo,
  weeklyPoints,
} from "./logModel.js";
import {
  habitHistoryFor,
  completionImpact,
  lastDoneLabel,
} from "./model/habitHistory.js";
import { completionIds, shouldPulseRhythm } from "./model/rhythmPulse.js";
import { DAY, uid, defaultData, normalizeData, applyOperation } from "./model/habitData.js";
import { lastDone, urgencyOf, healthScore } from "./model/choreMath.js";
import { faceFor, timeAgo, historyDate } from "./utils/format.js";
import { realNow, now, setTimeOffset } from "./utils/clock.js";
import { Modal } from "./components/Modal.jsx";
import { btnStyle, Stepper, ScaleSelector } from "./components/controls.jsx";
import { ChoreFields } from "./components/ChoreFields.jsx";
import { CompactBar, ProgressRow } from "./components/bars.jsx";
import { OwnerNameEditor } from "./components/OwnerNameEditor.jsx";
import BubbleField, { bubbleHue } from "./components/BubbleField.jsx";

// HabitBubbles: a personal habit ecosystem.
// Bubbles swell as opportunities come due. Tap to complete, drag to rearrange.


const STARTERS = [
  { name: "Dishes", importance: 4, difficulty: 1, freqDays: 1, service: false },
  { name: "Kitchen counters", importance: 4, difficulty: 1, freqDays: 2, service: true },
  { name: "Trash + recycling", importance: 3, difficulty: 1, freqDays: 3, service: false },
  { name: "Laundry", importance: 4, difficulty: 2, freqDays: 4, service: false },
  { name: "Vacuum floors", importance: 3, difficulty: 2, freqDays: 7, service: true },
  { name: "Bathroom clean", importance: 4, difficulty: 3, freqDays: 7, service: true },
  { name: "Change sheets", importance: 3, difficulty: 2, freqDays: 14, service: false },
  { name: "Mop floors", importance: 2, difficulty: 3, freqDays: 14, service: true },
  { name: "Fridge clean-out", importance: 2, difficulty: 2, freqDays: 14, service: false },
  { name: "Dust surfaces", importance: 2, difficulty: 2, freqDays: 14, service: true },
];

// ---------- Main app ----------
export default function HabitBubbles() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("bubbles");
  const [tapChore, setTapChore] = useState(null);
  const [tapWhenDays, setTapWhenDays] = useState(0);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceSel, setServiceSel] = useState({});
  const [editChore, setEditChore] = useState(null);
  const [toast, setToast] = useState(null);
  const [popId, setPopId] = useState(null);
  const [syncState, setSyncState] = useState("");
  const [simDays, setSimDays] = useState(0);
  const [simData, setSimData] = useState(null);
  const [simOpen, setSimOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [suggestionSeed, setSuggestionSeed] = useState(0);
  const [bubbleSuggestionsVisible, setBubbleSuggestionsVisible] = useState(false);
  const [healthPulse, setHealthPulse] = useState(0);
  const prevHealthRef = useRef(null);
  const knownCreditedCompletionIdsRef = useRef(null);
  const pulseTimer = useRef(null);
  const toastTimer = useRef(null);
  const popTimer = useRef(null);
  const dataRef = useRef(null);
  const busyRef = useRef(false);
  const flushPromiseRef = useRef(null);
  const simDaysRef = useRef(0);
  dataRef.current = data;
  simDaysRef.current = simDays;

  // While the time machine is running, edits (popping bubbles, service)
  // apply to a local sandbox copy that is never synced and is discarded on
  // returning to today. This keeps simulated play out of saved data.
  const view = simDays > 0 && simData ? simData : data;

  const logStats = useMemo(() => {
    if (!view) return null;
    const at = now();
    const goal = Number(view.settings?.weeklyGoal) || 14;
    const points = weeklyPoints(view.completions, "owner", [], at);
    const { greenMin } = effortZoneThresholds(goal, view.settings?.greenStart);
    const previousPoints = pointsInActivePeriod(view.completions, "owner", [], at, 1);
    const streak = soloStreak(view.completions, greenMin, [], at);
    const urgencyById = Object.fromEntries(
      view.chores.map((chore) => [chore.id, urgencyOf(chore, view.completions, [])])
    );
    const gap = Math.max(0, greenMin - points);
    const suggestion = gap > 0
      ? suggestCombo(view.chores, gap, urgencyById, suggestionSeed)
      : null;

    return {
      goal,
      greenMin,
      points,
      previousPoints,
      previousHasActivity: previousPoints > 0,
      streak,
      gap,
      suggestion,
    };
  }, [view, suggestionSeed, simDays]);

  const showToast = useCallback((msg, undoFn = null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, undoFn });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const flushQueue = useCallback(async () => {
    if (flushPromiseRef.current) return flushPromiseRef.current;

    const task = (async () => {
      busyRef.current = true;
      try {
        const pending = getPendingOperations();
        if (pending.length === 0) {
          setSyncState("");
          return true;
        }

        const current = getRecord();
        const merged = pending.reduce(applyOperation, normalizeData(current));
        saveRecord(merged);
        removePendingOperations(pending.map((item) => item.id));
        setData(merged);
        setSyncState("saved locally");
        return true;
      } catch (error) {
        setSyncState("saved locally");
        return false;
      } finally {
        busyRef.current = false;
        flushPromiseRef.current = null;
      }
    })();

    flushPromiseRef.current = task;
    return task;
  }, []);

  const load = useCallback(async () => {
    if (busyRef.current) return;
    try {
      const stored = getRecord();
      const pending = getPendingOperations();
      const visible = pending.reduce(applyOperation, normalizeData(stored));
      setData(visible);
      setSyncState("");
      if (pending.length > 0) flushQueue();
    } catch (error) {
      setSyncState(error.message || "Unable to load your chores.");
      if (!dataRef.current) setData(defaultData());
    }
  }, [flushQueue]);

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
    const refresh = () => {
      load();
      flushQueue();
    };
    const iv = setInterval(refresh, 20000);
    const onVis = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [load, flushQueue]);

  const commit = useCallback((operation) => {
    // In the time machine, stamp with simulated "now" and keep edits local.
    if (simDaysRef.current > 0) {
      const simStamped = { ...operation, id: operation.id || uid(), createdAt: now() };
      setSimData((current) => applyOperation(current || dataRef.current, simStamped));
      return true;
    }
    const stamped = { ...operation, id: operation.id || uid(), createdAt: realNow() };
    enqueueOperation(stamped);
    setData((current) => applyOperation(current, stamped));
    flushQueue();
    return true;
  }, [flushQueue]);

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

  // Remove a single logged completion: drops it from the activity log, takes its
  // effort points back off, and regrows that chore's bubble. Undoable.
  const removeCompletion = (entry) => {
    if (!commit({ type: "completion:remove", ids: [entry.id] })) return;
    showToast(`Removed ${entry.choreName}`, () => {
      commit({ type: "completion:add", completion: entry });
      setToast(null);
    });
  };

  const logCompletion = (chore) => {
    // "when" lets you backdate a chore you forgot to log (e.g. done yesterday).
    const ts = now() - tapWhenDays * DAY;
    const comp = {
      id: uid(),
      choreId: chore.id,
      choreName: chore.name,
      difficulty: chore.difficulty,
      by: "owner",
      ts,
    };
    if (!commit({ type: "completion:add", completion: comp })) return;
    setTapChore(null);
    setTapWhenDays(0);
    setPopId(chore.id);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setPopId(null), 1000);
    const when = tapWhenDays === 0 ? "" : tapWhenDays === 1 ? " (yesterday)" : ` (${tapWhenDays}d ago)`;
    showToast(`${chore.name} done${when}`, () => {
      commit({ type: "completion:remove", ids: [comp.id] });
      setToast(null);
    });
  };

  const openService = () => {
    const sel = {};
    for (const ch of view.chores) sel[ch.id] = !!ch.service;
    setServiceSel(sel);
    setServiceOpen(true);
  };

  const confirmService = () => {
    const ts = now();
    const comps = view.chores
      .filter((ch) => serviceSel[ch.id])
      .map((ch) => ({ id: uid(), choreId: ch.id, choreName: ch.name, difficulty: ch.difficulty, by: "service", ts }));
    if (!commit({ type: "completion:add-many", completions: comps })) return;
    setServiceOpen(false);
    showToast(`Cleaning service logged: ${comps.length} chores reset`, () => {
      commit({ type: "completion:remove", ids: comps.map((c) => c.id) });
      setToast(null);
    });
  };

  const saveChore = (ch) => {
    const chore = ch.id ? ch : { ...ch, id: uid(), createdAt: realNow() };
    if (commit({ type: "chore:upsert", chore })) setEditChore(null);
  };

  const deleteChore = (id) => {
    if (commit({ type: "chore:delete", choreId: id })) setEditChore(null);
  };

  const addStarters = () => {
    const chores = STARTERS.map((s) => ({ ...s, id: uid(), createdAt: realNow() }));
    commit({ type: "chore:add-many", chores });
  };

  const clearChores = () => {
    commit({ type: "chore:clear" });
    setEditChore(null);
    showToast("All chores cleared");
  };

  // Mark every chore as just done (no points) — for coming back after time away.
  // Resets bubble sizes and health without crediting anyone.
  const resetBubbles = () => {
    const ts = realNow();
    const comps = view.chores.map((ch) => ({ id: uid(), choreId: ch.id, choreName: ch.name, difficulty: ch.difficulty, by: "reset", ts }));
    if (comps.length === 0) return;
    commit({ type: "completion:add-many", completions: comps });
    showToast("Board reset — every chore marked fresh");
  };

  // Pulse for every newly observed personal completion, including a gain too
  // small to change the rounded percentage. Exact score comparisons preserve
  // the previous behavior for other health improvements.
  useEffect(() => {
    if (!view) return;
    const score = healthScore(view.chores, view.completions, []);
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
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", gap: 10, alignItems: "center", justifyContent: "center", textAlign: "center", padding: 28, background: "#0C1B26", color: "#7FA3AC", fontFamily: "'Nunito Sans', sans-serif" }}>
        <div>Loading your chores...</div>
        {syncState && <div style={{ color: "#FF8B7B", fontSize: 13, maxWidth: 380 }}>{syncState}</div>}
      </div>
    );
  }

  const { settings } = view;
  const {
    goal,
    greenMin,
    points,
    previousPoints,
    previousHasActivity,
    streak,
    gap,
    suggestion,
  } = logStats;
  const health = healthScore(view.chores, view.completions, []);
  const healthPct = Math.round(health * 100);
  const healthColor = healthPct >= 80 ? "#5FE0BB" : healthPct >= 50 ? "#FFC65E" : "#FF8B7B";
  const recent = [...view.completions].sort((a, b) => b.ts - a.ts).slice(0, 30);
  const choreHistories = new Map(
    view.chores.map((chore) => [chore.id, habitHistoryFor(view.completions, chore.id)])
  );
  const editChoreHistory = editChore?.id ? choreHistories.get(editChore.id) || [] : [];
  const suggestedBubbleIds = new Set(
    bubbleSuggestionsVisible && suggestion ? suggestion.chores.map((chore) => chore.id) : []
  );
  const canShuffleSuggestions = !!suggestion && view.chores.length > 0;
  const shuffleSuggestions = () => {
    if (!canShuffleSuggestions) return;
    setBubbleSuggestionsVisible(true);
    setSuggestionSeed((seed) => seed + 1);
  };
  const hideBubbleSuggestions = () => setBubbleSuggestionsVisible(false);
  const previousRecap = !previousHasActivity
    ? ""
    : previousPoints >= greenMin
    ? "Previous 7 days: you stayed green 🌱"
    : `Previous 7 days: ${previousPoints} points`;

  const impLabel = (v) => ["", "Low", "Mild", "Medium", "High", "Critical"][v];

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "radial-gradient(120% 100% at 50% 0%, #123240 0%, #0C1B26 70%)", fontFamily: "'Nunito Sans', sans-serif", color: "#E8F3F4", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700&family=Nunito+Sans:wght@400;600;700&display=swap');
        @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.045)} }
        @keyframes pop { 0%{transform:scale(1.15)} 45%{transform:scale(0.82)} 100%{transform:scale(1)} }
        @keyframes sparkleUp { 0%{opacity:1; transform:translateY(0) scale(0.7)} 100%{opacity:0; transform:translateY(-26px) scale(1.25)} }
        @keyframes barSwell { 0%{transform:scaleY(1)} 25%{transform:scaleY(1.9)} 55%{transform:scaleY(1.25)} 100%{transform:scaleY(1)} }
        @keyframes greenArrival { 0%{transform:scale(0.82); box-shadow:0 0 0 #5FE0BB00} 55%{transform:scale(1.08); box-shadow:0 0 14px #5FE0BB66} 100%{transform:scale(1); box-shadow:0 0 0 #5FE0BB00} }
        @keyframes wilt { 0%,100%{transform:rotate(-6deg) translateY(1px)} 50%{transform:rotate(-10deg) translateY(3px)} }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
        * { box-sizing: border-box; margin: 0; }
        button:active { transform: scale(0.96); }
        input { outline: none; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "calc(env(safe-area-inset-top) + 14px) 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: 0.3 }}>
          Chore<span style={{ color: "#5FE0BB" }}>Bubbles</span> <span style={{ color: "#9FD4EA", fontSize: 13 }}>Solo</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, color: simDays > 0 ? "#FFC65E" : "#7FA3AC", fontWeight: simDays > 0 ? 700 : 400 }}>
            {simDays > 0
              ? `⏩ +${simDays}d`
              : syncState || "local only"}
          </div>
          <button onClick={() => setSimOpen(true)} style={{ background: "none", border: "none", fontSize: 17, cursor: "pointer", padding: 2, WebkitTapHighlightColor: "transparent", opacity: 0.75 }}>
            🧪
          </button>
        </div>
      </div>

      {/* Home health bar */}
      {view.chores.length > 0 && (
        <div style={{ padding: "2px 20px 10px" }}>
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
            <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 13, fontWeight: 600, color: "#B9D2D8", letterSpacing: 0.4 }}>My home&apos;s health</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: healthPulse ? "#5FE0BB" : healthColor, transition: "color 0.5s ease" }}>
              {healthPct}%
            </span>
          </div>
          <div style={{ position: "relative", height: 10, borderRadius: 6, background: "#0F2530", border: "1px solid #1E4152", overflow: "visible" }}>
            <div
              key={`health-fill-${healthPulse}`}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${healthPct}%`,
                borderRadius: 6,
                background: healthPulse
                  ? "linear-gradient(to right, #5FE0BB99, #5FE0BB)"
                  : `linear-gradient(to right, ${healthColor}99, ${healthColor})`,
                boxShadow: healthPulse
                  ? "0 0 20px #5FE0BBCC"
                  : healthPct >= 80
                  ? `0 0 10px ${healthColor}88`
                  : "none",
                animation: healthPulse ? "barSwell 1.4s ease-out" : "none",
                transformOrigin: "left center",
                transition: "width 0.8s ease, background 0.5s ease, box-shadow 0.5s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Body */}
      {tab === "bubbles" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {view.chores.length > 0 && (
            <div style={{ padding: "2px 20px 8px" }}>
              <CompactBar name={settings.ownerName} points={points} goal={goal} greenStart={settings.greenStart} />
            </div>
          )}
          {simDays > 0 && (
            <div style={{ margin: "4px 20px 0", padding: "9px 14px", background: "#3B3215", border: "1px solid #6E5C21", borderRadius: 12, fontSize: 13, color: "#FFC65E", textAlign: "center" }}>
              🧪 Time machine — tap bubbles to test. Nothing here is saved.
            </div>
          )}
          <BubbleField habits={view.habits} completions={view.completions} onTap={(ch) => { setTapWhenDays(0); setTapChore(ch); }} popId={popId} simDays={simDays} suggestedIds={suggestedBubbleIds} />
          <div style={{ padding: "0 20px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                disabled={!canShuffleSuggestions}
                onClick={shuffleSuggestions}
                aria-pressed={bubbleSuggestionsVisible && suggestedBubbleIds.size > 0}
                aria-label="Shuffle chore suggestions to reach the green zone"
                style={{
                  ...btnStyle(bubbleSuggestionsVisible && suggestedBubbleIds.size > 0 ? "#3B3415" : "#0F2530", "#FFE27A"),
                  flex: 1,
                  border: `1px solid ${bubbleSuggestionsVisible && suggestedBubbleIds.size > 0 ? "#C9A92C" : "#554B25"}`,
                  opacity: canShuffleSuggestions ? 1 : 0.45,
                }}
              >
                🎲 Shuffle chore suggestions
              </button>
              {bubbleSuggestionsVisible && suggestedBubbleIds.size > 0 && (
                <button
                  onClick={hideBubbleSuggestions}
                  aria-label="Hide chore suggestions"
                  style={{ ...btnStyle("#2B2417", "#FFE27A"), width: 52, padding: 0, border: "1px solid #8A722A", fontSize: 18 }}
                >
                  ✕
                </button>
              )}
            </div>
            <button onClick={openService} style={{ ...btnStyle("#0F2530", "#5FE0BB"), width: "100%", border: "1px solid #1E4152" }}>
              🧹 Cleaning service came
            </button>
          </div>
        </div>
      )}

      {tab === "log" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 26px" }}>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 23, fontWeight: 700, marginTop: 4 }}>Last 7 days</div>
          <div style={{ color: "#7FA3AC", fontSize: 13, lineHeight: 1.4, marginBottom: 12 }}>
            What you&apos;ve done over your last 7 active days. Keep it in the green.
          </div>

          <div style={{ background: "linear-gradient(145deg, #173746, #122B37)", border: "1px solid #245064", borderRadius: 18, padding: "0 16px 12px", marginBottom: 12 }}>
            <ProgressRow label={settings.ownerName} points={points} goal={goal} hue="#5FE0BB" zoned greenStart={settings.greenStart} prominent />
            <div style={{ color: "#7FA3AC", fontSize: 11.5, textAlign: "center", padding: "2px 0 10px" }}>
              Full scale: {goal} points · Green starts at {greenMin}
            </div>
            {(previousRecap || streak >= 2) && (
              <div style={{ color: "#9FBCC4", fontSize: 12, lineHeight: 1.45, borderTop: "1px solid #244653", paddingTop: 10 }}>
                {previousRecap}
                {previousRecap && streak >= 2 ? " · " : ""}
                {streak >= 2 ? `🔥 ${streak}-period streak` : ""}
              </div>
            )}
          </div>

          {
            <div style={{ background: gap === 0 ? "#153D35" : "#2B2A19", border: `1px solid ${gap === 0 ? "#297261" : "#5B5327"}`, borderRadius: 18, padding: 16, marginBottom: 16 }}>
              {gap === 0 ? (
                <>
                  <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 700, color: "#5FE0BB" }}>Your tally is in the green! 🌱</div>
                  <div style={{ fontSize: 12, color: "#A8CFC5", marginTop: 3 }}>Nice work keeping your routine moving.</div>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 700, color: "#FFC65E" }}>
                    You&apos;re {gap} point{gap === 1 ? "" : "s"} from green 🎯
                  </div>
                  {suggestion ? (
                    <>
                      <div style={{ color: "#E8F3F4", fontSize: 14, lineHeight: 1.5, marginTop: 8 }}>
                        Try: {suggestion.chores.map((chore) => `${chore.name} (${chore.difficulty})`).join(" + ")}
                      </div>
                      <div style={{ color: "#B9D2D8", fontSize: 12, marginTop: 3 }}>
                        {suggestion.reachesGap
                          ? `= ${suggestion.total} points`
                          : `This gets you ${suggestion.total} points closer`}
                      </div>
                      <button
                        onClick={shuffleSuggestions}
                        style={{ ...btnStyle("transparent", "#FFC65E"), padding: "8px 0 0", fontSize: 13 }}
                      >
                        🎲 Shuffle ideas
                      </button>
                    </>
                  ) : (
                    <div style={{ color: "#B9D2D8", fontSize: 13, marginTop: 6 }}>Pick any chore that needs attention to move closer.</div>
                  )}
                </>
              )}
            </div>
          }

          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Recent activity</div>
          {recent.length === 0 && <div style={{ color: "#7FA3AC", fontSize: 14 }}>Nothing logged yet. Tap a bubble to get started.</div>}
          {recent.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #1A3542" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {c.by === "service" ? "🧹 " : c.by === "reset" ? "🔄 " : ""}{c.choreName}
                </div>
                <div style={{ fontSize: 12, color: "#7FA3AC" }}>
                  {timeAgo(c.ts)}
                </div>
              </div>
              <div style={{ fontSize: 13, color: c.by === "service" || c.by === "reset" ? "#7FA3AC" : "#5FE0BB", fontWeight: 700, whiteSpace: "nowrap" }}>
                {completionImpact(view.chores.find((ch) => ch.id === c.choreId) || {}, view.completions, c)}
              </div>
              <button
                onClick={() => removeCompletion(c)}
                aria-label={`Delete ${c.choreName}`}
                style={{ ...btnStyle("#0F2530", "#FF8B7B"), padding: "5px 10px", fontSize: 13, border: "1px solid #1E4152", lineHeight: 1, flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "chores" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px" }}>
          {simDays > 0 && <div style={{ color: "#FFC65E", fontSize: 13, textAlign: "center", marginBottom: 10 }}>Preview mode is read-only.</div>}
          <button disabled={simDays > 0} onClick={() => setEditChore({ name: "", importance: 3, difficulty: 2, freqDays: 7, service: false })} style={{ ...btnStyle("#5FE0BB"), width: "100%", marginBottom: 10, opacity: simDays > 0 ? 0.45 : 1 }}>
            + Add chore
          </button>
          {view.chores.length === 0 && (
            <button disabled={simDays > 0} onClick={addStarters} style={{ ...btnStyle("#0F2530", "#B9D2D8"), width: "100%", marginBottom: 10, border: "1px solid #1E4152", opacity: simDays > 0 ? 0.45 : 1 }}>
              Load a starter list of common chores
            </button>
          )}
          {view.chores.map((ch, i) => {
            const latest = choreHistories.get(ch.id)?.[0];
            const resetEntry = latest?.by === "service" || latest?.by === "reset";
            return (
              <div
                key={ch.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${ch.name} details and history`}
                onClick={() => setEditChore(ch)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setEditChore(ch);
                  }
                }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #1A3542", cursor: "pointer" }}
              >
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: bubbleHue(i), flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{ch.name}</div>
                  <div style={{ fontSize: 12, color: "#7FA3AC" }}>
                    {impLabel(ch.importance)} importance · effort {ch.difficulty} · every {ch.freqDays}d{ch.service ? " · 🧹 service" : ""}
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      maxWidth: "100%",
                      marginTop: 6,
                      padding: "4px 8px",
                      borderRadius: 8,
                      background: latest ? (resetEntry ? "#23313A" : "#14372F") : "#142A35",
                      color: latest ? (resetEntry ? "#9FB6BC" : "#8EDCC5") : "#7FA3AC",
                      fontSize: 11.5,
                      lineHeight: 1.2,
                    }}
                  >
                    <span aria-hidden="true">{latest ? (resetEntry ? "↻" : "✓") : "○"}</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {lastDoneLabel(latest, now())}{latest ? ` · ${timeAgo(latest.ts)}` : ""}
                    </span>
                  </div>
                </div>
                <div style={{ color: "#7FA3AC" }}>›</div>
              </div>
            );
          })}

          {view.chores.length > 0 && (
            <>
              <div style={{ marginTop: 26, fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 600 }}>Board maintenance</div>
              <div style={{ fontSize: 12, color: "#7FA3AC", margin: "4px 0 10px" }}>
                Reset marks every chore as just done (no points) — handy if you were away without pausing. Clear removes all chores so you can build a fresh list.
              </div>
              <button disabled={simDays > 0} onClick={() => window.confirm("Reset all bubbles to fresh? Every chore is marked as just done — no points are awarded.") && resetBubbles()} style={{ ...btnStyle("#0F2530", "#5FE0BB"), width: "100%", marginBottom: 8, border: "1px solid #1E4152", opacity: simDays > 0 ? 0.45 : 1 }}>
                🔄 Reset all bubbles to fresh
              </button>
              <button disabled={simDays > 0} onClick={() => window.confirm("Clear all chores? This removes every chore and cannot be undone.") && clearChores()} style={{ ...btnStyle("#0F2530", "#FF8B7B"), width: "100%", border: "1px solid #1E4152", opacity: simDays > 0 ? 0.45 : 1 }}>
                🗑 Clear all chores
              </button>
            </>
          )}

          <div style={{ marginTop: 26, fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 600 }}>Solo settings</div>
          <Stepper label="Effort scale (full bar)" value={settings.weeklyGoal} min={4} max={40} onChange={(v) => commit({ type: "settings:patch", patch: { weeklyGoal: v, greenStart: Math.min(greenMin, v) } })} />
          <Stepper label="Green zone starts at" value={greenMin} min={2} max={settings.weeklyGoal} onChange={(v) => commit({ type: "settings:patch", patch: { greenStart: v } })} format={(v) => `${v} pts`} />
          <div style={{ color: "#7FA3AC", fontSize: 11.5, margin: "-4px 0 8px" }}>
            Land in the green by reaching {greenMin} of {settings.weeklyGoal} points. The full bar is a reference, not a cutoff.
          </div>
          <OwnerNameEditor settings={settings} onSave={(ownerName) => commit({ type: "settings:patch", patch: { ownerName } })} />
          <button onClick={() => window.confirm("Clear the activity log? This cannot be undone.") && resetActivity()} style={{ ...btnStyle("#0F2530", "#FF8B7B"), width: "100%", marginTop: 8, border: "1px solid #1E4152", fontSize: 13 }}>
            Clear activity log
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", borderTop: "1px solid #1A3542", background: "#0E2230", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {[
          { id: "bubbles", label: "Bubbles", icon: "🫧" },
          { id: "log", label: "The Log", icon: "📊" },
          { id: "chores", label: "Chores", icon: "📝" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ flex: 1, background: "none", border: "none", padding: "12px 0 14px", cursor: "pointer", color: tab === t.id ? "#5FE0BB" : "#7FA3AC", fontFamily: "'Baloo 2', sans-serif", fontSize: 13, fontWeight: 600, WebkitTapHighlightColor: "transparent" }}
          >
            <div style={{ fontSize: 19 }}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 92, left: "50%", transform: "translateX(-50%)", background: "#1E4152", borderRadius: 14, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 6px 24px rgba(0,0,0,0.45)", zIndex: 60, maxWidth: "92%" }}>
          <span style={{ fontSize: 14 }}>{toast.msg}</span>
          {toast.undoFn && <button onClick={toast.undoFn} style={{ background: "none", border: "none", color: "#5FE0BB", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Undo</button>}
        </div>
      )}

      {/* Simulation panel */}
      {simOpen && (
        <Modal onClose={() => setSimOpen(false)}>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Time machine 🧪</div>
          <div style={{ fontSize: 13, color: "#7FA3AC", marginBottom: 16 }}>
            Fast-forward this phone&apos;s clock to preview bubble growth and seven-day tallies. Test completions stay in a local sandbox and disappear when you return to today.
          </div>
          <div style={{ textAlign: "center", fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 700, color: simDays > 0 ? "#FFC65E" : "#E8F3F4", marginBottom: 14 }}>
            {simDays === 0 ? "Today" : `Today + ${simDays} day${simDays === 1 ? "" : "s"}`}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button onClick={() => setSim(simDays + 1)} style={{ ...btnStyle("#0F2530", "#E8F3F4"), flex: 1, border: "1px solid #1E4152" }}>+1 day</button>
            <button onClick={() => setSim(simDays + 3)} style={{ ...btnStyle("#0F2530", "#E8F3F4"), flex: 1, border: "1px solid #1E4152" }}>+3 days</button>
            <button onClick={() => setSim(simDays + 7)} style={{ ...btnStyle("#0F2530", "#E8F3F4"), flex: 1, border: "1px solid #1E4152" }}>+1 week</button>
          </div>
          <button onClick={() => setSim(0)} style={{ ...btnStyle("#5FE0BB"), width: "100%", marginBottom: 10 }}>Back to today</button>
        </Modal>
      )}

      {/* One-time explanation */}
      {introOpen && (
        <Modal onClose={dismissIntro}>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 21, fontWeight: 700, marginBottom: 14 }}>How HabitBubbles works 🫧</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, color: "#D7E7EA", fontSize: 14, lineHeight: 1.45, marginBottom: 20 }}>
            <div><strong style={{ color: "#5FE0BB" }}>1.</strong> Bubbles grow as chores become due.</div>
            <div><strong style={{ color: "#5FE0BB" }}>2.</strong> Tap a bubble when a chore is done.</div>
            <div><strong style={{ color: "#5FE0BB" }}>3.</strong> What you do stays in your tally for seven active days. Keep your effort in the green.</div>
          </div>
          <button onClick={dismissIntro} style={{ ...btnStyle("#5FE0BB"), width: "100%" }}>Got it</button>
        </Modal>
      )}

      {/* Complete chore */}
      {tapChore && (
        <Modal onClose={() => { setTapChore(null); setTapWhenDays(0); }}>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700 }}>{tapChore.name}</div>
          <div style={{ fontSize: 13, color: "#7FA3AC", margin: "4px 0 16px" }}>
            Last done {timeAgo(lastDone(tapChore, view.completions))} · worth {tapChore.difficulty} pts
          </div>
          <div style={{ fontSize: 12, color: "#7FA3AC", marginBottom: 7 }}>When was it done?</div>
          <div style={{ display: "flex", gap: 7, marginBottom: 18, flexWrap: "wrap" }}>
            {[{ d: 0, l: "Just now" }, { d: 1, l: "Yesterday" }, { d: 2, l: "2 days ago" }, { d: 3, l: "3 days ago" }].map((o) => (
              <button
                key={o.d}
                onClick={() => setTapWhenDays(o.d)}
                style={{ ...btnStyle(tapWhenDays === o.d ? "#5FE0BB" : "#0F2530", tapWhenDays === o.d ? "#0C1B26" : "#B9D2D8"), padding: "7px 12px", fontSize: 13, border: tapWhenDays === o.d ? "none" : "1px solid #1E4152" }}
              >
                {o.l}
              </button>
            ))}
          </div>
          <button onClick={() => logCompletion(tapChore)} style={{ ...btnStyle("#5FE0BB"), width: "100%" }}>
            Mark done
          </button>
        </Modal>
      )}

      {/* Cleaning service */}
      {serviceOpen && (
        <Modal onClose={() => setServiceOpen(false)}>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Cleaning service visit</div>
          <div style={{ fontSize: 13, color: "#7FA3AC", marginBottom: 14 }}>Check off what they handled. These bubbles reset without crediting your tally.</div>
          <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
            {view.chores.map((ch) => (
              <label key={ch.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid #1A3542", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={!!serviceSel[ch.id]}
                  onChange={(e) => setServiceSel({ ...serviceSel, [ch.id]: e.target.checked })}
                  style={{ width: 19, height: 19, accentColor: "#5FE0BB" }}
                />
                <span style={{ fontSize: 15 }}>{ch.name}</span>
              </label>
            ))}
          </div>
          <button onClick={confirmService} style={{ ...btnStyle("#5FE0BB"), width: "100%" }}>
            Log service visit ({Object.values(serviceSel).filter(Boolean).length} chores)
          </button>
        </Modal>
      )}

      {/* Edit / add chore */}
      {editChore && (
        <Modal onClose={() => setEditChore(null)}>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, marginBottom: 14 }}>
            {editChore.id ? "Edit chore" : "New chore"}
          </div>
          <ChoreFields value={editChore} onChange={(patch) => setEditChore({ ...editChore, ...patch })} />
          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!editChore.service}
              onChange={(e) => setEditChore({ ...editChore, service: e.target.checked })}
              style={{ width: 19, height: 19, accentColor: "#5FE0BB" }}
            />
            <span style={{ fontSize: 14, color: "#B9D2D8" }}>Cleaning service usually handles this</span>
          </label>
          {editChore.id && (
            <section style={{ marginTop: 10, paddingTop: 14, borderTop: "1px solid #244653" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700 }}>Chore history</div>
                <div style={{ color: "#7FA3AC", fontSize: 11.5 }}>
                  {editChoreHistory.length} entr{editChoreHistory.length === 1 ? "y" : "ies"}
                </div>
              </div>
              {editChoreHistory.length === 0 ? (
                <div style={{ background: "#102733", border: "1px solid #1A3B49", borderRadius: 12, padding: "12px 14px", color: "#7FA3AC", fontSize: 13 }}>
                  No completions logged yet.
                </div>
              ) : (
                <div style={{ maxHeight: 220, overflowY: "auto", background: "#102733", border: "1px solid #1A3B49", borderRadius: 12, padding: "0 12px" }}>
                  {editChoreHistory.map((entry) => {
                    const resetEntry = entry.by === "service" || entry.by === "reset";
                    return (
                      <div key={entry.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #1A3542" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: "#7FA3AC", fontSize: 11.5, marginTop: 1 }}>
                            {historyDate(entry.ts)} · {timeAgo(entry.ts)}
                          </div>
                        </div>
                        <div style={{ color: resetEntry ? "#9FB6BC" : "#5FE0BB", fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                          {completionImpact(editChore || {}, view.completions, entry)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            {editChore.id && (
              <button onClick={() => deleteChore(editChore.id)} style={{ ...btnStyle("#0F2530", "#FF8B7B"), flex: 1, border: "1px solid #1E4152" }}>Delete</button>
            )}
            <button
              onClick={() => {
                if (editChore.name.trim()) saveChore(editChore);
              }}
              style={{
                ...btnStyle("#5FE0BB"),
                flex: 2,
                opacity: editChore.name.trim() ? 1 : 0.5,
              }}
            >
              Save chore
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
