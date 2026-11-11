import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { orderBySeed, seedAction, seedStamp, todayKey } from "./seed-plan";
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
  const cases: Array<[{ freshPage: boolean; hasPeople: boolean; stampIsCurrent: boolean }, string]> = [
    [{ freshPage: true, hasPeople: true, stampIsCurrent: true }, "wipe-and-seed"],
    [{ freshPage: true, hasPeople: false, stampIsCurrent: true }, "seed"],
    [{ freshPage: false, hasPeople: true, stampIsCurrent: true }, "keep"],
    [{ freshPage: false, hasPeople: true, stampIsCurrent: false }, "wipe-and-seed"],
    [{ freshPage: false, hasPeople: false, stampIsCurrent: true }, "seed"],
    [{ freshPage: false, hasPeople: false, stampIsCurrent: false }, "seed"],
  ];
  for (const [state, expected] of cases) {
    it(`${JSON.stringify(state)} → ${expected}`, () => {
      assert.equal(seedAction(state), expected);
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
