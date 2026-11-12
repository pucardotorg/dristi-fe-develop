#!/usr/bin/env node
/**
 * new-data: start a feature's data layer, so every feature has the same shape.
 *
 *   npm run new:data -- <feature>        e.g. npm run new:data -- hearing-reminders
 *
 * Writes apps/dristi-app/src/lib/<feature>/data/ with the four files the data rules
 * expect (AGENTS.md "Data", .agents/policies/data-seam.md):
 *   repository.ts  the contract: shared, only grows
 *   indexeddb.ts   the sandbox: IndexedDB in the browser (design)
 *   http.ts        the backend: empty until engineering connects it
 *   index.ts       getRepository(), chosen by NEXT_PUBLIC_DATA_SOURCE
 *
 * Designers may run it for a new feature, or for an existing feature whose data has no
 * repository yet. After that, `http.ts` belongs to engineering. It refuses to overwrite
 * a file that already exists, or to run while an old `lib/<feature>/data.ts` is in the way.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LIB_DIR = "apps/dristi-app/src/lib";

const FEATURE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** "hearing-reminders" → "HearingReminders". */
export function pascalCase(feature) {
  return feature
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

/** Why the name can't be used, or null when it can. */
export function invalidFeatureName(feature) {
  if (!feature) return "Name the feature: npm run new:data -- <feature>";
  if (!FEATURE_NAME.test(feature)) {
    return `"${feature}" isn't a feature folder name: use kebab-case, like hearing-reminders.`;
  }
  if (feature === "data" || feature === "api" || feature === "server") {
    return `"${feature}" is reserved for engineering's code in lib/.`;
  }
  return null;
}

/** The four files, keyed by name, for one feature. */
export function renderDataFiles(feature) {
  const name = pascalCase(feature);
  const contract = `${name}Repository`;
  return {
    "repository.ts": `/**
 * The ${feature} contract: every read and write its screens may do.
 *
 * Two implementations answer it: the sandbox in the browser (\`./indexeddb.ts\`, design)
 * and the backend (\`./http.ts\`, engineering, filled in as endpoints arrive);
 * \`./index.ts\` picks one by \`NEXT_PUBLIC_DATA_SOURCE\`, and screens do not change.
 *
 * Shared by both teams and only grows: add methods (each with a one-line comment on what
 * it returns) and optional fields; never rename or remove one that \`http.ts\` already
 * implements (the type check fails if you do).
 */

export interface ${contract} {
  /**
   * Wipe the sandbox's data ("Reset sandbox data", shown only in the sandbox).
   * Sandbox-only: \`http.ts\` need not implement it.
   */
  clear(): Promise<void>;
}
`,
    "indexeddb.ts": `/**
 * The ${feature} sandbox: answers the contract from IndexedDB in this browser. Design
 * owns this file.
 *
 * Behave like a server: every method is async, checks its input the way the backend
 * will, and can fail. Data saved here survives a page reload; if this sandbox should
 * reseed or reset on reload instead, say so here (see \`lib/tasks/data/indexeddb.ts\`).
 */

import { deleteDB, openDB, type IDBPDatabase } from "idb";

import type { ${contract} } from "./repository";

const DB_NAME = "dristi-${feature}";
// Raise this when you add a store, and create stores only if they're missing, so a
// browser on an older version upgrades cleanly. A browser on a newer version (from
// another branch) is reset, below. Add a DBSchema type with the first store (see
// lib/filing/data/indexeddb.ts).
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function openDatabase(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade() {
      // Create stores here, e.g. if (!database.objectStoreNames.contains("items"))
      // database.createObjectStore("items", { keyPath: "id" });
    },
    blocking() {
      // Another tab is opening a newer version: let go, so it isn't left waiting.
      void dbPromise?.then((database) => database.close());
      dbPromise = null;
    },
  });
}

async function openOrReset(): Promise<IDBPDatabase> {
  try {
    return await openDatabase();
  } catch (error) {
    // This browser has a newer version, left by another branch. It holds only demo
    // data, so start it over instead of failing every call.
    if (!(error instanceof DOMException && error.name === "VersionError")) throw error;
    await deleteDB(DB_NAME);
    return openDatabase();
  }
}

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openOrReset().catch((error: unknown) => {
    dbPromise = null; // let the next call try again
    throw error;
  });
  return dbPromise;
}

export class IndexedDb${contract} implements ${contract} {
  async clear(): Promise<void> {
    const database = await db();
    const stores = [...database.objectStoreNames];
    if (stores.length === 0) return;
    const tx = database.transaction(stores, "readwrite");
    await Promise.all([...stores.map((store) => tx.objectStore(store).clear()), tx.done]);
  }
}
`,
    "http.ts": `/**
 * The ${feature} repository against the DRISTI backend. Engineering owns this file.
 *
 * It implements the contract (\`repository.ts\`) one method at a time, as the backend's
 * endpoints arrive, calling them through \`@/lib/api\` and translating backend shapes
 * into the app's types here, so backend naming never reaches a screen. Until a method
 * exists, calling it rejects with \`NotIntegratedError\` ("${feature}.<method> is not
 * connected to the backend yet").
 *
 * No endpoints yet; none are guessed.
 */

import type { ${contract} } from "./repository";

export class Http${contract} implements Partial<${contract}> {}
`,
    "index.ts": `/**
 * Repository access for ${feature}. \`getRepository()\` chooses the implementation once,
 * on first use, from \`NEXT_PUBLIC_DATA_SOURCE\` (\`lib/data/source.ts\`): the sandbox
 * (\`indexeddb.ts\`) or the backend (\`http.ts\`). Screens call it through the feature's
 * store or hook.
 */

import { browserOnly, repositoryFor, type OnlyContract } from "@/lib/data/source";

import { Http${contract} } from "./http";
import { IndexedDb${contract} } from "./indexeddb";
import type { ${contract} } from "./repository";

export type { ${contract} } from "./repository";

export const getRepository = repositoryFor<${contract}>("${feature}", {
  sandbox: browserOnly("${feature}", () => new IndexedDb${contract}()),
  http: () => new Http${contract}() satisfies OnlyContract<Http${contract}, ${contract}>,
});
`,
  };
}

/**
 * A `lib/<feature>/data.ts` (or `.tsx`) beside the new `data/` folder would win the import
 * `@/lib/<feature>/data`, so screens would keep reaching the old file. Returns its path.
 */
export function collidingDataModule(root, feature) {
  return ["data.ts", "data.tsx"]
    .map((file) => join(LIB_DIR, feature, file))
    .find((path) => existsSync(join(root, path)));
}

/**
 * Write the files under `root`. Throws, writing nothing, if the name is bad, an old
 * `data.ts` is in the way, or any file exists.
 */
export function writeDataFiles(root, feature) {
  const problem = invalidFeatureName(feature);
  if (problem) throw new Error(problem);
  const colliding = collidingDataModule(root, feature);
  if (colliding) {
    throw new Error(
      `${colliding} would hide the new data/ folder (both are imported as @/lib/${feature}/data). ` +
        `Rename it in its own commit (for example to registries.ts, after what it holds), then run this again.`
    );
  }
  const dir = join(root, LIB_DIR, feature, "data");
  const files = renderDataFiles(feature);
  const taken = Object.keys(files).filter((file) => existsSync(join(dir, file)));
  if (taken.length) {
    throw new Error(
      `${relative(root, dir)} already has ${taken.join(", ")}. Extend those files instead.`
    );
  }
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  return Object.keys(files).map((file) => relative(root, join(dir, file)));
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const feature = process.argv[2];
  try {
    const written = writeDataFiles(REPO_ROOT, feature);
    console.log(`Wrote:\n${written.map((path) => `  ${path}`).join("\n")}`);
    console.log(`
Next, per .agents/policies/data-seam.md:
  1. Add the feature's types to lib/${feature}/types.ts.
  2. Add each read and write to data/repository.ts, with a one-line comment.
  3. Answer it in data/indexeddb.ts (a store per kind of record).
  4. Reach it from screens through a hook in lib/${feature}/ (or the feature's store).
Leave data/http.ts to engineering, and list the new methods under "Contract changes"
in the PR. For an older feature, move its data in a PR of its own, before feature work.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
