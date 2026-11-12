#!/usr/bin/env node
/**
 * new-data: start a feature's data layer, so every feature has the same shape.
 *
 *   npm run new:data -- <feature>                      a new feature
 *   npm run new:data -- <feature> --record <Type>      … with list/put/delete for one record
 *   npm run new:data -- <feature> --move [--record <Type>]
 *                                                      an older feature moving its data
 *
 * Writes apps/dristi-app/src/lib/<feature>/data/ with the four files the data rules
 * expect (AGENTS.md "Data", .agents/policies/data-seam.md):
 *   repository.ts  the contract: shared, only grows
 *   indexeddb.ts   the sandbox: IndexedDB in the browser (design)
 *   http.ts        the backend: empty until engineering connects it
 *   index.ts       getRepository(), chosen by NEXT_PUBLIC_DATA_SOURCE
 *
 * `--record Vakalatnama` adds the standard record methods (listVakalatnamas,
 * putVakalatnama, deleteVakalatnama) and an IndexedDB store for them; the record type is
 * imported from lib/<feature>/types.ts and needs an `id: string`.
 *
 * `--move` is for an older feature that keeps data in browser storage (rule 2.0). It
 * starts a branch of its own from the base (origin/main, or `--base <ref>`), so the move
 * can't land inside feature work, writes the files there, and takes the feature's old
 * `store.ts` off the lint exception list, so lint shows what's left to move. It doesn't
 * rewrite the store itself, and commits nothing.
 *
 * Designers may run it. After that, `http.ts` belongs to engineering. It refuses to
 * overwrite a file that already exists, or to run while an old `lib/<feature>/data.ts`
 * is in the way.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LIB_DIR = "apps/dristi-app/src/lib";
export const ESLINT_CONFIG = "apps/dristi-app/eslint.config.mjs";
export const MOVE_TEMPLATE = "data-move.md";

const FEATURE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RECORD_NAME = /^[A-Z][A-Za-z0-9]*$/;

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

/** The names generated for one record type: "HearingReminder" → listHearingReminders … */
export function recordNames(record) {
  const plural = /(s|x|z|ch|sh)$/.test(record)
    ? `${record}es`
    : /[^aeiou]y$/.test(record)
      ? `${record.slice(0, -1)}ies`
      : `${record}s`;
  const words = (text) => text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return {
    record,
    plural,
    store: words(plural).replaceAll(" ", "-"),
    one: words(record),
    many: words(plural),
  };
}

/** `npm run new:data -- …` arguments, or { error }. */
export function parseArgs(argv) {
  const options = { feature: undefined, record: undefined, move: false, base: "origin/main" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--move") options.move = true;
    else if (arg === "--record" || arg === "--base") {
      const value = argv[(i += 1)];
      if (!value || value.startsWith("--")) return { error: `${arg} needs a value.` };
      options[arg.slice(2)] = value;
    } else if (arg.startsWith("--")) return { error: `Unknown option ${arg}.` };
    else if (options.feature) return { error: `One feature at a time: got "${options.feature}" and "${arg}".` };
    else options.feature = arg;
  }
  const problem = invalidFeatureName(options.feature);
  if (problem) return { error: problem };
  if (options.record && !RECORD_NAME.test(options.record)) {
    return { error: `--record takes a type name in PascalCase, like Vakalatnama.` };
  }
  return options;
}

const HEADER_REPOSITORY = (feature) => `/**
 * The ${feature} contract: every read and write its screens may do.
 *
 * Two implementations answer it: the sandbox in the browser (\`./indexeddb.ts\`, design)
 * and the backend (\`./http.ts\`, engineering, filled in as endpoints arrive);
 * \`./index.ts\` picks one by \`NEXT_PUBLIC_DATA_SOURCE\`, and screens do not change.
 *
 * Shared by both teams and only grows: add methods (each with a one-line comment on what
 * it returns) and optional fields; never rename or remove one that \`http.ts\` already
 * implements (the type check fails if you do). No method takes the signed-in person's
 * id: the backend knows who is asking.
 */
`;

const CLEAR = `  /**
   * Wipe the sandbox's data ("Reset sandbox data", shown only in the sandbox).
   * Sandbox-only: \`http.ts\` need not implement it.
   */
  clear(): Promise<void>;`;

const HEADER_SANDBOX = (feature) => `/**
 * The ${feature} sandbox: answers the contract from IndexedDB in this browser. Design
 * owns this file.
 *
 * Behave like a server: every method is async, checks its input the way the backend
 * will, and can fail. Data saved here survives a page reload; if this sandbox should
 * reseed or reset on reload instead, say so here (see \`lib/tasks/data/indexeddb.ts\`).
 */
`;

