import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { collidingDataModule, invalidFeatureName, LIB_DIR, pascalCase, renderDataFiles, writeDataFiles } from "./new-data.mjs";

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
});
