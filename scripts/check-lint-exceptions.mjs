#!/usr/bin/env node
/**
 * check-lint-exceptions: the lint exception lists only shrink.
 *
 *   npm run check:lint-exceptions                 compares with origin/main
 *   npm run check:lint-exceptions -- <base-ref>   compares with another ref
 *
 * `apps/dristi-app/eslint.config.mjs` excuses files that broke the data rules before
 * the rules existed (the `*STILL_*` lists). A file comes off its list when it is fixed;
 * none is ever added, so new code is always checked in full. This fails when a list
 * holds a file the base branch's list doesn't. A list the base doesn't have at all comes
 * with a new rule and is reported, not failed.
 *
 * CI runs it on pull requests. Locally, when the base ref can't be read, it says so and
 * passes.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG_PATH = "apps/dristi-app/eslint.config.mjs";

const LIST = /^const (\w*STILL_\w+) = \[([\s\S]*?)\];/gm;
const ENTRY = /"([^"]+)"/g;

/** Every exception list in the config's text, by name. */
export function parseExceptionLists(text) {
  const lists = new Map();
  for (const [, name, body] of text.matchAll(LIST)) {
    lists.set(name, [...body.matchAll(ENTRY)].map(([, file]) => file));
  }
  return lists;
}

/** Files added to lists the base already had, and lists the base didn't have. */
export function findGrowth(base, current) {
  const added = [];
  const newLists = [];
  for (const [name, files] of current) {
    const before = base.get(name);
    if (!before) {
      newLists.push({ list: name, count: files.length });
      continue;
    }
    for (const file of files) if (!before.includes(file)) added.push({ list: name, file });
  }
  return { added, newLists };
}

function readBase(ref) {
  try {
    return execFileSync("git", ["show", `${ref}:${CONFIG_PATH}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const ref = process.argv[2] ?? "origin/main";
  const baseText = readBase(ref);
  if (baseText === null) {
    const message = `check:lint-exceptions: can't read ${CONFIG_PATH} at ${ref}.`;
    if (process.env.CI) {
      console.error(`${message} Fetch the base branch first.`);
      process.exit(1);
    }
    console.log(`${message} Skipped.`);
    process.exit(0);
  }
  const current = parseExceptionLists(readFileSync(join(REPO_ROOT, CONFIG_PATH), "utf8"));
  const { added, newLists } = findGrowth(parseExceptionLists(baseText), current);
  for (const { list, count } of newLists) {
    console.log(`New exception list ${list} (${count} file${count === 1 ? "" : "s"}), added with its rule.`);
  }
  if (added.length) {
    console.error(`The lint exception lists only shrink. Fix these files instead of excusing them:`);
    for (const { list, file } of added) console.error(`  ${list}: ${file}`);
    process.exit(1);
  }
  console.log(`Lint exception lists: none grew since ${ref}.`);
}
