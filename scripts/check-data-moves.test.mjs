import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkDataMoves,
  countAddedCodeLines,
  localImports,
  oldStoresByFeature,
  typeMembers,
  watchedTypeFiles,
} from "./check-data-moves.mjs";
import { parseExceptionLists } from "./check-lint-exceptions.mjs";

const LIB = "apps/dristi-app/src/lib";
const lists = (storage, idb = []) =>
  parseExceptionLists(
    `const LIB_STILL_USE_STORAGE = [${storage.map((f) => `"${f}"`).join(", ")}];\n` +
      `const LIB_STILL_IMPORT_IDB = [${idb.map((f) => `"${f}"`).join(", ")}];`
  );

const STORE = `${LIB}/vak/store.ts`;
const TYPES = `${LIB}/vak/types.ts`;
const BASE_TYPES = `export type Vak = { id: string; status: "draft" | "signed" };`;
const BASE_STORE = `import { blank } from "./data";\nimport type { Vak } from "./types";\nlocalStorage.getItem("k");`;

/** A PR against a base where vak keeps data in its old store and has no data layer. */
function scenario({ files = {}, currentStorage = ["src/lib/vak/store.ts"], dataLayerOnBase = false, added = {} } = {}) {
  const base = { [STORE]: BASE_STORE, [TYPES]: BASE_TYPES, [`${LIB}/vak/data.ts`]: "export const blank = 1;" };
  const current = { ...base, ...files };
  return checkDataMoves({
    baseLists: lists(["src/lib/vak/store.ts"]),
    currentLists: lists(currentStorage),
    changed: new Set(Object.keys(files)),
    hasDataLayerOnBase: () => dataLayerOnBase,
    addedCodeLines: (path) => added[path] ?? 0,
    readBase: (path) => base[path] ?? null,
    readCurrent: (path) => (path in current ? current[path] : null),
  });
}

describe("typeMembers", () => {
  it("lists fields, nested fields and union values of exported types only", () => {
    const members = typeMembers(
      `export type A = { id: string; meta: { by: string }; tags: { name: string }[] };
       export interface B { kind: "x" | "y"; run(): void }
       type Private = { secret: string };
       export const value = { notAType: 1 };`
    );
    assert.deepEqual(
      [...members].sort(),
      ["A.id", "A.meta", "A.meta.by", "A.tags", "A.tags.name", "B.kind", 'B.kind="x"', 'B.kind="y"', "B.run"].sort()
    );
  });

  it("ignores changes to logic, comments and formatting", () => {
    const before = `export type A = { id: string };\nexport function f() { return 1; }`;
    const after = `// tidy\nexport type A = {\n  id: string;\n};\nexport function f() { return 2 + 0; }`;
    assert.deepEqual(typeMembers(after), typeMembers(before));
  });
});

describe("localImports and watchedTypeFiles", () => {
  it("follows the old store's same-folder imports to the files that exist", () => {
    assert.deepEqual(localImports(BASE_STORE, STORE), [`${LIB}/vak/data`, `${LIB}/vak/types`]);
    const base = { [STORE]: BASE_STORE, [`${LIB}/vak/data.ts`]: "", [TYPES]: "" };
    assert.deepEqual(watchedTypeFiles("vak", [STORE], (p) => base[p] ?? null).sort(), [`${LIB}/vak/data.ts`, TYPES].sort());
  });

  it("groups old stores by feature", () => {
    const byFeature = oldStoresByFeature(lists(["src/lib/a/store.ts", "src/lib/a/prefs.ts"], ["src/lib/b/x.ts"]));
    assert.deepEqual([...byFeature], [
      ["a", [`${LIB}/a/store.ts`, `${LIB}/a/prefs.ts`]],
      ["b", [`${LIB}/b/x.ts`]],
    ]);
  });
});

describe("checkDataMoves", () => {
  it("lock 1: a new field on an older feature's record fails while its data layer isn't on the base", () => {
    const { newData } = scenario({ files: { [TYPES]: `export type Vak = { id: string; urgent?: boolean; status: "draft" | "signed" };` } });
    assert.deepEqual(newData, [{ feature: "vak", path: TYPES, members: ["Vak.urgent"] }]);
  });

  it("lock 1: a new union value counts as new data", () => {
    const { newData } = scenario({ files: { [TYPES]: `export type Vak = { id: string; status: "draft" | "signed" | "urgent" };` } });
    assert.deepEqual(newData[0].members, ['Vak.status="urgent"']);
  });

  it("lock 1: also fails in the move PR itself (move and feature together)", () => {
    const { newData } = scenario({
      files: { [TYPES]: `export type Vak = { id: string; urgent: boolean; status: "draft" | "signed" };`, [STORE]: "moved" },
      currentStorage: [],
    });
    assert.equal(newData.length, 1);
  });

  it("lock 1: passes once the data layer is on the base", () => {
    const { newData } = scenario({
      files: { [TYPES]: `export type Vak = { id: string; urgent?: boolean; status: "draft" | "signed" };` },
      dataLayerOnBase: true,
    });
    assert.deepEqual(newData, []);
  });

  it("lock 1: a logic fix in a watched file passes", () => {
    const { newData } = scenario({ files: { [`${LIB}/vak/data.ts`]: "export const blank = 2;" } });
    assert.deepEqual(newData, []);
  });

  it("lock 2: an old store that gains lines while still excused fails", () => {
    const { frozen } = scenario({ files: { [STORE]: `${BASE_STORE}\nlocalStorage.setItem("urgent", "1");` }, added: { [STORE]: 1 } });
    assert.deepEqual(frozen, [{ feature: "vak", path: STORE }]);
  });

  it("lock 2: shrinking an old store passes", () => {
    const { frozen } = scenario({ files: { [STORE]: "localStorage.getItem('k');" }, added: { [STORE]: 0 } });
    assert.deepEqual(frozen, []);
  });

  it("lock 2: the move PR passes, because it takes the store off its list", () => {
    const { frozen, newData } = scenario({ files: { [STORE]: "getRepository()" }, currentStorage: [], added: { [STORE]: 12 } });
    assert.deepEqual({ frozen, newData }, { frozen: [], newData: [] });
  });

  it("nothing to check when the base lists no old stores (the PR that adds the lists)", () => {
    const result = checkDataMoves({
      baseLists: new Map(),
      currentLists: lists(["src/lib/vak/store.ts"]),
      changed: new Set([TYPES, STORE]),
      hasDataLayerOnBase: () => false,
      addedCodeLines: () => 5,
      readBase: () => null,
      readCurrent: () => "export type Vak = { id: string };",
    });
    assert.deepEqual(result, { newData: [], frozen: [] });
  });
});

describe("countAddedCodeLines", () => {
  it("counts added code, not blanks, comments or the file header", () => {
    const diff = ["+++ b/store.ts", "+", "+// note", "+ * doc", "+const x = 1;", "-const y = 2;", " context"].join("\n");
    assert.equal(countAddedCodeLines(diff), 1);
  });
});
