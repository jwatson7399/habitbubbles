import React, { useState } from "react";
import { DAY } from "../model/habitData.js";
import { canLogCompletion } from "../model/habitSchema.js";
import { periodKey, currentPeriodKey } from "../model/habitPeriods.js";
import { rankSuggestions } from "../model/suggestNow.js";
import { now as clockNow } from "../utils/clock.js";
import { Modal } from "../components/Modal.jsx";
import { btnStyle } from "../components/controls.jsx";
import BubbleField from "../components/BubbleField.jsx";

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

// ---------- Bubbles screen ----------
// Habits render as physics bubbles sized by how due they are. Tap one to log
// it; "What should I do now?" highlights the single best next habit instead
// of the chore-era shuffle-a-combo suggestion.
export default function BubblesScreen({ habits, completions, simDays, popId, onComplete, showToast }) {
  const [tapHabit, setTapHabit] = useState(null);
  const [tapWhenDays, setTapWhenDays] = useState(0);
  const [suggestIndex, setSuggestIndex] = useState(0);
  const [suggestedHabitId, setSuggestedHabitId] = useState(null);

  const openSheet = (habit) => {
    setTapWhenDays(0);
    setTapHabit(habit);
  };
  const closeSheet = () => {
    setTapHabit(null);
    setTapWhenDays(0);
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

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {simDays > 0 && (
        <div style={{ margin: "4px 20px 0", padding: "9px 14px", background: "#3B3215", border: "1px solid #6E5C21", borderRadius: 12, fontSize: 13, color: "#FFC65E", textAlign: "center" }}>
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
            ...btnStyle(suggestedHabitId ? "#3B3415" : "#0F2530", "#FFE27A"),
            width: "100%",
            border: `1px solid ${suggestedHabitId ? "#C9A92C" : "#554B25"}`,
            opacity: canSuggest ? 1 : 0.45,
          }}
        >
          ✨ What should I do now?
        </button>
      </div>

      {tapHabit && (
        <Modal onClose={closeSheet}>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700 }}>{tapHabit.name}</div>
          <div style={{ fontSize: 13, color: "#7FA3AC", margin: "4px 0 16px" }}>
            {progress.done} of {progress.quota} {progress.label}
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
          <button onClick={markDone} style={{ ...btnStyle("#5FE0BB"), width: "100%" }}>
            Mark done
          </button>
        </Modal>
      )}
    </div>
  );
}
