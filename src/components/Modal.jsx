import React, { useEffect, useRef } from "react";
import { theme } from "../theme.js";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ children, onClose, title }) {
  const sheetRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    // Remember what had focus so it can be restored once the dialog closes —
    // that's what keeps keyboard/screen-reader users oriented in the page
    // instead of getting dropped back at the top of the document.
    returnFocusRef.current = document.activeElement;

    const sheet = sheetRef.current;
    if (sheet) {
      const firstFocusable = sheet.querySelector(FOCUSABLE_SELECTOR);
      (firstFocusable || sheet).focus();
    }

    return () => {
      const toRestore = returnFocusRef.current;
      if (toRestore && typeof toRestore.focus === "function" && document.contains(toRestore)) {
        toRestore.focus();
      }
    };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "Tab") {
      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusable = Array.from(sheet.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      onClick={onClose}
      onKeyDown={onKeyDown}
      style={{ position: "fixed", inset: 0, background: "rgba(6,14,20,0.72)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", background: theme.surfaceRaised, borderRadius: "22px 22px 0 0", padding: "22px 20px 34px", width: "100%", maxWidth: 480, maxHeight: "92dvh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)", outline: "none" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: theme.surface,
            color: theme.text,
            fontSize: 18,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
