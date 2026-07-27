import { describe, it, expect } from "vitest";
import { suggestionScore, rankSuggestions } from "./suggestNow.js";
import { DAY } from "./habitData.js";

const NOW = 1750000000000;
const habit = (id, over) => ({
  id, name: id, importance: 3, effort: 3, quota: 1, periodDays: 1,
  anchorAt: NOW - 30 * DAY, archived: false, ...over,
});

describe("suggestionScore", () => {
  it("prefers the cheaper habit at equal pressure and importance", () => {
    const cheap = habit("cheap", { effort: 1 });
    const dear = habit("dear", { effort: 5 });
    expect(suggestionScore(cheap, 0.5)).toBeGreaterThan(suggestionScore(dear, 0.5));
  });

  it("keeps effort a tiebreaker, not an override", () => {
    const urgentExpensive = habit("bjj", { effort: 5 });
    const idleCheap = habit("med", { effort: 1 });
    expect(suggestionScore(urgentExpensive, 1)).toBeGreaterThan(suggestionScore(idleCheap, 0.1));
  });
});

describe("rankSuggestions", () => {
  it("ranks the most pressured habit first", () => {
    const habits = [habit("fresh"), habit("stale")];
    const completions = [{ habitId: "fresh", id: "c1", at: NOW }];
    expect(rankSuggestions(habits, completions, NOW)[0].id).toBe("stale");
  });

  it("excludes archived habits", () => {
    const habits = [habit("a", { archived: true }), habit("b")];
    const ids = rankSuggestions(habits, [], NOW).map((h) => h.id);
    expect(ids).toEqual(["b"]);
  });

  it("still suggests a warming-up habit", () => {
    // Warm-up withholds scoring, not recommending. Excluding these left the
    // feature dead for a new user's entire first period.
    const habits = [habit("new", { anchorAt: NOW - DAY / 2 }), habit("old")];
    const ids = rankSuggestions(habits, [], NOW).map((h) => h.id);
    expect(ids).toContain("new");
    expect(ids).toHaveLength(2);
  });

  it("suggests something on a brand-new install where every habit is warming up", () => {
    const fresh = ["a", "b", "c"].map((id) => habit(id, { anchorAt: NOW - DAY / 2 }));
    expect(rankSuggestions(fresh, [], NOW)).toHaveLength(3);
  });

  it("breaks exact ties by importance then by older anchor", () => {
    const a = habit("a", { importance: 2, anchorAt: NOW - 30 * DAY });
    const b = habit("b", { importance: 5, anchorAt: NOW - 30 * DAY });
    expect(rankSuggestions([a, b], [], NOW)[0].id).toBe("b");

    const c = habit("c", { importance: 3, anchorAt: NOW - 40 * DAY });
    const d = habit("d", { importance: 3, anchorAt: NOW - 20 * DAY });
    expect(rankSuggestions([c, d], [], NOW)[0].id).toBe("c");
  });

  it("returns an empty list when nothing is eligible", () => {
    expect(rankSuggestions([], [], NOW)).toEqual([]);
  });
});
