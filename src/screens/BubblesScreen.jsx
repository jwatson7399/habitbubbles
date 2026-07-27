import React, { useState } from "react";
import { DAY } from "../model/habitData.js";
import { canLogCompletion } from "../model/habitSchema.js";
import { periodKey, currentPeriodKey } from "../model/habitPeriods.js";
import { attainment, quotaStreak, rhythmZone } from "../model/rhythmModel.js";
import { habitHistoryFor, completionImpact } from "../model/habitHistory.js";
import { rankSuggestions } from "../model/suggestNow.js";
import { now as clockNow } from "../utils/clock.js";
import { timeAgo } from "../utils/format.js";
import { Modal } from "../components/Modal.jsx";
import { btnStyle } from "../components/controls.jsx";
import BubbleField from "../components/BubbleField.jsx";
import { theme } from "../theme.js";

// How a period reads in plain language, for the completion sheet's quota line
// ("1 of 2 this week"). Habits era-appropriate cadences (daily, every-other-day,
// weekly) get a friendly name; anything odd falls back to a day count rather
// than guessing at "month"/"year" words that could be wrong.
function periodLabel(periodDays) {
  if (periodDays === 1) return "today";
  if (periodDays === 7) return "this week";
  if (periodDays % 7 === 0) return `these ${periodDays / 7} weeks`;
  return `these ${periodDays} days`;
}

// Completions logged in the habit's *current* anchored period, out of its
// quota — the reason a speck-sized bubble is still legible: tap it and the
// sheet spells out both the full name and exactly where it stands.
function quotaProgress(habit, completions, now) {
  const key = currentPeriodKey(habit, now);
  const done = (completions || []).filter(
    (c) => c.habitId === habit.id && periodKey(habit, c.at) === key
  ).length;
  return { done, quota: habit.quota, label: periodLabel(habit.periodDays) };
}

function periodEndingLabel(habit, now) {
  const period = habit.periodDays * DAY;
  const end = habit.anchorAt + (currentPeriodKey(habit, now) + 1) * period;
  const days = Math.max(1, Math.ceil((end - now) / DAY));
  return `Period ends in ${days} day${days === 1 ? "" : "s"}`;
}

