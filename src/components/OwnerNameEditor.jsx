import React, { useState, useEffect } from "react";
import { theme } from "../theme.js";

// The owner name buffers locally and saves on blur so typing does not spam writes.
export function OwnerNameEditor({ settings, onSave }) {
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  useEffect(() => { setOwnerName(settings.ownerName); }, [settings.ownerName]);
  const commit = () => {
    if (ownerName.trim() && ownerName.trim() !== settings.ownerName) onSave(ownerName.trim());
  };
  return (
    <input
      aria-label="Your name"
      placeholder="Your name"
      value={ownerName}
      onChange={(event) => setOwnerName(event.target.value)}
      onBlur={commit}
      style={{ width: "100%", marginTop: 8, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "10px 12px", color: theme.text, fontSize: 14, fontFamily: "inherit" }}
    />
  );
}