/** Opening the database: shared by both sandbox shapes. */
const OPEN_DATABASE = (feature, dbType, upgrade) => `const DB_NAME = "dristi-${feature}";
// Raise this when you add a store, and create stores only if they're missing, so a
// browser on an older version upgrades cleanly. A browser on a newer version (from
// another branch) is reset, below.
const DB_VERSION = 1;

let dbPromise: Promise<${dbType}> | null = null;

function openDatabase(): Promise<${dbType}> {
  return openDB${dbType.includes("<") ? "<Schema>" : ""}(DB_NAME, DB_VERSION, {
${upgrade}
    blocking() {
      // Another tab is opening a newer version: let go, so it isn't left waiting.
      void dbPromise?.then((database) => database.close());
      dbPromise = null;
    },
  });
}

async function openOrReset(): Promise<${dbType}> {
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

function db(): Promise<${dbType}> {
  dbPromise ??= openOrReset().catch((error: unknown) => {
    dbPromise = null; // let the next call try again
    throw error;
  });
  return dbPromise;
}
`;

/** The four files, keyed by name, for one feature (and optionally one record type). */
export function renderDataFiles(feature, { record } = {}) {
  const name = pascalCase(feature);
  const contract = `${name}Repository`;
  const names = record ? recordNames(record) : null;

  const repository = names
    ? `${HEADER_REPOSITORY(feature)}
import type { ${record} } from "../types";

export interface ${contract} {
  /** Every ${names.one} the signed-in person can see. */
  list${names.plural}(): Promise<${record}[]>;
  /** Save one ${names.one}, new or changed. Returns it as stored. */
  put${record}(record: ${record}): Promise<${record}>;
  /** Delete one ${names.one} by id. Deleting one that isn't there is not an error. */
  delete${record}(id: string): Promise<void>;
${CLEAR}
}
`
    : `${HEADER_REPOSITORY(feature)}
export interface ${contract} {
${CLEAR}
}
`;

  const sandbox = names
    ? `${HEADER_SANDBOX(feature)}
import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { ${record} } from "../types";
import type { ${contract} } from "./repository";

interface Schema extends DBSchema {
  "${names.store}": { key: string; value: ${record} };
}

${OPEN_DATABASE(feature, "IDBPDatabase<Schema>", `    upgrade(database) {
      if (!database.objectStoreNames.contains("${names.store}")) {
        database.createObjectStore("${names.store}", { keyPath: "id" });
      }
    },`)}
export class IndexedDb${contract} implements ${contract} {
  async list${names.plural}(): Promise<${record}[]> {
    return (await db()).getAll("${names.store}");
  }

  async put${record}(record: ${record}): Promise<${record}> {
    if (!record.id) throw new Error("A ${names.one} needs an id.");
    await (await db()).put("${names.store}", record);
    return record;
  }

  async delete${record}(id: string): Promise<void> {
    await (await db()).delete("${names.store}", id);
  }

  async clear(): Promise<void> {
    await (await db()).clear("${names.store}");
  }
}
`
    : `${HEADER_SANDBOX(feature)}
import { deleteDB, openDB, type IDBPDatabase } from "idb";

import type { ${contract} } from "./repository";

${OPEN_DATABASE(feature, "IDBPDatabase", `    upgrade() {
      // Create stores here, e.g. if (!database.objectStoreNames.contains("items"))
      // database.createObjectStore("items", { keyPath: "id" }). Add a DBSchema type
      // with the first store (npm run new:data -- <feature> --record <Type> shows one).
    },`)}
export class IndexedDb${contract} implements ${contract} {
  async clear(): Promise<void> {
    const database = await db();
    const stores = [...database.objectStoreNames];
    if (stores.length === 0) return;
    const tx = database.transaction(stores, "readwrite");
    await Promise.all([...stores.map((store) => tx.objectStore(store).clear()), tx.done]);
  }
}
`;

  return {
    "repository.ts": repository,
    "indexeddb.ts": sandbox,
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

const collisionMessage = (path, feature) =>
  `${path} would hide the new data/ folder (both are imported as @/lib/${feature}/data). ` +
  `Rename it in its own commit (for example to registries.ts, after what it holds), then run this again.`;

/**
 * Write the files under `root`. Throws, writing nothing, if the name is bad, an old
 * `data.ts` is in the way, or any file exists.
 */
export function writeDataFiles(root, feature, { record } = {}) {
  const problem = invalidFeatureName(feature);
  if (problem) throw new Error(problem);
  const colliding = collidingDataModule(root, feature);
  if (colliding) throw new Error(collisionMessage(colliding, feature));
  const dir = join(root, LIB_DIR, feature, "data");
  const files = renderDataFiles(feature, { record });
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

/** Why `feature` can't be moved from the base, given `existsOnBase(path)`; null if it can. */
export function moveProblem(feature, existsOnBase) {
  const folder = `${LIB_DIR}/${feature}`;
  if (!existsOnBase(folder)) {
    return `${folder} isn't on the base branch, so there is nothing to move. For a new feature, run it without --move.`;
  }
  if (existsOnBase(`${folder}/data/repository.ts`)) {
    return `${feature} already has a data layer on the base branch. Add new data through it.`;
  }
  const colliding = ["data.ts", "data.tsx"].map((file) => `${folder}/${file}`).find(existsOnBase);
  if (colliding) return collisionMessage(colliding, feature);
  return null;
}

/**
 * Take the feature's old store (lib/<feature>/store.ts or .tsx) off the lint exception
 * lists. Returns the new config text, what came off, and the feature's files still on them.
 */
export function removeOldStore(configText, feature) {
  const prefix = `src/lib/${feature}/`;
  const removed = [];
  const text = configText.replace(/^[ \t]*"([^"]+)",?[ \t]*\r?\n/gm, (line, entry) => {
    if (entry === `${prefix}store.ts` || entry === `${prefix}store.tsx`) {
      removed.push(entry);
      return "";
    }
    return line;
  });
  const stillListed = [...text.matchAll(/"([^"]+)"/g)]
    .map(([, entry]) => entry)
    .filter((entry) => entry.startsWith(prefix));
  return { text, removed, stillListed: [...new Set(stillListed)] };
}

