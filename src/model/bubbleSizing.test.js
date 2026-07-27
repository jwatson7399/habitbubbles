import { describe, it, expect } from "vitest";
import { habitBubbleNodes } from "./bubbleSizing.js";
import { DAY } from "./habitData.js";

const NOW = 1750000000000;
const habit = (id, over) => ({ id, name: id, importance: 3, effort: 3, quota: 1, periodDays: 1, anchorAt: NOW - 30 * DAY, ...over });

describe("habitBubbleNodes", () => {
  it("gives every habit four radii", () => {
    const [n] = habitBubbleNodes([habit("a")], [], NOW);
    for (const key of ["mathRadius", "visualRadius", "interactRadius", "collisionRadius"]) {
      expect(typeof n[key]).toBe("number");
    }
  });

  it("keeps collision at least as large as interaction", () => {
    const nodes = habitBubbleNodes([habit("a"), habit("b"), habit("c")], [], NOW);
    for (const n of nodes) expect(n.collisionRadius).toBeGreaterThanOrEqual(n.interactRadius);
  });

  it("sizes each habit independently of the rest of the field", () => {
    const alone = habitBubbleNodes([habit("a")], [], NOW)[0];
    const crowded = habitBubbleNodes([habit("a"), habit("b", { importance: 5 })], [], NOW)[0];
    expect(crowded.visualRadius).toBeCloseTo(alone.visualRadius, 6);
  });

  it("collapses a just-completed habit to a speck without inflating a sibling", () => {
    const habits = [habit("a"), habit("b")];
    const done = habits.map((h) => ({ habitId: h.id, id: `c-${h.id}`, at: NOW }));
    const nodes = habitBubbleNodes(habits, done, NOW);
    for (const n of nodes) {
      expect(n.mathRadius).toBeCloseTo(0, 6);
      expect(n.interactRadius).toBeGreaterThanOrEqual(22);
    }
  });

  it("excludes archived habits", () => {
    expect(habitBubbleNodes([habit("a", { archived: true }), habit("b")], [], NOW).map((n) => n.id)).toEqual(["b"]);
  });
});
