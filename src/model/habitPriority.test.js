import { describe, it, expect } from "vitest";
import {
  habitPriority, habitRadii,
  BASE_RADIUS, SPECK_RADIUS, MIN_INTERACT_RADIUS,
} from "./habitPriority.js";

describe("habitPriority", () => {
  it("is zero at zero pressure regardless of importance", () => {
    for (let importance = 1; importance <= 5; importance++) {
      expect(habitPriority({ pressure: 0, importance })).toBe(0);
    }
  });

  it("scales with importance at equal pressure", () => {
    const low = habitPriority({ pressure: 1, importance: 1 });
    const high = habitPriority({ pressure: 1, importance: 5 });
    expect(high).toBeGreaterThan(low);
    expect(high).toBeCloseTo(1, 5);
    expect(low).toBeCloseTo(0.6, 5);
  });

  it("increases monotonically with pressure", () => {
    const a = habitPriority({ pressure: 0.2, importance: 3 });
    const b = habitPriority({ pressure: 0.8, importance: 3 });
    expect(b).toBeGreaterThan(a);
  });
});

describe("habitRadii", () => {
  it("lets the mathematical radius reach exactly zero", () => {
    expect(habitRadii(0).mathRadius).toBe(0);
  });

  it("floors the visual radius at a deliberate speck", () => {
    expect(habitRadii(0).visualRadius).toBeGreaterThanOrEqual(SPECK_RADIUS);
  });

  it("floors the interaction radius at an accessible tap target", () => {
    expect(habitRadii(0).interactRadius).toBeGreaterThanOrEqual(MIN_INTERACT_RADIUS);
    expect(MIN_INTERACT_RADIUS * 2).toBe(44);
  });

  it("keeps collision at least as large as interaction at every priority", () => {
    for (let p = 0; p <= 1.0001; p += 0.05) {
      const r = habitRadii(p);
      expect(r.collisionRadius).toBeGreaterThanOrEqual(r.interactRadius);
    }
  });

  it("gives seven simultaneously-idle habits non-overlapping hit targets", () => {
    // The failure this prevents: everything done, every mathRadius 0, hit areas
    // stacked, only the top bubble tappable.
    const radii = Array.from({ length: 7 }, () => habitRadii(0));
    for (const r of radii) {
      expect(r.interactRadius).toBeGreaterThanOrEqual(MIN_INTERACT_RADIUS);
      expect(r.collisionRadius).toBeGreaterThan(r.interactRadius - 0.0001);
    }
  });

  it("tracks the mathematical radius once above the floors", () => {
    const r = habitRadii(1);
    expect(r.mathRadius).toBeCloseTo(BASE_RADIUS, 5);
    expect(r.visualRadius).toBeCloseTo(BASE_RADIUS, 5);
    expect(r.interactRadius).toBeCloseTo(BASE_RADIUS, 5);
  });
});
