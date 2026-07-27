import React from "react";
import { Stepper, ScaleSelector } from "./controls.jsx";

export function ChoreFields({ title, value, onChange }) {
  const importanceText = (level) => ["", "Low", "Mild", "Medium", "High", "Critical"][level];
  const effortText = (level) => ["", "Very easy", "Easy", "Moderate", "Hard", "Very hard"][level];
  return (
    <section style={title ? { marginTop: 12, padding: "12px 12px 4px", background: "#102733", border: "1px solid #1A3B49", borderRadius: 14 } : undefined}>
      {title && <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 15, fontWeight: 700, color: "#5FE0BB", marginBottom: 8 }}>{title}</div>}
      <input
        value={value.name}
        placeholder={`${title || "Chore"} name`}
        onChange={(event) => onChange({ name: event.target.value })}
        style={{ width: "100%", background: "#0F2530", border: "1px solid #1E4152", borderRadius: 12, padding: "12px 14px", color: "#E8F3F4", fontSize: 15, fontFamily: "inherit", marginBottom: 6 }}
      />
      <ScaleSelector label="Importance" hint="How much does it matter if this slips?" value={value.importance} min={1} max={5} onChange={(importance) => onChange({ importance })} valueLabel={importanceText} endLabels={["Low", "Critical"]} />
      <ScaleSelector label="Effort" hint="How hard is this step?" value={value.difficulty} min={1} max={5} onChange={(difficulty) => onChange({ difficulty })} valueLabel={effortText} endLabels={["Very easy", "Very hard"]} />
      <Stepper label="Goal frequency" value={value.freqDays} min={1} max={60} onChange={(freqDays) => onChange({ freqDays })} format={(days) => `every ${days}d`} />
    </section>
  );
}
