import React from "react";
import { rhythmZone, AMBER_START, DEFAULT_GREEN_START } from "../model/rhythmModel.js";

// Zoned rhythm bar: red -> amber -> green background bands with divider ticks
// at the real thresholds (AMBER_START, greenStart), plus a fill showing the
// current score. Replaces the chore-era points-based CompactBar/ProgressRow —
// this takes a 0-1 score instead.
//
// A null score (every habit still warming up, or this one hasn't run a full
// period yet) renders as a warming-up placeholder rather than an empty or red
// bar, so a brand-new routine doesn't read as failure. `pulse`/`pulseSeq` let
// a caller (the header strip) flash green and replay the swell animation when
// a fresh completion just moved the score, without RhythmBar needing to know
// why.
export default function RhythmBar({ score, greenStart = DEFAULT_GREEN_START, height = 10, pulse = false, pulseSeq = 0 }) {
  if (score == null) {
    return (
      <div
        role="img"
        aria-label="Warming up"
        style={{
          height: Math.max(height, 20),
          borderRadius: 999,
          background: "#0F2530",
          border: "1px dashed #2A4756",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 11, color: "#7FA3AC", fontWeight: 700, lineHeight: 1 }}>🌱 warming up</span>
      </div>
    );
  }

  const zone = rhythmZone(score, greenStart);
  const color = pulse ? "#5FE0BB" : zone.key === "green" ? "#5FE0BB" : zone.key === "amber" ? "#FFC65E" : "#FF8B7B";
  const green = Math.min(1, Math.max(AMBER_START + 0.0001, Number(greenStart) || DEFAULT_GREEN_START));
  const buildingPct = Math.round(AMBER_START * 100);
  const greenPct = Math.round(green * 100);
  const percent = Math.max(0, Math.min(1, Number(score) || 0)) * 100;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-label={`${Math.round(percent)}%, ${zone.label} zone`}
      style={{
        position: "relative",
        height,
        borderRadius: height / 2,
        background: `linear-gradient(to right, #FF8B7B30 0 ${buildingPct}%, #FFC65E30 ${buildingPct}% ${greenPct}%, #5FE0BB30 ${greenPct}% 100%)`,
        border: "1px solid #1E4152",
        overflow: "hidden",
      }}
    >
      <div
        key={`fill-${pulseSeq}`}
        style={{
          width: `${percent}%`,
          height: "100%",
          borderRadius: height / 2,
          background: `linear-gradient(to right, ${color}99, ${color})`,
          boxShadow: pulse ? "0 0 20px #5FE0BBCC" : percent >= 80 ? `0 0 10px ${color}88` : "none",
          animation: pulse ? "barSwell 1.4s ease-out" : "none",
          transformOrigin: "left center",
          transition: "width 0.7s ease, background 0.35s ease, box-shadow 0.5s ease",
        }}
      />
      <div aria-hidden="true" style={{ position: "absolute", inset: `0 auto 0 ${buildingPct}%`, width: 1, background: "#D8E9EC55" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: `0 auto 0 ${greenPct}%`, width: 1, background: "#D8E9EC88" }} />
    </div>
  );
}