// ---------- Bubbles screen ----------
// Habits render as physics bubbles sized by how due they are. Tap one to log
// it; "What should I do now?" highlights the single best next habit instead
// of the chore-era shuffle-a-combo suggestion.
export default function BubblesScreen({ habits, completions, simDays, popId, onComplete, showToast }) {
  const [tapHabit, setTapHabit] = useState(null);
  const [tapWhenDays, setTapWhenDays] = useState(0);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [suggestedHabitId, setSuggestedHabitId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const openSheet = (habit) => {
    setTapWhenDays(0);
    setHistoryOpen(false);
    setTapHabit(habit);
  };
  const closeSheet = () => {
    setTapHabit(null);
    setTapWhenDays(0);
    setHistoryOpen(false);
  };

  const markDone = () => {
    if (!tapHabit) return;
    if (!canLogCompletion(tapHabit, clockNow() - tapWhenDays * DAY)) {
      showToast("That's before this habit started tracking.");
      return;
    }
    if (onComplete(tapHabit, tapWhenDays)) {
      if (suggestedHabitId === tapHabit.id) setSuggestedHabitId(null);
      closeSheet();
    }
  };

  const suggestions = rankSuggestions(habits, completions, clockNow());
  const canSuggest = suggestions.length > 0;
  const suggestNow = () => {
    if (!canSuggest) return;
    const index = suggestIndex % suggestions.length;
    const habit = suggestions[index];
    setSuggestedHabitId(habit.id);
    setSuggestIndex(index + 1);
    showToast(`Try: ${habit.name}`);
  };

  const suggestedIds = new Set(suggestedHabitId ? [suggestedHabitId] : []);
  const progress = tapHabit ? quotaProgress(tapHabit, completions, clockNow()) : null;
  const tapHistory = tapHabit ? habitHistoryFor(completions, tapHabit.id) : [];
  const tapNow = clockNow();
  const tapAttainment = tapHabit ? attainment(tapHabit, completions, tapNow) : null;
  const tapStreak = tapHabit ? quotaStreak(tapHabit, completions, tapNow) : 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {simDays > 0 && (
        <div style={{ margin: "4px 20px 0", padding: "9px 14px", background: `${theme.zoneMiddle}1A`, border: `1px solid ${theme.zoneMiddle}55`, borderRadius: 12, fontSize: 13, color: theme.zoneMiddle, textAlign: "center" }}>
          🧪 Time machine — tap bubbles to test. Nothing here is saved.
        </div>
      )}
      <BubbleField
        habits={habits}
        completions={completions}
        onTap={openSheet}
        popId={popId}
        simDays={simDays}
        suggestedIds={suggestedIds}
      />
      <div style={{ padding: "0 20px 10px" }}>
        <button
          disabled={!canSuggest}
          onClick={suggestNow}
          aria-label="What should I do now?"
          style={{
            ...btnStyle(suggestedHabitId ? theme.suggestBg : theme.surface, theme.suggest),
            width: "100%",
            border: `1px solid ${suggestedHabitId ? theme.suggest : theme.suggestDim}`,
            opacity: canSuggest ? 1 : 0.45,
          }}
        >
          ✨ What should I do now?
        </button>
      </div>

      {tapHabit && (
        <Modal onClose={closeSheet} title={tapHabit.name}>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700 }}>{tapHabit.name}</div>
          <div style={{ fontSize: 13, color: theme.textMuted, margin: "4px 0 16px" }}>
            {progress.done} of {progress.quota} {progress.label}
          </div>
          {tapHabit.details && (
            <div style={{ margin: "0 0 16px", padding: "11px 13px", background: theme.night, border: `1px solid ${theme.surfaceRaised}`, borderRadius: 12, color: theme.text, fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {tapHabit.details}
            </div>
          )}
          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 7 }}>When was it done?</div>
          <div style={{ display: "flex", gap: 7, marginBottom: 18, flexWrap: "wrap" }}>
            {[{ d: 0, l: "Just now" }, { d: 1, l: "Yesterday" }, { d: 2, l: "2 days ago" }, { d: 3, l: "3 days ago" }].map((o) => (
              <button
                key={o.d}
                onClick={() => setTapWhenDays(o.d)}
                style={{ ...btnStyle(tapWhenDays === o.d ? theme.zoneTop : theme.surface, tapWhenDays === o.d ? theme.night : theme.textDim), padding: "7px 12px", fontSize: 13, border: tapWhenDays === o.d ? "none" : `1px solid ${theme.border}` }}
              >
                {o.l}
              </button>
            ))}
          </div>
          <button onClick={markDone} style={{ ...btnStyle(theme.zoneTop), width: "100%" }}>
            Mark done
          </button>
          <button
            type="button"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((open) => !open)}
            style={{ width: "100%", marginTop: 12, padding: "10px 2px", border: "none", borderTop: `1px solid ${theme.borderStrong}`, background: "transparent", color: theme.textDim, font: "inherit", fontSize: 13.5, fontWeight: 700, textAlign: "left", cursor: "pointer" }}
          >
            {historyOpen ? "▾" : "▸"} Status &amp; history
          </button>
          {historyOpen && (
            <section style={{ paddingTop: 4 }}>
              <div style={{ display: "grid", gap: 7, marginBottom: 14, padding: "11px 13px", background: theme.night, border: `1px solid ${theme.surfaceRaised}`, borderRadius: 12, fontSize: 12.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: theme.textMuted }}>Timing</span><strong>{periodEndingLabel(tapHabit, tapNow)}</strong></div>
                {tapHistory[0] && <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: theme.textMuted }}>Last done</span><strong>✓ {timeAgo(tapHistory[0].at, tapNow)}</strong></div>}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: theme.textMuted }}>Rhythm</span><strong>{tapAttainment === null ? "warming up" : `${Math.round(tapAttainment * 100)}% ${rhythmZone(tapAttainment).emoji}`}</strong></div>
                {tapStreak >= 2 && <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: theme.textMuted }}>Streak</span><strong>🔥 {tapStreak} periods</strong></div>}
              </div>
              <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>Recent history</div>
              {tapHistory.length === 0 ? (
                <div style={{ color: theme.textMuted, fontSize: 12.5 }}>No completions logged yet.</div>
              ) : (
                <div style={{ background: theme.night, border: `1px solid ${theme.surfaceRaised}`, borderRadius: 12, padding: "0 12px" }}>
                  {tapHistory.slice(0, 8).map((entry) => (
                    <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: `1px solid ${theme.border}` }}>
                      <span style={{ color: theme.textMuted, fontSize: 12 }}>{timeAgo(entry.at, tapNow)}</span>
                      <strong style={{ color: theme.zoneTop, fontSize: 12 }}>{completionImpact(tapHabit, completions, entry)}</strong>
                    </div>
                  ))}
                  {tapHistory.length > 8 && <div style={{ padding: "9px 0", color: theme.textMuted, fontSize: 12 }}>+ {tapHistory.length - 8} earlier</div>}
                </div>
              )}
            </section>
          )}
        </Modal>
      )}
    </div>
  );
}
