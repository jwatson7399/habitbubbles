import React from "react";
import { Stepper, ScaleSelector } from "./controls.jsx";
import { habitHistoryFor, lastDoneLabel, completionImpact } from "../model/habitHistory.js";
import { timeAgo, historyDate } from "../utils/format.js";
import { now as clockNow } from "../utils/clock.js";
import { theme } from "../theme.js";

const importanceText = (level) => ["", "Low", "Mild", "Medium", "High", "Critical"][level];
const effortText = (level) => ["", "Very easy", "Easy", "Moderate", "Hard", "Very hard"][level];

function timesWord(n) {
  if (n === 1) return "once";
  if (n === 2) return "twice";
  return `${n} times`;
}

// Plain-language cadence, shared by the editor's schedule preview and the
// habit list's row copy — no user-visible screen should ever print raw N/P.
export function cadenceLabel(quota, periodDays) {
  if (quota === 1 && periodDays === 1) return "daily";
  if (quota === 1 && periodDays === 2) return "every other day";
  if (quota === 1 && periodDays % 7 === 0) {
    const weeks = periodDays / 7;
    return weeks === 1 ? "weekly" : `every ${weeks} weeks`;
  }
  if (quota === 1) return `every ${periodDays} days`;
  if (periodDays === 7) return `${timesWord(quota)} a week`;
  if (periodDays === 1) return `${timesWord(quota)} a day`;
  if (periodDays % 7 === 0) return `${timesWord(quota)} every ${periodDays / 7} weeks`;
  return `${timesWord(quota)} every ${periodDays} days`;
}

// The full field set for a habit: name, importance/effort scales, and the
// quota/period pair that defines its cadence. Also renders a plain-language
// preview of that cadence and, for a habit that already exists, its history —
// so the same panel that edits a habit is the one that shows how it's going.
export function HabitEditor({ value, onChange, completions }) {
  const history = value.id ? habitHistoryFor(completions, value.id) : [];
  const detailsLength = typeof value.details === "string" ? value.details.length : 0;

  return (
    <section>
      <input
        value={value.name}
        placeholder="Habit name"
        onChange={(event) => onChange({ name: event.target.value })}
        style={{ width: "100%", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "12px 14px", color: theme.text, fontSize: 15, fontFamily: "inherit", marginBottom: 6 }}
      />
      <ScaleSelector
        label="Importance"
        hint="How much does it matter if this slips?"
        value={value.importance}
        min={1}
        max={5}
        onChange={(importance) => onChange({ importance })}
        valueLabel={importanceText}
        endLabels={["Low", "Critical"]}
      />
      <ScaleSelector
        label="Effort"
        hint="How much time or energy does this take?"
        value={value.effort}
        min={1}
        max={5}
        onChange={(effort) => onChange({ effort })}
        valueLabel={effortText}
        endLabels={["Very easy", "Very hard"]}
      />
      <Stepper label="Quota" value={value.quota} min={1} max={20} onChange={(quota) => onChange({ quota })} format={(n) => `${n}×`} />
      <Stepper label="Per (days)" value={value.periodDays} min={1} max={60} onChange={(periodDays) => onChange({ periodDays })} format={(n) => `${n}d`} />

      <div style={{ marginTop: 4, marginBottom: 14, padding: "10px 14px", background: theme.night, border: `1px solid ${theme.surfaceRaised}`, borderRadius: 12, color: theme.zoneTop, fontSize: 13.5, fontWeight: 600 }}>
        This means: {cadenceLabel(value.quota, value.periodDays)}
      </div>

      <label style={{ display: "block", marginBottom: 14 }}>
        <span style={{ display: "block", color: theme.text, fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
          Details
        </span>
        <textarea
          rows={3}
          value={typeof value.details === "string" ? value.details : ""}
          placeholder="What counts as done? e.g. includes wiping the sink"
          onChange={(event) => onChange({ details: event.target.value })}
          style={{ width: "100%", resize: "vertical", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "12px 14px", color: theme.text, fontSize: 14, lineHeight: 1.45, fontFamily: "inherit", outline: "none" }}
        />
        {detailsLength > 400 && (
          <span style={{ display: "block", marginTop: 4, color: detailsLength > 500 ? theme.danger : theme.textMuted, fontSize: 11.5, textAlign: "right" }}>
            {detailsLength} / 500{detailsLength > 500 ? " · extra text will be trimmed" : ""}
          </span>
        )}
      </label>

      {value.id && (
        <section style={{ marginTop: 10, paddingTop: 14, borderTop: `1px solid ${theme.borderStrong}` }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
            <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 16, fontWeight: 700 }}>History</div>
            <div style={{ color: theme.textMuted, fontSize: 11.5 }}>
              {history.length} entr{history.length === 1 ? "y" : "ies"} · {lastDoneLabel(history[0], clockNow())}
            </div>
          </div>
          {history.length === 0 ? (
            <div style={{ background: theme.night, border: `1px solid ${theme.surfaceRaised}`, borderRadius: 12, padding: "12px 14px", color: theme.textMuted, fontSize: 13 }}>
              No completions logged yet.
            </div>
          ) : (
            <div style={{ maxHeight: 220, overflowY: "auto", background: theme.night, border: `1px solid ${theme.surfaceRaised}`, borderRadius: 12, padding: "0 12px" }}>
              {history.map((entry) => (
                <div key={entry.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: `1px solid ${theme.border}` }}>
                  <div style={{ color: theme.textMuted, fontSize: 11.5 }}>
                    {historyDate(entry.at)} · {timeAgo(entry.at)}
                  </div>
                  <div style={{ color: theme.zoneTop, fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" }}>
                    {completionImpact(value, completions, entry)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
