import { describe, it, expect } from "vitest";
import { completionIds, shouldPulseRhythm } from "./rhythmPulse.js";

const c = (id) => ({ id, habitId: "h", at: 1 });

describe("rhythmPulse", () => {
  it("collects completion ids", () => {
    expect(completionIds([c("a"), c("b")])).toEqual(new Set(["a", "b"]));
  });

  it("ignores completions with no id", () => {
    expect(completionIds([{ habitId: "h", at: 1 }])).toEqual(new Set());
  });

  it("tolerates null input", () => {
    expect(completionIds(null)).toEqual(new Set());
  });

  it("does not pulse on the first observation", () => {
    expect(shouldPulseRhythm(null, 0.5, null, [c("a")])).toBe(false);
  });

  it("pulses when a new completion appears even if the score is unchanged", () => {
    const before = completionIds([c("a")]);
    expect(shouldPulseRhythm(0.5, 0.5, before, [c("a"), c("b")])).toBe(true);
  });

  it("pulses when the score rises with no new completion", () => {
    const before = completionIds([c("a")]);
    expect(shouldPulseRhythm(0.5, 0.6, before, [c("a")])).toBe(true);
  });

  it("does not pulse when nothing changed", () => {
    const before = completionIds([c("a")]);
    expect(shouldPulseRhythm(0.5, 0.5, before, [c("a")])).toBe(false);
  });

  it("does not pulse when the score falls and nothing was added", () => {
    const before = completionIds([c("a")]);
    expect(shouldPulseRhythm(0.6, 0.5, before, [c("a")])).toBe(false);
  });

  it("counts completions with no actor field, as the habit schema produces", () => {
    expect(completionIds([{ id: "a", habitId: "h", at: 1 }])).toEqual(new Set(["a"]));
  });

  it("excludes service and reset completions from the pulse", () => {
    const ids = completionIds([
      { id: "a", habitId: "h", at: 1 },
      { id: "svc", habitId: "h", at: 2, by: "service" },
      { id: "rst", habitId: "h", at: 3, by: "reset" },
    ]);
    expect(ids).toEqual(new Set(["a"]));
  });

  it("does not pulse for a service completion that leaves the score unchanged", () => {
    expect(shouldPulseRhythm(0.5, 0.5, new Set(), [{ id: "svc", by: "service" }])).toBe(false);
  });

  it("does not pulse for a board reset that leaves the score unchanged", () => {
    expect(shouldPulseRhythm(0.5, 0.5, new Set(), [{ id: "rst", by: "reset" }])).toBe(false);
  });
});
