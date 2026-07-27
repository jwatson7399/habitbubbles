import React from "react";
import { theme } from "../theme.js";

export const btnStyle = (bg, color = theme.night) => ({
  background: bg,
  color,
  border: "none",
  borderRadius: 14,
  padding: "13px 18px",
  fontSize: 15,
  fontFamily: "'Baloo 2', sans-serif",
  fontWeight: 600,
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
});

export function Stepper({ label, value, min, max, step = 1, onChange, format }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
      <span style={{ color: theme.textDim, fontSize: 14 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => onChange(Math.max(min, value - step))} style={{ ...btnStyle(theme.surface, theme.zoneTop), padding: "6px 14px", fontSize: 18 }}>-</button>
        <span style={{ color: theme.text, fontSize: 15, minWidth: 56, textAlign: "center", fontWeight: 600 }}>{format ? format(value) : value}</span>
        <button onClick={() => onChange(Math.min(max, value + step))} style={{ ...btnStyle(theme.surface, theme.zoneTop), padding: "6px 14px", fontSize: 18 }}>+</button>
      </div>
    </div>
  );
}

// A full 1-N scale where every step is visible and tappable, so you can see
// where your choice sits on the whole range instead of clicking a dial.
export function ScaleSelector({ label, hint, value, min, max, onChange, valueLabel, endLabels }) {
  const options = [];
  for (let i = min; i <= max; i++) options.push(i);
  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>{label}</span>
        {valueLabel && <span style={{ color: theme.zoneTop, fontSize: 13, fontWeight: 700 }}>{valueLabel(value)}</span>}
      </div>
      {hint && <div style={{ color: theme.textMuted, fontSize: 11.5, marginTop: 2 }}>{hint}</div>}
      <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
        {options.map((n) => {
          const active = n === value;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              aria-pressed={active}
              style={{
                flex: 1,
                padding: "11px 0",
                borderRadius: 10,
                border: active ? "none" : `1px solid ${theme.border}`,
                background: active ? theme.zoneTop : theme.surface,
                color: active ? theme.night : theme.textDim,
                fontFamily: "'Baloo 2', sans-serif",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {endLabels && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, color: theme.textMuted, fontSize: 10.5 }}>
          <span>{endLabels[0]}</span>
          <span>{endLabels[1]}</span>
        </div>
      )}
    </div>
  );
}
