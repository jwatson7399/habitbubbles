import { describe, expect, it } from "vitest";
import { faceFor } from "./format.js";

describe("faceFor", () => {
  it("uses the configured top-zone threshold for the best mood", () => {
    expect(faceFor(84, 80)).toBe("🥰🌱");
    expect(faceFor(79.99, 80)).toBe("🙂");
  });

  it("keeps the original 90% top threshold when none is supplied", () => {
    expect(faceFor(84)).toBe("🙂");
    expect(faceFor(90)).toBe("🥰🌱");
  });
});
