import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { clampBubbleCenter, releaseBubbleNode } from "../bubblePhysics.js";
import { usesCompactBubbleLabel } from "../bubblePresentation.js";
import { habitBubbleNodes } from "../model/bubbleSizing.js";
import { now as clockNow } from "../utils/clock.js";

// Soft pastel color spread evenly around the wheel via the golden angle, so
// each bubble gets a distinct hue and the range keeps widening with more habits.
// Returns 6-digit hex so the existing `${hue}AA` alpha suffixes keep working.
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
export const bubbleHue = (i) => hslToHex((i * 137.508) % 360, 62, 68);

// ---------- Bubble field ----------
export default function BubbleField({ habits, completions, onTap, popId, simDays, suggestedIds }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 360, h: 480 });
  const [nodes, setNodes] = useState([]);
  const simRef = useRef(null);
  const nodesRef = useRef([]);
  const dragRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const targets = useMemo(() => {
    // Sizing is absolute (habitBubbleNodes), never normalized against the
    // field. Pressure is already a bounded 0..1 quantity, so it doubles as
    // the layout "prominence" that pulls due habits toward the center —
    // that's a placement choice, not a sizing one.
    const bubbleNodes = habitBubbleNodes(habits, completions, clockNow());
    const orbit = Math.min(size.w, size.h) * 0.38;
    return bubbleNodes.map((item, index) => {
      const angle = index * 2.399963229728653;
      const distance = orbit * (1 - item.pressure);
      return {
        ...item,
        hue: bubbleHue(index),
        focusX: size.w / 2 + Math.cos(angle) * distance,
        focusY: size.h / 2 + Math.sin(angle) * distance * 0.72,
      };
    });
  }, [habits, completions, size, simDays]);

  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    const count = targets.length;
    const ring = Math.min(size.w, size.h) * 0.32;
    const next = targets.map((t, i) => {
      const p = prev.get(t.id);
      if (p) {
        return Object.assign(p, {
          habit: t.habit,
          pressure: t.pressure,
          priority: t.priority,
          mathRadius: t.mathRadius,
          visualRadius: t.visualRadius,
          interactRadius: t.interactRadius,
          collisionRadius: t.collisionRadius,
          focusX: t.focusX,
          focusY: t.focusY,
          hue: t.hue,
        });
      }
      // New bubbles enter near their priority orbit instead of stacking.
      const angle = (i / Math.max(count, 1)) * Math.PI * 2;
      return {
        ...t,
        x: Number.isFinite(t.focusX) ? t.focusX : size.w / 2 + Math.cos(angle) * ring,
        y: Number.isFinite(t.focusY) ? t.focusY : size.h / 2 + Math.sin(angle) * ring,
      };
    });
    nodesRef.current = next;
    if (simRef.current) simRef.current.stop();
    const priorityOrbit = Math.min(size.w, size.h) * 0.38;
    const sim = d3
      .forceSimulation(next)
      .force("x", d3.forceX((d) => d.focusX).strength((d) => 0.018 + 0.055 * d.pressure))
      .force("y", d3.forceY((d) => d.focusY).strength((d) => 0.02 + 0.06 * d.pressure))
      .force(
        "priorityOrbit",
        d3.forceRadial(
          (d) => priorityOrbit * (1 - d.pressure),
          size.w / 2,
          size.h / 2
        ).strength((d) => 0.1 + 0.35 * d.pressure)
      )
      // Collision — and boundary clamping below — must derive from
      // collisionRadius, never visualRadius. At pressure 0 the visual/math
      // radius is exactly zero and many habits can sit there at once; sizing
      // collision from the invisible mathematical radius is what let
      // 44px tap targets overlap so only the topmost bubble was tappable.
      .force("collide", d3.forceCollide((d) => d.collisionRadius).strength(1).iterations(3))
      .velocityDecay(0.28)
      .alpha(0.9)
      .alphaDecay(0.012)
      .alphaMin(0.001)
      .on("tick", () => {
        for (const n of next) {
          n.x = Math.max(n.collisionRadius, Math.min(size.w - n.collisionRadius, n.x));
          n.y = Math.max(n.collisionRadius, Math.min(size.h - n.collisionRadius, n.y));
        }
        setNodes([...next]);
      });
    simRef.current = sim;
    return () => sim.stop();
  }, [targets, size.w, size.h]);

  const onPointerDown = (e, node) => {
    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.setPointerCapture(e.pointerId);
    node.vx = 0;
    node.vy = 0;
    dragRef.current = {
      id: node.id,
      pointerId: e.pointerId,
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      lastTime: e.timeStamp,
      velocityX: 0,
      velocityY: 0,
      offsetX: node.x - x,
      offsetY: node.y - y,
      moved: false,
    };
  };

  const onPointerMove = (e, node) => {
    const d = dragRef.current;
    if (!d || d.id !== node.id || d.pointerId !== e.pointerId) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - d.startX;
    const dy = y - d.startY;
    if (!d.moved && Math.hypot(dx, dy) > 8) {
      d.moved = true;
      if (simRef.current) simRef.current.alphaTarget(0.18).restart();
    }
    if (d.moved) {
      const elapsed = Math.max(e.timeStamp - d.lastTime, 8);
      const sampleVelocityX = ((x - d.lastX) / elapsed) * 16;
      const sampleVelocityY = ((y - d.lastY) / elapsed) * 16;
      d.velocityX = d.velocityX * 0.65 + sampleVelocityX * 0.35;
      d.velocityY = d.velocityY * 0.65 + sampleVelocityY * 0.35;
      d.lastX = x;
      d.lastY = y;
      d.lastTime = e.timeStamp;
      node.fx = clampBubbleCenter(x + d.offsetX, size.w, node.collisionRadius);
      node.fy = clampBubbleCenter(y + d.offsetY, size.h, node.collisionRadius);
    }
  };

  const finishDrag = (node, pointerId, allowTap) => {
    const d = dragRef.current;
    if (!d || d.id !== node.id || (pointerId != null && d.pointerId !== pointerId)) return;
    dragRef.current = null;
    // Blend the user's release velocity with a gentle inward pull. Reheating
    // is essential here: alphaTarget(0) alone can leave a cooled simulation
    // parked exactly where the pointer was released.
    releaseBubbleNode(node, d, size, simRef.current);

    setNodes([...nodesRef.current]);
    if (allowTap && !d.moved) onTap(node.habit);
  };

  const onPointerUp = (e, node) => {
    finishDrag(node, e.pointerId, true);
  };

  const onPointerCancel = (e, node) => {
    finishDrag(node, e.pointerId, false);
  };

  const onLostPointerCapture = (e, node) => {
    // iOS can end a gesture via lost capture without delivering pointerup.
    // Always release the fixed coordinates so the bubble cannot remain pinned.
    finishDrag(node, e.pointerId, false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, overflow: "hidden", touchAction: "none" }}>
      {(!habits || habits.length === 0) && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#7FA3AC", fontSize: 15, textAlign: "center", padding: 32 }}>
          No habits yet. Head to the Habits tab to add your list.
        </div>
      )}
      {nodes.map((n) => {
        const due = n.pressure >= 1;
        const overdue = n.priority >= 0.8;
        const suggested = suggestedIds?.has(n.id);
        // Labels and hit target route off visualRadius/interactRadius, never
        // the collision radius used by d3.forceCollide above.
        const compactLabel = usesCompactBubbleLabel(n.visualRadius);
        const hitDiameter = n.interactRadius * 2;
        const showInlineLabel = n.visualRadius >= 14;
        const bubbleShadow = due
          ? `0 0 ${overdue ? 26 : 14}px ${n.hue}${overdue ? "AA" : "66"}, inset 0 0 12px rgba(255,255,255,0.25)`
          : "inset 0 0 10px rgba(255,255,255,0.18)";
        return (
          <div
            key={n.id}
            aria-label={`${n.habit.name}, importance ${n.habit.importance}${suggested ? ", suggested habit" : ""}`}
            data-label-mode={!showInlineLabel ? "hidden" : compactLabel ? "compact" : "full"}
            onPointerDown={(e) => onPointerDown(e, n)}
            onPointerMove={(e) => onPointerMove(e, n)}
            onPointerUp={(e) => onPointerUp(e, n)}
            onPointerCancel={(e) => onPointerCancel(e, n)}
            onLostPointerCapture={(e) => onLostPointerCapture(e, n)}
            style={{
              position: "absolute",
              left: n.x - hitDiameter / 2,
              top: n.y - hitDiameter / 2,
              width: hitDiameter,
              height: hitDiameter,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: dragRef.current && dragRef.current.id === n.id ? "grabbing" : "grab",
              userSelect: "none",
              WebkitTapHighlightColor: "transparent",
              zIndex: dragRef.current && dragRef.current.id === n.id
                ? 6
                : suggested
                ? 5
                : 1 + Math.round(n.pressure * 3),
            }}
          >
            <div
              style={{
                position: "relative",
                width: n.visualRadius * 2,
                height: n.visualRadius * 2,
                flexShrink: 0,
                borderRadius: "50%",
                background: `radial-gradient(circle at 32% 30%, ${n.hue}F5, ${n.hue}AA 60%, ${n.hue}66)`,
                boxShadow: suggested
                  ? `${bubbleShadow}, 0 0 0 3px #FFD95A, 0 0 22px #FFD95ADD, 0 0 42px #FFD95A88`
                  : bubbleShadow,
                outline: suggested ? "2px solid #FFF0A6" : "none",
                outlineOffset: suggested ? 3 : 0,
                border: due ? `2px solid ${n.hue}` : `1.5px solid ${n.hue}66`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                pointerEvents: "none",
                animation: popId === n.id ? `pop 0.65s ease-out` : `breathe ${overdue ? 2.2 : 3.6}s ease-in-out infinite`,
                transition: "width 0.7s cubic-bezier(0.34, 1.4, 0.5, 1), height 0.7s cubic-bezier(0.34, 1.4, 0.5, 1), box-shadow 0.35s ease, outline-color 0.35s ease",
              }}
            >
              {popId === n.id && (
                <span style={{ position: "absolute", top: -14, right: -6, fontSize: 20, animation: "sparkleUp 0.9s ease-out forwards", pointerEvents: "none" }}>✨</span>
              )}
              {showInlineLabel && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                    width: compactLabel ? "96%" : "82%",
                    padding: compactLabel ? 2 : 4,
                    overflow: "hidden",
                    pointerEvents: "none",
                    transform: compactLabel ? "translateY(-2px)" : "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Baloo 2', sans-serif",
                      fontWeight: 700,
                      fontSize: Math.max(8, Math.min(n.visualRadius * 0.28, 16)),
                      color: "#0C1B26",
                      textAlign: "center",
                      lineHeight: 1.06,
                      width: "100%",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: compactLabel ? 2 : 3,
                      overflow: "hidden",
                      overflowWrap: "break-word",
                    }}
                  >
                    {n.habit.name}
                  </span>
                  {!compactLabel && (
                    <span
                      style={{
                        fontFamily: "'Baloo 2', sans-serif",
                        fontWeight: 800,
                        fontSize: Math.max(9, Math.min(n.visualRadius * 0.22, 12)),
                        color: "#0C1B26",
                        opacity: 0.62,
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      importance {n.habit.importance}
                    </span>
                  )}
                </div>
              )}
              {compactLabel && showInlineLabel && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: "7%",
                    bottom: "6%",
                    width: Math.max(12, Math.min(n.visualRadius * 0.56, 20)),
                    height: Math.max(12, Math.min(n.visualRadius * 0.56, 20)),
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    background: "rgba(12,27,38,0.88)",
                    color: "#E8F3F4",
                    border: "1px solid rgba(255,255,255,0.4)",
                    fontFamily: "'Baloo 2', sans-serif",
                    fontWeight: 800,
                    fontSize: 9,
                    lineHeight: 1,
                    pointerEvents: "none",
                  }}
                >
                  {n.habit.importance}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
