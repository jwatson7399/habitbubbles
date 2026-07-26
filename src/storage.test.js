import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { LOCAL_KEY, PENDING_KEY, INTRO_KEY } from "./storage.js";
import { DATA_ID, SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

describe("storage identity isolation", () => {
  const keys = [LOCAL_KEY, PENDING_KEY, INTRO_KEY];

  it("namespaces every key under habitbubbles:", () => {
    for (const key of keys) expect(key.startsWith("habitbubbles:")).toBe(true);
  });

  it("never mentions chorebubbles in any storage key", () => {
    for (const key of keys) expect(key).not.toMatch(/chorebubbles/i);
  });

  it("uses a habitbubbles-specific data id", () => {
    expect(DATA_ID).toBe("habitbubbles-local");
  });

  it("ships local-only with no Supabase credentials", () => {
    expect(SUPABASE_URL).toBe("");
    expect(SUPABASE_ANON_KEY).toBe("");
  });

  it("keeps all three keys distinct", () => {
    expect(new Set(keys).size).toBe(3);
  });
});

describe("PWA identity", () => {
  // Read as text rather than importing the config, so this never has to load
  // the Vite plugin chain inside a unit test.
  const readFile = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

  it("names the app HabitBubbles in the manifest", () => {
    const config = readFile("../vite.config.js");
    expect(config).toContain('name: "HabitBubbles"');
    expect(config).toContain('short_name: "Habits"');
    expect(config).toContain('cacheId: "habitbubbles"');
  });

  it("carries no ChoreBubbles identity in the manifest or page shell", () => {
    expect(readFile("../vite.config.js")).not.toMatch(/chorebubbles/i);
    expect(readFile("../index.html")).not.toMatch(/chorebubbles/i);
    expect(readFile("../package.json")).toContain('"name": "habitbubbles"');
  });
});
