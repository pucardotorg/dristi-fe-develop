import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  collidingDataModule,
  compareUrl,
  invalidFeatureName,
  LIB_DIR,
  moveProblem,
  parseArgs,
  pascalCase,
  recordNames,
  removeOldStore,
  renderDataFiles,
  writeDataFiles,
} from "./new-data.mjs";

describe("new-data", () => {
  it("names the classes after the feature", () => {
    assert.equal(pascalCase("hearing-reminders"), "HearingReminders");
    const files = renderDataFiles("hearing-reminders");
    assert.deepEqual(Object.keys(files).sort(), ["http.ts", "index.ts", "indexeddb.ts", "repository.ts"]);
    assert.match(files["repository.ts"], /export interface HearingRemindersRepository \{/);
    assert.match(files["http.ts"], /class HttpHearingRemindersRepository implements Partial<HearingRemindersRepository> \{\}/);
    assert.match(files["indexeddb.ts"], /const DB_NAME = "dristi-hearing-reminders";/);
    // A newer version left by another branch resets the demo database instead of failing.
    assert.match(files["indexeddb.ts"], /error\.name === "VersionError"/);
    assert.match(files["indexeddb.ts"], /await deleteDB\(DB_NAME\)/);
    assert.match(files["index.ts"], /repositoryFor<HearingRemindersRepository>\("hearing-reminders"/);
    assert.match(files["index.ts"], /satisfies OnlyContract</);
  });

  it("accepts kebab-case names and refuses others", () => {
    assert.equal(invalidFeatureName("vakalatnama"), null);
    assert.equal(invalidFeatureName("hearing-reminders"), null);
    for (const bad of ["", "HearingReminders", "hearing_reminders", "-x", "x-", "data", "api"]) {
      assert.notEqual(invalidFeatureName(bad), null, bad);
    }
  });

  it("writes the four files into lib/<feature>/data", () => {
    const root = mkdtempSync(join(tmpdir(), "new-data-"));
    try {
      const written = writeDataFiles(root, "vakalatnama");
      assert.equal(written.length, 4);
      for (const path of written) assert.ok(existsSync(join(root, path)), path);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("never overwrites a file that exists, and writes nothing then", () => {
    const root = mkdtempSync(join(tmpdir(), "new-data-"));
    try {
      const dir = join(root, LIB_DIR, "tasks", "data");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "repository.ts"), "// mine");
      assert.throws(() => writeDataFiles(root, "tasks"), /already has repository\.ts/);
      assert.equal(readFileSync(join(dir, "repository.ts"), "utf8"), "// mine");
      assert.equal(existsSync(join(dir, "http.ts")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses while an old lib/<feature>/data.ts would hide data/, and writes nothing", () => {
    const root = mkdtempSync(join(tmpdir(), "new-data-"));
    try {
      const feature = join(root, LIB_DIR, "vakalatnama");
      mkdirSync(feature, { recursive: true });
      writeFileSync(join(feature, "data.ts"), "export const REGISTRIES = [];");
      assert.equal(collidingDataModule(root, "vakalatnama"), join(LIB_DIR, "vakalatnama", "data.ts"));
      assert.throws(() => writeDataFiles(root, "vakalatnama"), /data\.ts would hide the new data\/ folder/);
      assert.equal(existsSync(join(feature, "data")), false);
      assert.equal(collidingDataModule(root, "tasks"), undefined);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("--record adds list, put and delete for one record, and an IndexedDB store for it", () => {
    const files = renderDataFiles("vakalatnama", { record: "Vakalatnama" });
    assert.match(files["repository.ts"], /import type \{ Vakalatnama \} from "\.\.\/types";/);
    assert.match(files["repository.ts"], /listVakalatnamas\(\): Promise<Vakalatnama\[\]>;/);
    assert.match(files["repository.ts"], /putVakalatnama\(record: Vakalatnama\): Promise<Vakalatnama>;/);
    assert.match(files["repository.ts"], /deleteVakalatnama\(id: string\): Promise<void>;/);
    assert.match(files["indexeddb.ts"], /"vakalatnamas": \{ key: string; value: Vakalatnama \};/);
    assert.match(files["indexeddb.ts"], /openDB<Schema>\(DB_NAME/);
    assert.match(files["indexeddb.ts"], /error\.name === "VersionError"/);
    assert.match(files["http.ts"], /implements Partial<VakalatnamaRepository> \{\}/);
  });

  it("names records in plain English plurals", () => {
    assert.deepEqual(recordNames("HearingReminder"), {
      record: "HearingReminder",
      plural: "HearingReminders",
      store: "hearing-reminders",
      one: "hearing reminder",
      many: "hearing reminders",
    });
    assert.equal(recordNames("Address").plural, "Addresses");
    assert.equal(recordNames("Party").plural, "Parties");
    assert.equal(recordNames("Day").plural, "Days");
  });

  it("parses the options and refuses unclear ones", () => {
    assert.deepEqual(parseArgs(["vakalatnama", "--move", "--record", "Vakalatnama"]), {
      feature: "vakalatnama",
      record: "Vakalatnama",
      move: true,
      base: "origin/main",
    });
    assert.equal(parseArgs(["x", "--base", "HEAD"]).base, "HEAD");
    assert.match(parseArgs(["x", "--record"]).error, /needs a value/);
    assert.match(parseArgs(["x", "--record", "vak"]).error, /PascalCase/);
    assert.match(parseArgs(["x", "--force"]).error, /Unknown option/);
    assert.match(parseArgs(["x", "y"]).error, /One feature at a time/);
    assert.match(parseArgs([]).error, /Name the feature/);
  });

  it("--move refuses a feature that isn't on the base, already moved, or has an old data.ts", () => {
    const on = (...paths) => (path) => paths.includes(path);
    const vak = `${LIB_DIR}/vakalatnama`;
    assert.match(moveProblem("vakalatnama", on()), /nothing to move/);
    assert.match(moveProblem("vakalatnama", on(vak, `${vak}/data/repository.ts`)), /already has a data layer/);
    assert.match(moveProblem("vakalatnama", on(vak, `${vak}/data.ts`)), /would hide the new data\/ folder/);
    assert.equal(moveProblem("vakalatnama", on(vak)), null);
  });

  it("--move takes only the feature's store.ts off the exception lists", () => {
    const config = [
      "const LIB_STILL_USE_STORAGE = [",
      '  "src/lib/applications/store.ts",',
      '  "src/lib/vakalatnama/prefs.ts",',
      '  "src/lib/vakalatnama/store.ts",',
      "];",
      'const LIB_STILL_IMPORT_IDB = ["src/lib/bulk/store.browser.ts"];',
    ].join("\n");
    const { text, removed, stillListed } = removeOldStore(config, "vakalatnama");
    assert.deepEqual(removed, ["src/lib/vakalatnama/store.ts"]);
    assert.deepEqual(stillListed, ["src/lib/vakalatnama/prefs.ts"]);
    assert.doesNotMatch(text, /vakalatnama\/store\.ts/);
    assert.match(text, /applications\/store\.ts/);
    assert.match(text, /bulk\/store\.browser\.ts/);
    assert.deepEqual(removeOldStore(config, "employee").removed, []);
  });

  it("links the move's PR with the data-move template", () => {
    assert.equal(
      compareUrl("https://github.com/pucardotorg/dristi-fe-develop.git\n", "origin/main", "chore/move-vak-data"),
      "https://github.com/pucardotorg/dristi-fe-develop/compare/main...chore/move-vak-data?expand=1&template=data-move.md"
    );
    assert.equal(
      compareUrl("git@github.com:pucardotorg/dristi-fe-develop.git", "origin/main", "b"),
      "https://github.com/pucardotorg/dristi-fe-develop/compare/main...b?expand=1&template=data-move.md"
    );
    assert.equal(compareUrl("https://gitlab.com/x/y.git", "origin/main", "b"), null);
  });
});
