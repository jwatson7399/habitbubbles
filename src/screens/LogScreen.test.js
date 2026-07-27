import { describe, it, expect } from "vitest";
import { periodUnit } from "./LogScreen.jsx";

describe("periodUnit", () => {
  it("calls a one-day period a day", () => {
    expect(periodUnit(1)).toBe("day");
  });

  it("calls a seven-day period a week", () => {
    expect(periodUnit(7)).toBe("week");
  });

  it("falls back to a generic period for other cadences", () => {
    // Lift weights ships with periodDays: 2 and hits this path.
    expect(periodUnit(2)).toBe("period");
    expect(periodUnit(14)).toBe("period");
    expect(periodUnit(30)).toBe("period");
  });
});
