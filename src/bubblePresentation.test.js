import { describe, expect, it } from "vitest";
import {
  COMPACT_LABEL_MAX_RADIUS,
  MIN_BUBBLE_HIT_DIAMETER,
  bubbleHitDiameter,
  clampBubbleRadius,
  usesCompactBubbleLabel,
} from "./bubblePresentation.js";

describe("bubble presentation", () => {
  it("allows visual bubbles to shrink without shrinking the tap target", () => {
    expect(clampBubbleRadius(17)).toBe(17);
    expect(clampBubbleRadius(4)).toBe(4);
    expect(clampBubbleRadius(-2)).toBe(0);
    expect(clampBubbleRadius(72)).toBe(72);
    expect(clampBubbleRadius(140)).toBe(100);
    expect(bubbleHitDiameter(8)).toBe(MIN_BUBBLE_HIT_DIAMETER);
    expect(bubbleHitDiameter(30)).toBe(60);
  });

  it("uses compact labels below the large-bubble threshold", () => {
    expect(usesCompactBubbleLabel(12)).toBe(true);
    expect(usesCompactBubbleLabel(COMPACT_LABEL_MAX_RADIUS - 0.1)).toBe(true);
    expect(usesCompactBubbleLabel(COMPACT_LABEL_MAX_RADIUS)).toBe(false);
  });
});
