import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { orderBySeed, seedAction, seedStamp, todayKey, type SeedState } from "./seed-plan";
import type { Person } from "./types";

describe("todayKey", () => {
  it("is the local day as YYYY-M-D, without zero padding", () => {
    assert.equal(todayKey(new Date(2026, 0, 5)), "2026-1-5");
    assert.equal(todayKey(new Date(2026, 10, 11, 23, 59)), "2026-11-11");
  });
});

describe("seedStamp", () => {
  it("folds version, day and seed size together", () => {
    assert.equal(seedStamp({ version: 28, day: "2026-1-5", people: 5, cases: 19 }), "28@2026-1-5@5x19");
  });

  it("changes when any part changes", () => {
    const base = { version: 28, day: "2026-1-5", people: 5, cases: 19 };
    const stamps = new Set([
      seedStamp(base),
      seedStamp({ ...base, version: 29 }),
      seedStamp({ ...base, day: "2026-1-6" }),
      seedStamp({ ...base, people: 6 }),
      seedStamp({ ...base, cases: 20 }),
    ]);
    assert.equal(stamps.size, 5);
  });
});

describe("seedAction", () => {
  const base: SeedState = { firstPass: true, reseedOnLoad: true, hasPeople: true, stampIsCurrent: true };
  const cases: Array<[string, Partial<SeedState>, string]> = [
    ["first read on a fresh page starts the demo over", {}, "wipe-and-seed"],
    ["an empty sandbox is seeded", { hasPeople: false }, "seed"],
    ["an empty sandbox is seeded on a later read too (after a reset)", { firstPass: false, hasPeople: false }, "seed"],
    ["later reads keep what was done in the page", { firstPass: false }, "keep"],
    ["later reads keep it even when the stamp went stale (past midnight)", { firstPass: false, stampIsCurrent: false }, "keep"],
    ["without reseed-on-load, a current stamp keeps the data", { reseedOnLoad: false }, "keep"],
    ["without reseed-on-load, a stale stamp starts over", { reseedOnLoad: false, stampIsCurrent: false }, "wipe-and-seed"],
  ];
  for (const [name, change, expected] of cases) {
    it(`${name} → ${expected}`, () => {
      assert.equal(seedAction({ ...base, ...change }), expected);
    });
  }
});

describe("orderBySeed", () => {
  const person = (id: string, name: string): Person => ({ id, name, initials: name.slice(0, 2), role: "senior" });
  const seed = [person("p-an", "Anjali"), person("p-sp", "Prakash"), person("p-dv", "Deepa")];

  it("puts people back in seed order", () => {
    const shuffled = [seed[2], seed[0], seed[1]];
    assert.deepEqual(orderBySeed(shuffled, seed).map((p) => p.id), ["p-an", "p-sp", "p-dv"]);
  });

  it("puts anyone not in the seed last, by name", () => {
    const people = [person("x-2", "Zara"), seed[1], person("x-1", "Bina"), seed[0]];
    assert.deepEqual(orderBySeed(people, seed).map((p) => p.id), ["p-an", "p-sp", "x-1", "x-2"]);
  });

  it("does not change its input", () => {
    const shuffled = [seed[2], seed[0]];
    orderBySeed(shuffled, seed);
    assert.deepEqual(shuffled.map((p) => p.id), ["p-dv", "p-an"]);
  });
});
