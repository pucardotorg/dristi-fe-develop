import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { CONFIG_PATH, findGrowth, parseExceptionLists } from "./check-lint-exceptions.mjs";

const config = (lists) =>
  Object.entries(lists)
    .map(([name, files]) => `const ${name} = [\n${files.map((file) => `  "${file}",`).join("\n")}\n];`)
    .join("\n");

describe("check-lint-exceptions", () => {
  it("reads every *STILL_* list and nothing else", () => {
    const text = `const SCREENS = ["src/app/**"];\n${config({ STILL_USE_STORAGE: ["a.tsx", "b.tsx"], LIB_STILL_IMPORT_IDB: ["c.ts"] })}`;
    assert.deepEqual(
      [...parseExceptionLists(text)],
      [
        ["STILL_USE_STORAGE", ["a.tsx", "b.tsx"]],
        ["LIB_STILL_IMPORT_IDB", ["c.ts"]],
      ]
    );
  });

  it("reads the real config's lists", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const lists = parseExceptionLists(readFileSync(join(root, CONFIG_PATH), "utf8"));
    for (const name of ["STILL_IMPORT_FIXTURES", "STILL_USE_STORAGE", "LIB_STILL_USE_STORAGE", "LIB_STILL_IMPORT_IDB"]) {
      assert.ok(lists.get(name)?.length, name);
    }
  });

  it("passes when a list shrinks or stays the same", () => {
    const base = parseExceptionLists(config({ STILL_USE_STORAGE: ["a.tsx", "b.tsx"] }));
    const current = parseExceptionLists(config({ STILL_USE_STORAGE: ["b.tsx"] }));
    assert.deepEqual(findGrowth(base, current), { added: [], newLists: [] });
    assert.deepEqual(findGrowth(base, base), { added: [], newLists: [] });
  });

  it("fails on a file added to a list the base had", () => {
    const base = parseExceptionLists(config({ STILL_USE_STORAGE: ["a.tsx"] }));
    const current = parseExceptionLists(config({ STILL_USE_STORAGE: ["a.tsx", "new.tsx"] }));
    assert.deepEqual(findGrowth(base, current).added, [{ list: "STILL_USE_STORAGE", file: "new.tsx" }]);
  });

  it("reports a list the base didn't have without failing", () => {
    const current = parseExceptionLists(config({ LIB_STILL_USE_STORAGE: ["x.ts", "y.ts"] }));
    assert.deepEqual(findGrowth(new Map(), current), {
      added: [],
      newLists: [{ list: "LIB_STILL_USE_STORAGE", count: 2 }],
    });
  });
});
