import React, { useState } from "react";
import { STARTER_HABITS } from "../model/habitData.js";
import { normalizeHabit, archiveHabit, unarchiveHabit } from "../model/habitSchema.js";
import { habitHistoryFor, lastDoneLabel } from "../model/habitHistory.js";
import { now as clockNow } from "../utils/clock.js";
import { Modal } from "../components/Modal.jsx";
import { btnStyle } from "../components/controls.jsx";
import { HabitEditor, cadenceLabel } from "../components/HabitEditor.jsx";
import { bubbleHue } from "../components/BubbleField.jsx";
import { theme } from "../theme.js";

const BLANK_HABIT = { name: "", importance: 3, effort: 3, quota: 1, periodDays: 1 };

// ---------- Habits screen ----------
// The list of habits themselves: cadence spelled out in words, a last-done
// banner per habit, and an editor sheet for name/importance/effort/quota/
// period. Archive (reversible) and delete (destructive, confirmed, cascades
// to completions) are both editor actions, never a silent swipe.
export default function HabitsScreen({
  habits,
  completions,
  simDays,
  onSaveHabit,
  onDeleteHabit,
  onAddManyHabits,
  // Settings render inside this screen's scroll container, after the list.
  // As a sibling they competed with the list for height, leaving the habits
  // stuck in a short scroll window with settings pinned below it.
  children,
}) {
  const [editing, setEditing] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = (habits || []).filter((h) => !h.archived);
  const archived = (habits || []).filter((h) => h.archived);

  const readOnly = simDays > 0;
  const openNew = () => setEditing({ ...BLANK_HABIT });
  const openExisting = (habit) => setEditing({ ...habit });
  const close = () => setEditing(null);

  const loadStarters = () => {
    onAddManyHabits(STARTER_HABITS.map((h) => normalizeHabit(h, clockNow())));
  };

  const save = () => {
    if (!editing.name.trim()) return;
    onSaveHabit(normalizeHabit(editing, clockNow()));
    close();
  };

  const archive = () => {
    onSaveHabit(normalizeHabit(archiveHabit(editing), clockNow()));
    close();
  };

  const unarchive = () => {
    onSaveHabit(normalizeHabit(unarchiveHabit(editing, clockNow()), clockNow()));
    close();
  };

  const remove = () => {
    const history = habitHistoryFor(completions, editing.id);
    const warning = history.length
      ? `Delete "${editing.name}"? This also removes its ${history.length} logged completion${history.length === 1 ? "" : "s"}. This cannot be undone.`
      : `Delete "${editing.name}"? This cannot be undone.`;
    if (window.confirm(warning)) {
      onDeleteHabit(editing.id);
      close();
    }
  };

  const row = (habit, i) => {
    const latest = habitHistoryFor(completions, habit.id)[0];
    return (
      <div
        key={habit.id}
        role="button"
        tabIndex={readOnly ? -1 : 0}
        aria-disabled={readOnly}
        aria-label={`Open ${habit.name} details and history`}
        onClick={() => { if (!readOnly) openExisting(habit); }}
        onKeyDown={(event) => {
          if (readOnly) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openExisting(habit);
          }
        }}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${theme.border}`, cursor: readOnly ? "default" : "pointer", opacity: readOnly ? 0.6 : 1 }}
      >
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: bubbleHue(i), flexShrink: 0, opacity: habit.archived ? 0.4 : 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{habit.name}</div>
          <div style={{ fontSize: 12, color: theme.textMuted }}>{cadenceLabel(habit.quota, habit.periodDays)}</div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              maxWidth: "100%",
              marginTop: 6,
              padding: "4px 8px",
              borderRadius: 8,
              background: latest ? theme.surfaceRaised : theme.surface,
              color: latest ? theme.zoneTopSoft : theme.textMuted,
              border: latest ? `1px solid ${theme.zoneTop}` : "none",
              fontSize: 11.5,
              lineHeight: 1.2,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {lastDoneLabel(latest, clockNow())}
            </span>
          </div>
        </div>
        <div style={{ color: theme.textMuted }}>›</div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px 20px" }}>
      {readOnly && <div style={{ color: theme.zoneMiddle, fontSize: 13, textAlign: "center", marginBottom: 10 }}>Preview mode is read-only.</div>}

      <button disabled={readOnly} onClick={openNew} style={{ ...btnStyle(theme.zoneTop), width: "100%", marginBottom: 10, opacity: readOnly ? 0.45 : 1 }}>
        + Add habit
      </button>
      {habits.length === 0 && (
        <button disabled={readOnly} onClick={loadStarters} style={{ ...btnStyle(theme.surface, theme.textDim), width: "100%", marginBottom: 10, border: `1px solid ${theme.border}`, opacity: readOnly ? 0.45 : 1 }}>
          Load my starter habits
        </button>
      )}

      {active.length === 0 && habits.length > 0 && (
        <div style={{ color: theme.textMuted, fontSize: 14, padding: "10px 0" }}>No active habits — everything's archived.</div>
      )}
      {active.map(row)}

      {archived.length > 0 && (
        <>
          <button
            onClick={() => setShowArchived((v) => !v)}
            style={{ ...btnStyle(theme.surface, theme.textMuted), width: "100%", marginTop: 20, border: `1px solid ${theme.border}`, fontSize: 13 }}
          >
            {showArchived ? "▾" : "▸"} Archived ({archived.length})
          </button>
          {showArchived && archived.map(row)}
        </>
      )}

      {children}

      {editing && (
        <Modal onClose={close} title={editing.id ? "Edit habit" : "New habit"}>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 19, fontWeight: 700, marginBottom: 14 }}>
            {editing.id ? "Edit habit" : "New habit"}
          </div>
          <HabitEditor value={editing} onChange={(patch) => setEditing({ ...editing, ...patch })} completions={completions} />
          {readOnly && <div style={{ color: theme.zoneMiddle, fontSize: 12.5, marginTop: 10 }}>Preview mode is read-only — changes here won&apos;t be saved.</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            {editing.id && !editing.archived && (
              <button disabled={readOnly} onClick={archive} style={{ ...btnStyle(theme.surface, theme.zoneMiddle), flex: 1, border: `1px solid ${theme.border}`, opacity: readOnly ? 0.45 : 1 }}>Archive</button>
            )}
            {editing.id && editing.archived && (
              <button disabled={readOnly} onClick={unarchive} style={{ ...btnStyle(theme.surface, theme.zoneTop), flex: 1, border: `1px solid ${theme.border}`, opacity: readOnly ? 0.45 : 1 }}>Unarchive</button>
            )}
            {editing.id && (
              <button disabled={readOnly} onClick={remove} style={{ ...btnStyle(theme.surface, theme.zoneBehind), flex: 1, border: `1px solid ${theme.border}`, opacity: readOnly ? 0.45 : 1 }}>Delete</button>
            )}
            <button
              disabled={readOnly}
              onClick={save}
              style={{ ...btnStyle(theme.zoneTop), flex: 2, opacity: readOnly ? 0.45 : editing.name.trim() ? 1 : 0.5 }}
            >
              Save habit
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
