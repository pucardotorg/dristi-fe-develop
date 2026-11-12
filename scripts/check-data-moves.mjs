#!/usr/bin/env node
/**
 * check-data-moves: an older feature moves its data first, in a PR of its own.
 *
 *   npm run check:data-moves                 compares with origin/main
 *   npm run check:data-moves -- <base-ref>   compares with another ref
 *
 * An older feature keeps data in browser storage through a store excused from the lint
 * rules (LIB_STILL_USE_STORAGE / LIB_STILL_IMPORT_IDB in apps/dristi-app/eslint.config.mjs).
 * Two checks keep new data out of those stores (.agents/policies/data-seam.md rule 2.0):
 *
 *   1. New data waits for the move. While the feature has no data/repository.ts on the
 *      base branch, its record types may not gain fields or values. The record types are
 *      the feature's types.ts and the same-feature modules its old stores import. Only
 *      type members count, so a logic fix in those files passes.
 *   2. Old stores are frozen. An excused store may lose lines but gain none, except in
 *      the PR that moves it, which also takes it off its exception list.
 *
 * The PR label "old-store-fix" (engineering applies it) lets a genuine fix through: the
 * findings are printed and the check passes.
 *
 * CI runs it on pull requests. Locally, when the base ref can't be read, it says so and
 * passes.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { CONFIG_PATH, parseExceptionLists } from "./check-lint-exceptions.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const APP_DIR = "apps/dristi-app";
export const OVERRIDE_LABEL = "old-store-fix";
const OLD_STORE_LISTS = ["LIB_STILL_USE_STORAGE", "LIB_STILL_IMPORT_IDB"];
const FEATURE_OF = /^src\/lib\/([^/]+)\//;

/** Old stores on the base branch, repo-relative, by feature. */
export function oldStoresByFeature(lists) {
  const byFeature = new Map();
  for (const name of OLD_STORE_LISTS) {
    for (const entry of lists.get(name) ?? []) {
      const feature = entry.match(FEATURE_OF)?.[1];
      if (!feature) continue;
      const files = byFeature.get(feature) ?? [];
      files.push(`${APP_DIR}/${entry}`);
      byFeature.set(feature, files);
    }
  }
  return byFeature;
}

/** Every old-store path still on a list, repo-relative. */
export function listedOldStores(lists) {
  return new Set([...oldStoresByFeature(lists).values()].flat());
}

/**
 * The record shape a module exports, as "Type.field" and "Type=value" entries:
 * properties of exported interfaces and object types (nested ones too) and the literal
 * values of exported unions. Functions, values and comments are ignored.
 */
export function typeMembers(text, fileName = "module.ts") {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const members = new Set();
  const isExported = (node) => node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

  function collect(prefix, node) {
    if (!node) return;
    if (ts.isTypeLiteralNode(node) || ts.isInterfaceDeclaration(node)) {
      for (const member of node.members) {
        if (!(ts.isPropertySignature(member) || ts.isMethodSignature(member)) || !member.name) continue;
        const path = `${prefix}.${member.name.getText(source)}`;
        members.add(path);
        if (ts.isPropertySignature(member)) collect(path, member.type);
      }
    } else if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      for (const part of node.types) collect(prefix, part);
    } else if (ts.isParenthesizedTypeNode(node)) {
      collect(prefix, node.type);
    } else if (ts.isArrayTypeNode(node)) {
      collect(prefix, node.elementType);
    } else if (ts.isTypeReferenceNode(node)) {
      for (const argument of node.typeArguments ?? []) collect(prefix, argument);
    } else if (ts.isLiteralTypeNode(node) && !ts.isPrefixUnaryExpression(node.literal)) {
      if (node.literal.kind !== ts.SyntaxKind.NullKeyword) members.add(`${prefix}=${node.literal.getText(source)}`);
    }
  }

  for (const statement of source.statements) {
    if (!isExported(statement)) continue;
    if (ts.isInterfaceDeclaration(statement)) collect(statement.name.text, statement);
    else if (ts.isTypeAliasDeclaration(statement)) collect(statement.name.text, statement.type);
  }
  return members;
}

/** Same-folder modules a file imports ("./types"), as repo-relative candidate paths. */
export function localImports(text, fromPath) {
  const dir = posix.dirname(fromPath);
  const specifiers = [...text.matchAll(/\bfrom\s+["'](\.\/[^"']+)["']/g)].map(([, spec]) => spec);
  return specifiers.map((spec) => posix.join(dir, spec));
}

