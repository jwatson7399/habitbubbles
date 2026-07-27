import React from "react";
import {
  rhythmScore,
  rhythmZone,
  attainment,
  attainmentStats,
  quotaStreak,
  DEFAULT_RHYTHM_WINDOW_DAYS,
} from "../model/rhythmModel.js";
import { habitHistoryFor, completionImpact } from "../model/habitHistory.js";
import { now as clockNow } from "../utils/clock.js";
import { timeAgo } from "../utils/format.js";
import { btnStyle } from "../components/controls.jsx";
import RhythmBar from "../components/RhythmBar.jsx";
import { theme } from "../theme.js";

// A streak counts consecutive qualifying *periods*, never days — a habit that
// asks for 2-per-week and lands its quota six weeks running is a "6-week
// streak," not a "6-day streak." Daily habits are the one cadence where a
// period genuinely is a day, so "day" is still the right word there. Any
// other cadence (biweekly, monthly-ish) falls back to the generic "period"
// rather than guessing at a word that could be wrong.
export function periodUnit(periodDays) {
  if (periodDays === 1) return "day";
  if (periodDays === 7) return "week";
  return "period";
}

// ---------- Log screen ----------
// Replaces the chore-era "0/14 points" tally with rhythm: a fortnight-window
// score across all habits, per-habit attainment against each habit's own
// cadence, and a plain activity feed. No points or effort tally anywhere.
export default function LogScreen({ habits, completions, rhythmWindowDays, greenStart, onRemoveCompletion }) {
  const at = clockNow();
  const windowDays = rhythmWindowDays || DEFAULT_RHYTHM_WINDOW_DAYS;
  const activeHabits = (habits || []).filter((h) => !h.archived);

  const score = rhythmScore(habits, completions, at, windowDays);
  const zone = score == null ? null : rhythmZone(score, greenStart);
  const zoneColor = !zone ? theme.textMuted : zone.key === "green" ? theme.zoneTop : zone.key === "amber" ? theme.zoneMiddle : theme.zoneBehind;

  const recent = activeHabits
    .flatMap((habit) => habitHistoryFor(completions, habit.id).map((entry) => ({ entry, habit })))
    .sort((a, b) => b.entry.at - a.entry.at)
    .slice(0, 30);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 26px" }}>
      {/* Rhythm header */}
      <div style={{ background: `linear-gradient(145deg, ${theme.surfaceRaised}, ${theme.surface})`, border: `1px solid ${theme.borderStrong}`, borderRadius: 18, padding: "16px 16px 14px", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 20, fontWeight: 700 }}>Your rhythm</div>
        <div style={{ color: theme.textMuted, fontSize: 12.5, marginBottom: 10 }}>Last {windowDays} days</div>
        {score == null ? (
          <div style={{ color: theme.textMuted, fontSize: 14, padding: "6px 0" }}>
            🌱 Warming up — rhythm shows once a habit has run a full period.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
              <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 26, fontWeight: 700, color: zoneColor }}>
                {Math.round(score * 100)}%
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: zoneColor, whiteSpace: "nowrap" }}>
                {zone.label}
              </span>
            </div>
            <RhythmBar score={score} greenStart={greenStart} height={12} />
          </>
        )}
      </div>

      {/* Per-habit rows */}
      <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Habits</div>
      {activeHabits.length === 0 && (
        <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 16 }}>No habits yet.</div>
      )}
      {activeHabits.map((habit) => {
        const habitScore = attainment(habit, completions, at, windowDays);
        const streak = quotaStreak(habit, completions, at);
        const rawStats = attainmentStats(habit, completions, at, windowDays);
        const stats = rawStats && { credited: rawStats.credited, expected: Math.round(rawStats.expected) };
        return (
          <div key={habit.id} style={{ padding: "10px 0", borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {habit.name}
              </span>
              {stats && (
                <span style={{ fontSize: 13, color: theme.textDim, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {stats.credited} / {stats.expected}
                </span>
              )}
            </div>
            <RhythmBar score={habitScore} greenStart={greenStart} height={8} />
            {streak >= 2 && (
              <div style={{ color: theme.zoneMiddle, fontSize: 12, marginTop: 5, fontWeight: 700 }}>
                🔥 {streak}-{periodUnit(habit.periodDays)} streak
              </div>
            )}
          </div>
        );
      })}

      {/* Recent activity */}
      <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 700, margin: "18px 0 8px" }}>Recent activity</div>
      {recent.length === 0 && <div style={{ color: theme.textMuted, fontSize: 14 }}>Nothing logged yet. Tap a bubble to get started.</div>}
      {recent.map(({ entry, habit }) => {
        const impact = completionImpact(habit, completions, entry);
        return (
          <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{habit.name}</div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>{timeAgo(entry.at, at)}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: impact === "extra" ? theme.zoneMiddle : theme.zoneTop, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 0.3 }}>
              {impact}
            </span>
            <button
              onClick={() => onRemoveCompletion(entry)}
              aria-label={`Delete ${habit.name} completion`}
              style={{ ...btnStyle(theme.surface, theme.zoneBehind), padding: "5px 10px", fontSize: 13, border: `1px solid ${theme.border}`, lineHeight: 1, flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