/** The GitHub page that opens the move's PR with the data-move template, or null. */
export function compareUrl(remoteUrl, base, branch) {
  const match = remoteUrl?.trim().match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
  if (!match) return null;
  const target = base.replace(/^origin\//, "");
  return `https://github.com/${match[1]}/${match[2]}/compare/${target}...${branch}?expand=1&template=${MOVE_TEMPLATE}`;
}

function git(args, { quiet = true } = {}) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", quiet ? "ignore" : "inherit"],
  });
}

function gitOk(args) {
  try {
    git(args);
    return true;
  } catch {
    return false;
  }
}

function startMove({ feature, record, base }) {
  if (base.startsWith("origin/") && !gitOk(["fetch", "--no-tags", "--quiet", "origin", base.slice("origin/".length)])) {
    console.log(`Couldn't fetch ${base}; using the copy this checkout already has.`);
  }
  if (!gitOk(["rev-parse", "--verify", "--quiet", `${base}^{commit}`])) {
    throw new Error(`Can't find ${base}. Pass another base with --base <ref>.`);
  }
  const problem = moveProblem(feature, (path) => gitOk(["cat-file", "-e", `${base}:${path}`]));
  if (problem) throw new Error(problem);
  if (git(["status", "--porcelain", "--untracked-files=no"]).trim()) {
    throw new Error("This checkout has uncommitted changes. Commit or stash them first: the move starts a branch of its own.");
  }
  const branch = `chore/move-${feature}-data`;
  if (gitOk(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`])) {
    throw new Error(`Branch ${branch} already exists. Continue there, or delete it to start over.`);
  }
  git(["switch", "--quiet", "--no-track", "-c", branch, base], { quiet: false });

  const written = writeDataFiles(REPO_ROOT, feature, { record });
  const configPath = join(REPO_ROOT, ESLINT_CONFIG);
  const { text, removed, stillListed } = removeOldStore(readFileSync(configPath, "utf8"), feature);
  if (removed.length) writeFileSync(configPath, text);
  let remote = null;
  try {
    remote = git(["remote", "get-url", "origin"]);
  } catch {
    // No origin: the link below is left out.
  }
  return { branch, written, removed, stillListed, url: compareUrl(remote, base, branch) };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const options = parseArgs(process.argv.slice(2));
  try {
    if (options.error) throw new Error(options.error);
    const { feature, record } = options;
    if (options.move) {
      const { branch, written, removed, stillListed, url } = startMove(options);
      console.log(`On a new branch, ${branch}, from ${options.base}. Wrote:
${written.map((path) => `  ${path}`).join("\n")}
${removed.length ? `Took ${removed.join(", ")} off the lint exception list: lint now shows what's left to move.` : `No lib/${feature}/store.ts was on the lint exception list.`}
${stillListed.length ? `Still excused (take each off when you move it):\n${stillListed.map((entry) => `  ${entry}`).join("\n")}\n` : ""}
Next, per .agents/policies/data-seam.md rule 2.0. This PR moves the data and nothing else:
  1. Commit these files alone: "chore: start ${feature}'s data layer".
  2. ${record ? `Check the contract matches what the old store keeps.` : `Add each read and write the old store does to data/repository.ts, and answer it in data/indexeddb.ts.`}
  3. Make the old store read and write through getRepository(), keeping the functions
     screens call: load into memory, show loading until then, save in the background.
  4. Give its screens loading, load-failed, save-failed and "not connected yet" states.
  5. No new fields and no visual changes: those go in a later PR, once this one merges.
Push, then open the PR with the data-move template${url ? `:\n  ${url}` : ` (.github/PULL_REQUEST_TEMPLATE/${MOVE_TEMPLATE}).`}`);
    } else {
      const written = writeDataFiles(REPO_ROOT, feature, { record });
      console.log(`Wrote:\n${written.map((path) => `  ${path}`).join("\n")}`);
      console.log(`
Next, per .agents/policies/data-seam.md:
  1. Add the feature's types to lib/${feature}/types.ts${record ? ` (${record} needs an id: string).` : "."}
  2. ${record ? "Add any other read or write" : "Add each read and write"} to data/repository.ts, with a one-line comment.
  3. Answer it in data/indexeddb.ts (a store per kind of record).
  4. Reach it from screens through a hook in lib/${feature}/ (or the feature's store).
Leave data/http.ts to engineering, and list the new methods under "Contract changes"
in the PR. For an older feature that keeps data in browser storage, use --move instead.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
