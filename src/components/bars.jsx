import React from "react";
import { effortZone } from "../logModel.js";

// Slim zoned bar for the Bubbles tab, so popping a bubble shows your tally move
// without leaving the screen. The full breakdown still lives on the Log tab.
export function CompactBar({ name, points, goal, greenStart, paused = false }) {
  const safeGoal = Math.max(Number(goal) || 0, 1);
  const zone = effortZone(points, safeGoal, greenStart);
  const percent = Math.max(0, Math.min((points / safeGoal) * 100, 100));
  const buildingPct = Math.round((zone.buildingMin / zone.fullScale) * 100);
  const greenPct = Math.round((zone.greenMin / zone.fullScale) * 100);
  return (
    <div style={{ flex: 1, minWidth: 0, opacity: paused ? 0.62 : 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#E8F3F4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}{paused ? " 🏖" : ""}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: zone.color, whiteSpace: "nowrap" }}>{points}/{goal}</span>
      </div>
      <div aria-hidden="true" style={{ textAlign: "center", fontSize: 11, lineHeight: 1, marginBottom: 2 }}>{zone.emoji}</div>
      <div style={{ position: "relative", height: 7, borderRadius: 5, background: `linear-gradient(to right, #FF8B7B30 0 ${buildingPct}%, #FFC65E30 ${buildingPct}% ${greenPct}%, #5FE0BB30 ${greenPct}% 100%)`, border: "1px solid #1E4152", overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", borderRadius: 5, background: zone.color, transition: "width 0.6s ease, background 0.3s ease" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: `0 auto 0 ${buildingPct}%`, width: 1, background: "#D8E9EC55" }} />
        <div aria-hidden="true" style={{ position: "absolute", inset: `0 auto 0 ${greenPct}%`, width: 1, background: "#D8E9EC88" }} />
      </div>
    </div>
  );
}

export function ProgressRow({ label, points, goal, hue, paused = false, prominent = false, zoned = false, greenStart }) {
  const safeGoal = Math.max(Number(goal) || 0, 1);
  const percent = Math.max(0, Math.min((points / safeGoal) * 100, 100));
  const zone = zoned ? effortZone(points, safeGoal, greenStart) : null;
  const complete = zoned ? zone.key === "green" : points >= safeGoal;
  const fillColor = zone?.color || hue;
  // Place the visual zone bands at the actual thresholds (green start is configurable)
  const buildingPct = zone ? Math.round((zone.buildingMin / zone.fullScale) * 100) : 40;
  const greenPct = zone ? Math.round((zone.greenMin / zone.fullScale) * 100) : 80;

  return (
    <div style={{ padding: prominent ? "14px 0 12px" : "12px 0", opacity: paused ? 0.72 : 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: prominent ? 18 : 16, fontWeight: 700, color: "#E8F3F4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {label}
          </span>
          {paused && <span style={{ color: "#9FD4EA", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>🏖 away</span>}
          {zone && (
            <span
              key={zone.key}
              style={{
                color: zone.color,
                background: `${zone.color}18`,
                border: `1px solid ${zone.color}66`,
                borderRadius: 999,
                padding: "2px 7px",
                fontSize: 10.5,
                lineHeight: 1.2,
                fontWeight: 800,
                whiteSpace: "nowrap",
                animation: zone.key === "green" ? "greenArrival 0.7s ease-out" : "none",
              }}
            >
              {zone.label}
            </span>
          )}
        </div>
        <span style={{ color: complete ? "#5FE0BB" : paused ? "#9FD4EA" : "#B9D2D8", fontSize: prominent ? 16 : 14, fontWeight: 700, whiteSpace: "nowrap" }}>
          {points} / {goal}{zoned && complete ? " 🌱" : !zoned && complete ? " ✓" : ""}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}: ${points} of ${goal} points${zone ? `, ${zone.label} zone` : ""}${paused ? ", away" : ""}`}
        aria-valuemin={0}
        aria-valuemax={safeGoal}
        aria-valuenow={Math.min(points, safeGoal)}
        style={{
          position: "relative",
          height: prominent ? 13 : 12,
          borderRadius: 8,
          background: zoned
            ? `linear-gradient(to right, #FF8B7B30 0 ${buildingPct}%, #FFC65E30 ${buildingPct}% ${greenPct}%, #5FE0BB30 ${greenPct}% 100%)`
            : "#0F2530",
          border: "1px solid #1E4152",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: 8,
            background: `linear-gradient(to right, ${fillColor}99, ${fillColor})`,
            boxShadow: complete ? `0 0 12px ${fillColor}88` : "none",
            transition: "width 0.7s ease, background 0.35s ease",
          }}
        />
        {zoned && (
          <>
            <div aria-hidden="true" style={{ position: "absolute", inset: `0 auto 0 ${buildingPct}%`, width: 1, background: "#D8E9EC55" }} />
            <div aria-hidden="true" style={{ position: "absolute", inset: `0 auto 0 ${greenPct}%`, width: 1, background: "#D8E9EC88" }} />
          </>
        )}
      </div>
    </div>
  );
}
