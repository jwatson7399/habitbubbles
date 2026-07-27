import React from "react";
import { theme } from "../theme.js";

export function Modal({ children, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(6,14,20,0.72)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: theme.surfaceRaised, borderRadius: "22px 22px 0 0", padding: "22px 20px 34px", width: "100%", maxWidth: 480, maxHeight: "92dvh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" }}
      >
        {children}
      </div>
    </div>
  );
}
