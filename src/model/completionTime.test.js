import { describe, expect, it } from "vitest";
import {
  dateInputValue,
  defaultCompletionAt,
  daysAgoAt,
  localDateTime,
  timeInputValue,
} from "./completionTime.js";

describe("completion time", () => {
  it("counts a 1 a.m. Just now completion as 11 p.m. on the prior waking day", () => {
    const now = new Date(2026, 7, 5, 1, 12).getTime();
    const result = new Date(defaultCompletionAt(now));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(4);
    expect(result.getHours()).toBe(23);
    expect(result.getMinutes()).toBe(0);
  });

  it("uses the actual time once the late-night window has ended", () => {
    const now = new Date(2026, 7, 5, 4, 0).getTime();
    expect(defaultCompletionAt(now)).toBe(now);
  });

  it("round-trips local date and time input values", () => {
    const timestamp = new Date(2026, 10, 8, 21, 37).getTime();
    expect(dateInputValue(timestamp)).toBe("2026-11-08");
    expect(timeInputValue(timestamp)).toBe("21:37");
    expect(localDateTime("2026-11-08", "21:37")).toBe(timestamp);
  });

  it("rejects impossible input dates", () => {
    expect(localDateTime("2026-02-31", "12:00")).toBeNaN();
    expect(localDateTime("2026-02-03", "25:00")).toBeNaN();
  });

  it("moves quick choices by calendar day while retaining the selected time", () => {
    const now = new Date(2026, 7, 5, 1, 12).getTime();
    const selected = new Date(2026, 7, 4, 23, 0).getTime();
    const result = new Date(daysAgoAt(now, 2, selected));
    expect(result.getDate()).toBe(2);
    expect(result.getHours()).toBe(23);
  });
});