/** The record-type files to watch for one older feature. */
export function watchedTypeFiles(feature, storePaths, readBase) {
  const watched = new Set([`${APP_DIR}/src/lib/${feature}/types.ts`]);
  for (const store of storePaths) {
    const text = readBase(store);
    if (text === null) continue;
    for (const base of localImports(text, store)) {
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        if (readBase(candidate) !== null) watched.add(candidate);
      }
    }
  }
  return [...watched];
}

/**
 * Both checks, from what the base and the PR hold.
 *   baseLists, currentLists  the exception lists (parseExceptionLists)
 *   changed                  repo-relative paths the PR changes
 *   hasDataLayerOnBase(f)    whether lib/<f>/data/repository.ts is on the base branch
 *   addedCodeLines(path)     lines the PR adds to a file, ignoring blanks and comments
 *   readBase(path), readCurrent(path)  file text, or null when missing
 */
export function checkDataMoves({
  baseLists,
  currentLists,
  changed,
  hasDataLayerOnBase,
  addedCodeLines,
  readBase,
  readCurrent,
}) {
  const newData = [];
  const frozen = [];
  const stillListed = listedOldStores(currentLists);

  for (const [feature, stores] of oldStoresByFeature(baseLists)) {
    for (const store of stores) {
      if (!changed.has(store) || !stillListed.has(store) || readCurrent(store) === null) continue;
      if (addedCodeLines(store) > 0) frozen.push({ feature, path: store });
    }

    if (hasDataLayerOnBase(feature)) continue;
    for (const path of watchedTypeFiles(feature, stores, readBase)) {
      if (!changed.has(path)) continue;
      const current = readCurrent(path);
      if (current === null) continue;
      const before = typeMembers(readBase(path) ?? "", path);
      const added = [...typeMembers(current, path)].filter((member) => !before.has(member));
      if (added.length) newData.push({ feature, path, members: added });
    }
  }
  return { newData, frozen };
}

/** Lines a unified diff adds, ignoring blank and comment-only lines. */
export function countAddedCodeLines(diff) {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1).trim())
    .filter((line) => line && !/^(\/\/|\/\*|\*)/.test(line)).length;
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const ref = process.argv[2] ?? "origin/main";
  if (git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]) === null) {
    const message = `check:data-moves: can't read ${ref}.`;
    if (process.env.CI) {
      console.error(`${message} Fetch the base branch first.`);
      process.exit(1);
    }
    console.log(`${message} Skipped.`);
    process.exit(0);
  }
  // Locally, compare with where the branch started; in CI the checkout is already the
  // PR merged onto the base, so the base itself is right.
  const from = git(["merge-base", ref, "HEAD"])?.trim() || ref;
  const readBase = (path) => git(["show", `${from}:${path}`]);
  const readCurrent = (path) => (existsSync(join(REPO_ROOT, path)) ? readFileSync(join(REPO_ROOT, path), "utf8") : null);
  const changed = new Set((git(["diff", "--name-only", from]) ?? "").split("\n").filter(Boolean));

  const { newData, frozen } = checkDataMoves({
    baseLists: parseExceptionLists(readBase(CONFIG_PATH) ?? ""),
    currentLists: parseExceptionLists(readCurrent(CONFIG_PATH) ?? ""),
    changed,
    hasDataLayerOnBase: (feature) => git(["cat-file", "-e", `${ref}:${APP_DIR}/src/lib/${feature}/data/repository.ts`]) !== null,
    addedCodeLines: (path) => countAddedCodeLines(git(["diff", "-U0", from, "--", path]) ?? ""),
    readBase,
    readCurrent,
  });

  for (const { feature, path, members } of newData) {
    console.error(`New data in ${feature}, whose data layer isn't on ${ref} yet:`);
    console.error(`  ${path}: ${members.join(", ")}`);
  }
  for (const { path } of frozen) {
    console.error(`Old store grew: ${path} (it keeps data in browser storage and is frozen).`);
  }
  if (!newData.length && !frozen.length) {
    console.log("Data moves: no new data in an older feature's old store.");
    process.exit(0);
  }
  const labels = (process.env.PR_LABELS ?? "").split(",").map((label) => label.trim());
  if (labels.includes(OVERRIDE_LABEL)) {
    console.log(`Allowed by the "${OVERRIDE_LABEL}" label: a fix that adds no data.`);
    process.exit(0);
  }
  const features = [...new Set([...newData, ...frozen].map(({ feature }) => feature))];
  console.error(`
Move the feature's data first, in a PR of its own, and merge it; then add the data on top:
${features.map((feature) => `  npm run new:data -- ${feature} --move`).join("\n")}
See .agents/policies/data-seam.md rule 2.0. A genuine fix that adds no data can ask
engineering for the "${OVERRIDE_LABEL}" label.`);
  process.exit(1);
}
