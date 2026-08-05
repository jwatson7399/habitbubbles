import React from "react";
import { dateInputValue, localDateTime, timeInputValue } from "../model/completionTime.js";
import { theme } from "../theme.js";

const inputStyle = {
  width: "100%",
  minWidth: 0,
  padding: "10px 11px",
  borderRadius: 10,
  border: `1px solid ${theme.border}`,
  background: theme.night,
  color: theme.text,
  colorScheme: "dark",
  font: "inherit",
  fontSize: 14,
};

export default function CompletionTimeFields({ value, onChange, max }) {
  const dateValue = dateInputValue(value);
  const timeValue = timeInputValue(value);

  const update = (nextDate, nextTime) => {
    const timestamp = localDateTime(nextDate, nextTime);
    if (Number.isFinite(timestamp)) onChange(timestamp);
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 0.9fr)", gap: 8 }}>
      <label style={{ display: "grid", gap: 5, color: theme.textMuted, fontSize: 11.5 }}>
        Date
        <input
          type="date"
          value={dateValue}
          max={dateInputValue(max)}
          onChange={(event) => update(event.target.value, timeValue)}
          style={inputStyle}
        />
      </label>
      <label style={{ display: "grid", gap: 5, color: theme.textMuted, fontSize: 11.5 }}>
        Time
        <input
          type="time"
          value={timeValue}
          onChange={(event) => update(dateValue, event.target.value)}
          style={inputStyle}
        />
      </label>
    </div>
  );
}
