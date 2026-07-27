export const COMPACT_LABEL_MAX_RADIUS = 40;
export const MIN_BUBBLE_HIT_DIAMETER = 44;
const MAX_BUBBLE_RADIUS = 100;

export function clampBubbleRadius(radius) {
  const value = Number(radius);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(value, MAX_BUBBLE_RADIUS));
}

export function bubbleHitDiameter(radius) {
  return Math.max(MIN_BUBBLE_HIT_DIAMETER, clampBubbleRadius(radius) * 2);
}

export function usesCompactBubbleLabel(radius) {
  return Number(radius) < COMPACT_LABEL_MAX_RADIUS;
}
