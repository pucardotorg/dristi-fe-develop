/**
 * Moves the English a user sees out of the code and into `messages/en.json`, replacing it
 * with message keys. The rules it applies are in `docs/localization.md`.
 *
 *   npx tsx scripts/extract-messages.mts             dry run: writes the report, changes nothing
 *   npx tsx scripts/extract-messages.mts --write     rewrites the code and the catalogs
 *
 * Options: `--report <file>` (default `scripts/extraction-report.md`), `--preview <dir>`
 * (dry run only: writes the rewritten files there instead of in place).
 *
 * Safe to re-run. A key is never English, a `t(…)` call is never text, existing catalog
 * values are never overwritten, and keys that code no longer uses are listed, not deleted.
 * Anything the script cannot change safely is listed in the report with its file and line.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type * as TS from "typescript";

/* Resolved from the app, so the script runs the TypeScript version the app builds with. */
const APP_ROOT = path.resolve(argValue("--app") ?? process.cwd());
const requireFromApp = createRequire(path.join(APP_ROOT, "package.json"));
const ts = requireFromApp("typescript") as typeof TS;

const WRITE = process.argv.includes("--write");
const REPORT_FILE = path.resolve(argValue("--report") ?? path.join(APP_ROOT, "scripts/extraction-report.md"));
const PREVIEW_DIR = argValue("--preview");
const SRC = path.join(APP_ROOT, "src");
const MESSAGES_DIR = path.join(APP_ROOT, "messages");

function argValue(name: string): string | undefined {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

/* ───────────────────────────── Rules ───────────────────────────── */

/** Generic actions shared app-wide. Exact, case-sensitive matches only. */
const COMMON: Record<string, string> = {
  Close: "common_close",
  Cancel: "common_cancel",
  Save: "common_save",
  Back: "common_back",
  Next: "common_next",
  Submit: "common_submit",
};

/** Props and properties whose value is always text a person reads. */
const TEXT_PROPS = new Set([
  "label", "aria-label", "ariaLabel", "title", "placeholder", "alt", "description", "term",
  "help", "tip", "tooltip", "note", "body", "heading", "legend", "caption", "warning",
  "eyebrow", "empty", "prompt", "aria-description", "aria-roledescription", "aria-valuetext",
  "aria-placeholder", "subtitle", "message", "hint", "summary", "text",
]);
const TEXT_PROP_SUFFIX = /(Label|Title|Description|Placeholder|Hint|Heading|Text|Message)$/;

/** Never text, whatever they hold. */
const NEVER_PROPS = new Set([
  "d", "id", "key", "href", "src", "className", "class", "type", "variant", "name", "role",
  "htmlFor", "as", "size", "tone", "side", "align", "icon", "method", "target", "rel", "lang",
  "dir", "form", "pattern", "autoComplete", "inputMode", "mode", "fill", "stroke", "viewBox",
  "xmlns", "style", "ref", "slot", "accept", "encType", "action", "sizes", "srcSet", "loading",
  "sandbox", "allow", "download", "kind", "status", "state", "color", "intent", "path", "to",
  "route", "query", "locale", "format", "unit", "currency", "code", "field", "column", "sort",
  "order", "group", "category", "stage", "step", "tab", "view", "layout", "position",
  "orientation", "placement", "data", "testId", "value", "defaultValue", "url", "email",
  "phone", "mobile", "botd", "clause", "slots", "token", "mime", "ext", "fileName", "filename",
  "font", "en", "ml", "hi", "gu", "pa", "transform", "strokeWidth", "points", "x", "y",
  "cx", "cy", "r", "rx", "ry", "width", "height", "aria-hidden", "tabIndex", "autoFocus",
  "aria-labelledby", "aria-describedby", "aria-controls", "aria-current", "aria-live",
  "aria-haspopup", "aria-expanded", "aria-invalid", "aria-required", "aria-selected",
  "aria-checked", "aria-pressed", "aria-disabled", "aria-orientation", "aria-modal",
  "aria-atomic", "aria-busy", "aria-level", "aria-owns", "aria-sort", "aria-valuemax",
  "aria-valuemin", "aria-valuenow", "aria-colcount", "aria-rowcount", "aria-colindex",
  "aria-rowindex", "aria-posinset", "aria-setsize", "aria-errormessage", "aria-keyshortcuts",
  "aria-multiline", "aria-multiselectable", "aria-readonly", "aria-relevant", "aria-details",
  "aria-flowto", "aria-activedescendant", "aria-autocomplete",
]);

/** Toast-like calls whose first argument is a message. */
const MESSAGE_CALLS = /^(toast|notify|alert|confirm)(\.\w+)?$|^set[A-Z]\w*(Error|Message|Notice|Status|Title|Text|Label|Hint)$/;

/** String methods: a value they are called on is being worked with, not shown. */
const STRING_METHODS = /^(split|toLowerCase|toUpperCase|toLocaleLowerCase|toLocaleUpperCase|includes|startsWith|endsWith|indexOf|lastIndexOf|localeCompare|match|matchAll|search|replace|replaceAll|trim|trimStart|trimEnd|normalize|slice|substring|charAt|charCodeAt|codePointAt|padStart|padEnd|repeat|concat|at|length)$/;

/** Constants holding sample data, not interface text. */
const DEMO_CONSTANT = /^(DEMO|SAMPLE|MOCK|FIXTURE)_/;

/** Files skipped on purpose, with the reason the report gives. */
const SKIPPED_FILES: { test: (rel: string) => boolean; reason: string }[] = [
  { test: (rel) => /\.test\.tsx?$/.test(rel) || rel.endsWith(".d.ts"), reason: "Tests and type declarations" },
  { test: (rel) => rel.startsWith("src/i18n/"), reason: "The localization setup itself" },
  { test: (rel) => /(^|\/)(fixtures?|sandbox|sample-[\w-]+|demo-[\w-]+)\.tsx?$/.test(rel) || rel.includes("/fixtures/"), reason: "Fixture and sandbox demo data (comes from the back end later)" },
  { test: (rel) => rel === "src/lib/summons/content.ts", reason: "Printed summons text: a court document, language set by the court (later item 17)" },
  { test: (rel) => rel === "src/lib/court/places.ts", reason: "Per-court names and places: data, not interface text" },
  { test: (rel) => rel === "src/lib/court/localize.ts", reason: "Court text layer rules (English patterns it matches)" },
  { test: (rel) => rel === "src/lib/bulk/excel-spec.ts", reason: "Spreadsheet column headers must match uploaded files" },
  { test: (rel) => rel === "src/lib/locale-config.ts", reason: "Language names are shown in their own script" },
  { test: (rel) => rel === "src/lib/tasks/transitions.ts", reason: "Task and application history sentences (later item 1)" },
  { test: (rel) => rel.startsWith("src/app/api/"), reason: "Server API routes, no interface" },
  { test: (rel) => rel.startsWith("src/app/feedback-kit/"), reason: "Internal showcase of the feedback components, not a product screen (confirm)" },
  { test: (rel) => rel.startsWith("src/provakil/") || rel.startsWith("src/app/provakil/"), reason: "Provakil mock: a stand-in for a third-party product, not part of DRISTI (its README)" },
];

/** Logic modules with no React, where no translator exists. */
function isLibFile(rel: string): boolean {
  return rel.includes("/lib/") || rel.endsWith(".ts");
}

/** Order wording stays English: it is court document text (later item 17). */
const ORDER_TEMPLATE_FILES = new Set(["src/lib/employee/order-templates.ts"]);

/* ───────────────────────────── Types ───────────────────────────── */

type Edit = { start: number; end: number; text: string };

type Category =
  | "Complex split sentence"
  | "Text in a helper outside a component"
  | "Sentence built in lib/"
  | "Unclear prop"
  | "Unclear string"
  | "Joined with +"
  | "Reads copy.en directly"
  | "Key used as data"
  | "Key shown outside a component"
  | "Default text for a prop"
  | "Copy text with a template"
  | "English used as a value";

type Finding = { file: string; line: number; category: Category; text: string; fix: string };

type Skip = { file: string; line?: number; text: string; reason: string };

/** How text reaches the screen once it is a key. */
type Tracked = { strict: boolean };

type FileState = {
  rel: string;
  sf: TS.SourceFile;
  prefix: string;
  edits: Edit[];
  /** Components and hooks that need a translator, by their body. */
  needsTranslator: Set<TS.FunctionLikeDeclaration>;
  translator: string;
  usesTranslateText: boolean;
  usesMessageKey: boolean;
  isClient: boolean;
  /** Hook dependency lists the translator was already added to. */
  depsDone: Set<TS.Node>;
};

/* ───────────────────────────── Program ───────────────────────────── */

const configPath = path.join(APP_ROOT, "tsconfig.json");
const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (d) => {
    throw new Error(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  },
});
if (!parsed) throw new Error("Could not read tsconfig.json");
const program = ts.createProgram({
  rootNames: parsed.fileNames.filter((f) => f.startsWith(SRC + path.sep)),
  options: { ...parsed.options, noEmit: true, incremental: false },
});
const checker = program.getTypeChecker();

const english = readCatalog("en");
const hindi = readCatalog("hi");
const newMessages = new Map<string, string>();
const findings: Finding[] = [];
const skips: Skip[] = [];
const files = new Map<string, FileState>();
/** Converted declarations, so the places that show them can be found. */
const trackedDeclarations = new Map<TS.Node, Tracked>();
/** Variables whose `Record<…, string>` annotation becomes `Record<…, MessageKey>`. */
const strictVariables = new Set<TS.Node>();
/** `Record<…, string>` annotations that may become `MessageKey`, with their constant. */
const strictCandidates = new Map<TS.Node, TS.VariableDeclaration>();
/** Literals replaced by a key, to check a map was converted completely. */
const convertedLiterals = new Set<TS.Node>();
/** Converted declarations whose text also builds other text (an order sentence): kept English. */
const unsafeDeclarations = new Set<TS.Node>();
/** Nodes another rule already handled, so nothing is converted twice. */
const claimed = new Set<TS.Node>();
/** Where each English text appears, for the shared-candidates list. */
const textFiles = new Map<string, Set<string>>();
/** Keys reached from code this run (new or existing). */
const keysInUse = new Set<string>();
let singleWordValues = 0;

function readCatalog(locale: string): Record<string, string> {
  const file = path.join(MESSAGES_DIR, `${locale}.json`);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>;
}

/* ───────────────────────────── Text tests ───────────────────────────── */

const KEY_SHAPE = /^[a-z][A-Za-z0-9]*_[A-Za-z0-9_]+$/;

function hasLetters(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

/** URLs, paths, CSS classes, identifiers, formats: things that only look like words. */
function looksLikeCode(text: string): boolean {
  const s = text.trim();
  if (!s) return true;
  if (KEY_SHAPE.test(s)) return true;
  if (/^(https?:|mailto:|tel:|\/|\.\/|#|@|data:)/.test(s)) return true;
  if (/^[A-Z0-9_]+$/.test(s) && s.length > 1 && s.includes("_")) return true;
  if (!/\s/.test(s) && /[./:_=@#\\[\]{}()<>]/.test(s) && !/[.!?:]$/.test(s)) return true;
  if (!/\s/.test(s) && /^[a-z]+[A-Z]\w*$/.test(s)) return true;
  if (!/\s/.test(s) && /^[a-z0-9]+(-[a-z0-9]+)+$/.test(s)) return true;
  const tokens = s.split(/\s+/);
  if (tokens.every((t) => /^[!a-z0-9:\-/[\].#%()_&>*~+]+$/.test(t)) && tokens.some((t) => /[-:[\]/]/.test(t)))
    return true;
  return false;
}

/** Reads as a sentence or phrase: several words, at least one ordinary lowercase word. */
function isSentenceLike(text: string): boolean {
  const s = text.trim();
  if (!hasLetters(s) || looksLikeCode(s)) return false;
  // A list packed into one string (one entry per line) is data.
  if ((s.match(/\n/g) ?? []).length >= 3) return false;
  if (!/\s/.test(s)) return false;
  if (!/(^|\s)[a-z]{2,}[a-z'’,.:;!?)]*(\s|$)/.test(s)) return false;
  return /^[“"'‘(]?[A-Z0-9]/.test(s) || /[.?!:]$/.test(s);
}

/** Any visible text in a place that only ever holds text. */
function isTextInTextPlace(text: string): boolean {
  const s = text.trim();
  return hasLetters(s) && !looksLikeCode(s);
}

/* ───────────────────────────── ICU ───────────────────────────── */

/** Escapes literal text so ICU shows it as written. */
function escapeIcu(text: string): string {
  return text
    .replace(/'(?=[{}#])/g, "''")
    .replace(/[{}]/g, (c) => `'${c}'`)
    .replace(/<(?=[A-Za-z/])/g, "'<'");
}

/** Copy text keeps its `{name}` slots (filled by `fillCopy`); everything else is escaped. */
function copyToIcu(text: string): string {
  return text
    .split(/(\{[A-Za-z][A-Za-z0-9_]*\})/)
    .map((part, i) => (i % 2 === 1 ? part : escapeIcu(part)))
    .join("");
}

/* ───────────────────────────── Keys ───────────────────────────── */

function camel(words: string[]): string {
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

function words(message: string): string[] {
  return message
    .replace(/<\/?[a-z0-9]+>/g, " ")
    // {causeTitle} → "cause title", so the key reads itemCauseTitle, not itemCausetitle.
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[’']/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

/** Per prefix: message → key, and every key taken. */
const keysByPrefix = new Map<string, { byMessage: Map<string, string>; taken: Set<string> }>();

function prefixState(prefix: string) {
  let state = keysByPrefix.get(prefix);
  if (!state) {
    const taken = new Set(Object.keys(english).filter((k) => k.startsWith(prefix + "_")));
    for (const k of newMessages.keys()) if (k.startsWith(prefix + "_")) taken.add(k);
    const byMessage = new Map<string, string>();
    for (const k of taken) byMessage.set(english[k] ?? newMessages.get(k) ?? "", k);
    state = { byMessage, taken };
    keysByPrefix.set(prefix, state);
  }
  return state;
}

/**
 * The key for a message in a file. The same message in one file shares a key; the six
 * generic actions use `common_`. Collisions extend the name, then take a readable role
 * suffix (`Label`, `Placeholder`), then a number.
 */
function keyFor(state: FileState, message: string, role: string, source: string): string {
  const common = COMMON[message];
  if (common) {
    if (!(common in english)) newMessages.set(common, message);
    remember(common, message, state.rel, source);
    return common;
  }
  const prefix = state.prefix;
  const ps = prefixState(prefix);
  const existing = ps.byMessage.get(message);
  if (existing) {
    remember(existing, message, state.rel, source);
    return existing;
  }
  const all = words(message);
  const base = all.length ? all : ["text"];
  const candidates: string[] = [];
  for (let n = Math.min(6, base.length); n <= base.length; n++) candidates.push(camel(base.slice(0, n)));
  // Readable ways to tell near-identical messages apart, before falling back to a number.
  const short = camel(base.slice(0, 6));
  const roleSuffix = role ? role.replace(/^aria-/, "aria").replace(/-(\w)/g, (_, c: string) => c.toUpperCase()) : "";
  if (roleSuffix) candidates.push(short + roleSuffix.charAt(0).toUpperCase() + roleSuffix.slice(1));
  for (const suffix of punctuationSuffixes(message)) candidates.push(short + suffix);
  let key = "";
  for (const c of candidates) {
    const k = `${prefix}_${c}`;
    if (!ps.taken.has(k)) {
      key = k;
      break;
    }
  }
  for (let n = 2; !key; n++) {
    const k = `${prefix}_${candidates[0]}${n}`;
    if (!ps.taken.has(k)) key = k;
  }
  ps.taken.add(key);
  ps.byMessage.set(message, key);
  newMessages.set(key, message);
  remember(key, message, state.rel, source);
  return key;
}

/** "Pay {amount}?" → Question, "+1 case" → Plus, "payment reference" → Lowercase. */
function punctuationSuffixes(message: string): string[] {
  const m = message.trim();
  const out: string[] = [];
  if (/\?$/.test(m)) out.push("Question");
  if (/(…|\.\.\.)$/.test(m)) out.push("Ellipsis");
  if (/:$/.test(m)) out.push("Colon");
  if (/!$/.test(m)) out.push("Exclamation");
  if (/\.$/.test(m)) out.push("Sentence");
  if (/^\+/.test(m)) out.push("Plus");
  if (/^[−-]/.test(m)) out.push("Minus");
  if (/^[a-z]/.test(m)) out.push("Lowercase");
  if (/^[A-Z][^a-z]*$/.test(m) && /[A-Z]{2}/.test(m)) out.push("Uppercase");
  return out;
}

function remember(key: string, message: string, rel: string, source: string) {
  keysInUse.add(key);
  const set = textFiles.get(source) ?? new Set<string>();
  set.add(rel);
  textFiles.set(source, set);
  void message;
}

/**
 * The camelCase prefix for a file, unique across the app. `content.ts` takes its folder
 * (`lib/sign-in/content.ts` → `signIn`), route files take folder and file
 * (`settings/page.tsx` → `settingsPage`), every other file its own name. Route groups,
 * dynamic segments and the top-level folders are ignored; a clash adds the parent folder.
 */
function computePrefixes(rels: string[]): Map<string, string> {
  const ROUTE_FILES = new Set(["page", "layout", "index", "loading", "error", "not-found", "template", "default", "route"]);
  const tokensOf = (rel: string): { tokens: string[]; base: number } => {
    const parts = rel
      .replace(/^src\//, "")
      .replace(/\.(tsx?|mts)$/, "")
      .split("/")
      .filter((s) => !/^\(.*\)$/.test(s) && !/^\[.*\]$/.test(s) && !["app", "components", "lib", "hooks"].includes(s));
    const file = parts[parts.length - 1] ?? "app";
    if ((file === "content" || file === "copy") && parts.length > 1) return { tokens: parts.slice(0, -1), base: 1 };
    if (ROUTE_FILES.has(file)) return { tokens: parts, base: Math.min(2, parts.length) };
    return { tokens: parts, base: 1 };
  };
  const name = (parts: string[]) => camel(parts.join("-").split(/[^A-Za-z0-9]+/).filter(Boolean)) || "app";
  const info = new Map(rels.map((rel) => [rel, tokensOf(rel)] as const));
  const extra = new Map<string, number>(rels.map((rel) => [rel, 0]));
  const result = new Map<string, string>();
  for (let round = 0; round < 8; round++) {
    result.clear();
    const owners = new Map<string, string[]>();
    for (const rel of rels) {
      const { tokens, base } = info.get(rel) ?? { tokens: ["app"], base: 1 };
      const take = Math.min(tokens.length, base + (extra.get(rel) ?? 0));
      const p = name(tokens.slice(tokens.length - take));
      result.set(rel, p);
      owners.set(p, [...(owners.get(p) ?? []), rel]);
    }
    let changed = false;
    for (const list of owners.values()) {
      if (list.length < 2) continue;
      for (const rel of list) {
        const { tokens, base } = info.get(rel) ?? { tokens: [], base: 1 };
        if (base + (extra.get(rel) ?? 0) < tokens.length) {
          extra.set(rel, (extra.get(rel) ?? 0) + 1);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return result;
}

/* ───────────────────────────── AST helpers ───────────────────────────── */

function lineOf(sf: TS.SourceFile, node: TS.Node): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function isPascal(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function functionName(fn: TS.FunctionLikeDeclaration): string | undefined {
  if (fn.name && ts.isIdentifier(fn.name)) return fn.name.text;
  let p: TS.Node = fn.parent;
  while (ts.isCallExpression(p) || ts.isParenthesizedExpression(p) || ts.isAsExpression(p)) p = p.parent;
  if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (ts.isExportAssignment(p)) return "default";
  return undefined;
}

/** A component or hook: the place a translator can be created. */
function isComponentOrHook(fn: TS.FunctionLikeDeclaration): boolean {
  const name = functionName(fn);
  if (!name) {
    // `export default function () {}` in a route file.
    return ts.isFunctionDeclaration(fn) && !!fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
  }
  if (name === "default") return true;
  return isPascal(name) || /^use[A-Z]/.test(name);
}

function isFunctionLike(node: TS.Node): node is TS.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  );
}

type Scope =
  | { kind: "component"; fn: TS.FunctionLikeDeclaration }
  | { kind: "helper"; fn: TS.FunctionLikeDeclaration }
  | { kind: "module" };

/**
 * Where a node runs. Inside a component or hook (directly or in a callback), a translator
 * is in reach. Inside a function that is neither, it is not. Default parameter values run
 * before the body, so they count as outside.
 */
function scopeOf(node: TS.Node): Scope {
  let inParameter = false;
  let nearestFn: TS.FunctionLikeDeclaration | undefined;
  for (let p: TS.Node = node; p.parent; p = p.parent) {
    const parent = p.parent;
    if (ts.isParameter(parent) && parent.initializer === p) inParameter = true;
    if (ts.isBindingElement(parent) && parent.initializer === p) inParameter = true;
    if (isFunctionLike(parent)) {
      if (inParameter && parent.parameters.some((param) => param.pos <= node.pos && node.end <= param.end)) {
        inParameter = false;
        nearestFn ??= parent;
        continue;
      }
      nearestFn ??= parent;
      if (isComponentOrHook(parent) && parent.body) return { kind: "component", fn: parent };
      if (ts.isClassLike(parent.parent)) return { kind: "helper", fn: parent };
    }
  }
  return nearestFn ? { kind: "helper", fn: nearestFn } : { kind: "module" };
}

/** Steps over wrappers that do not change a value: `( )`, `!`, `as`, `satisfies`. */
function outer(node: TS.Node): TS.Node {
  let n = node;
  while (
    ts.isParenthesizedExpression(n.parent) ||
    ts.isNonNullExpression(n.parent) ||
    ts.isAsExpression(n.parent) ||
    ts.isSatisfiesExpression(n.parent) ||
    (ts.isConditionalExpression(n.parent) && n.parent.condition !== n) ||
    (ts.isBinaryExpression(n.parent) &&
      n.parent.right === n &&
      [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(
        n.parent.operatorToken.kind,
      )) ||
    (ts.isBinaryExpression(n.parent) &&
      n.parent.left === n &&
      [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(n.parent.operatorToken.kind))
  ) {
    n = n.parent;
  }
  return n;
}

function propName(name: TS.PropertyName | TS.JsxAttributeName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isJsxNamespacedName(name)) return `${name.namespace.text}:${name.name.text}`;
  return undefined;
}

function isTextProp(name: string): boolean {
  return TEXT_PROPS.has(name) || TEXT_PROP_SUFFIX.test(name);
}

/** A comparison, `case`, index or other place where a string is a value, not text. */
function isValuePosition(node: TS.Node): boolean {
  const p = node.parent;
  if (!p) return false;
  if (ts.isBinaryExpression(p)) {
    const op = p.operatorToken.kind;
    return [
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken,
      ts.SyntaxKind.InKeyword,
    ].includes(op);
  }
  return (
    ts.isCaseClause(p) ||
    ts.isElementAccessExpression(p) ||
    ts.isImportDeclaration(p) ||
    ts.isExportDeclaration(p) ||
    ts.isLiteralTypeNode(p) ||
    ts.isExternalModuleReference(p) ||
    ts.isImportTypeNode(p) ||
    (ts.isPropertyAssignment(p) && p.name === node) ||
    ts.isPropertyAccessExpression(p) ||
    (ts.isExpressionStatement(p) && ts.isSourceFile(p.parent)) ||
    ts.isComputedPropertyName(p) ||
    ts.isEnumMember(p)
  );
}

function calleeText(call: TS.CallExpression | TS.NewExpression): string {
  return call.expression.getText().replace(/\s+/g, "");
}

/** Calls whose arguments are never shown as interface text. */
function isNonTextCall(call: TS.CallExpression | TS.NewExpression): boolean {
  const callee = calleeText(call);
  return (
    ts.isNewExpression(call) ||
    /^(console\.\w+|cn|clsx|cva|twMerge|require|import|fetch|encodeURIComponent|decodeURIComponent|JSON\.\w+|Number|parseInt|parseFloat|RegExp|Symbol|URLSearchParams|setItem|getItem|removeItem|matchMedia|addEventListener|removeEventListener|dispatchEvent|createElement|querySelector(All)?|getElementById|closest|setAttribute|getAttribute|startsWith|endsWith|includes|indexOf|split|replace(All)?|match|test|join|padStart|padEnd|localeCompare|toLocaleString|toLocaleDateString|format|formatDate|router\.\w+|redirect|notFound|useState|useRef|useReducer|useLocalStorageValue|cookies|headers|searchParams\.\w+|params\.\w+|Intl\.\w+|describe|it|test|assert\.\w+)$/.test(
      callee.replace(/^.*\.(?=[a-zA-Z]+$)/, (m) => (/(console|JSON|router|searchParams|params|Intl|assert)\.$/.test(m) ? m : "")),
    ) ||
    /\.(get|set|has|delete|push|replace|includes|startsWith|endsWith|indexOf|split|join|match|test|localeCompare|getItem|setItem|removeItem|querySelector|closest|setAttribute|getAttribute|addEventListener)$/.test(callee)
  );
}

/* ───────────────────────────── JSX text ───────────────────────────── */

const ENTITIES: Record<string, string> = {
  apos: "'", quot: '"', amp: "&", lt: "<", gt: ">", nbsp: " ", mdash: "—", ndash: "–",
  hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", middot: "·", times: "×",
  rarr: "→", larr: "←", bull: "•", copy: "©", reg: "®", deg: "°",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x")) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return String.fromCodePoint(parseInt(body.slice(1), 10));
    return ENTITIES[body] ?? whole;
  });
}

/** JSX text as React renders it: lines trimmed and joined by one space. */
function renderedJsxText(node: TS.JsxText): string {
  const raw = node.text;
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  lines.forEach((line, i) => {
    let l = line.replace(/\t/g, " ");
    if (i > 0) l = l.replace(/^ +/, "");
    if (i < lines.length - 1) l = l.replace(/ +$/, "");
    if (l) out.push(l);
  });
  return decodeEntities(out.join(" "));
}

type Piece =
  | { kind: "text"; text: string; node: TS.Node }
  | { kind: "value"; name: string; expr: TS.Expression; numeric: boolean; node: TS.Node }
  | { kind: "tag"; tag: string; element: TS.JsxElement; inner: Piece[]; node: TS.Node }
  | { kind: "complex"; node: TS.Node };

function containsLetteredString(node: TS.Node): boolean {
  let found = false;
  const visit = (n: TS.Node) => {
    if (found) return;
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && hasLetters(n.text) && !looksLikeCode(n.text)) {
      if (!isValuePosition(n) && !isInsideNonTextCall(n)) found = true;
    }
    if (ts.isTemplateExpression(n) && hasLetters(n.head.text + n.templateSpans.map((s) => s.literal.text).join(""))) found = true;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return;
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function containsJsx(node: TS.Node): boolean {
  let found = false;
  const visit = (n: TS.Node) => {
    if (found) return;
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function isInsideNonTextCall(node: TS.Node): boolean {
  for (let p = node.parent; p && !ts.isJsxExpression(p) && !isFunctionLike(p); p = p.parent) {
    if ((ts.isCallExpression(p) || ts.isNewExpression(p)) && isNonTextCall(p)) return true;
  }
  return false;
}

/** Whether a value can go into a message: a string, number or date. */
function primitiveKind(expr: TS.Expression): "string" | "number" | "other" {
  const type = checker.getTypeAtLocation(expr);
  const parts = type.isUnion() ? type.types : [type];
  let numeric = false;
  for (const t of parts) {
    const f = t.getFlags();
    if (f & (ts.TypeFlags.StringLike)) continue;
    if (f & (ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike)) {
      numeric = true;
      continue;
    }
    if (f & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)) continue;
    return "other";
  }
  return numeric ? "number" : "string";
}

function valueName(expr: TS.Expression): string {
  let e: TS.Expression = expr;
  while (ts.isNonNullExpression(e) || ts.isParenthesizedExpression(e) || ts.isAsExpression(e)) e = e.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  if (ts.isCallExpression(e)) {
    const c = e.expression;
    if (ts.isIdentifier(c)) return c.text;
    if (ts.isPropertyAccessExpression(c)) return c.name.text;
  }
  if (ts.isElementAccessExpression(e)) return valueName(e.expression);
  return "value";
}

function jsxPiece(child: TS.JsxChild): Piece | "skip" | "break" {
  if (ts.isJsxText(child)) {
    const text = renderedJsxText(child);
    if (!text) return "skip";
    return { kind: "text", text, node: child };
  }
  if (ts.isJsxExpression(child)) {
    const e = child.expression;
    if (!e) return "skip";
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return { kind: "text", text: e.text, node: child };
    if (containsJsx(e)) return "break";
    if (containsLetteredString(e)) return { kind: "complex", node: child };
    const kind = primitiveKind(e);
    if (kind === "other") return "break";
    return { kind: "value", name: valueName(e), expr: e, numeric: kind === "number", node: child };
  }
  if (ts.isJsxElement(child)) {
    const inner: Piece[] = [];
    for (const c of child.children) {
      const p = jsxPiece(c);
      if (p === "skip") continue;
      if (p === "break" || p.kind === "tag" || p.kind === "complex") return "break";
      inner.push(p);
    }
    if (!inner.length) return "break";
    const tagName = child.openingElement.tagName.getText().split(".").pop() ?? "tag";
    return { kind: "tag", tag: tagName.toLowerCase().replace(/[^a-z0-9]/g, "") || "tag", element: child, inner, node: child };
  }
  return "break";
}

function pieceHasLetters(p: Piece): boolean {
  if (p.kind === "text") return hasLetters(p.text) && !looksLikeCode(p.text.trim() || "x");
  if (p.kind === "tag") return p.inner.some(pieceHasLetters);
  return false;
}

/* ───────────────────────────── Visiting ───────────────────────────── */

function report(state: FileState, node: TS.Node, category: Category, text: string, fix: string) {
  findings.push({ file: state.rel, line: lineOf(state.sf, node), category, text: clip(text), fix });
}

function clip(text: string): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > 140 ? s.slice(0, 137) + "…" : s;
}

/**
 * Asks for a translator where this node runs. Returns the call text to use, or undefined
 * when there is no component to put one in (the caller reports it).
 */
function translatorFor(state: FileState, node: TS.Node): string | undefined {
  const scope = scopeOf(node);
  if (scope.kind !== "component") return undefined;
  state.needsTranslator.add(scope.fn);
  addToHookDeps(state, node, scope.fn);
  return state.translator;
}

/**
 * Text inside useMemo / useCallback / useEffect now reads the translator, so it joins the
 * dependency list: the value is recomputed when the language changes.
 */
function addToHookDeps(state: FileState, node: TS.Node, component: TS.FunctionLikeDeclaration) {
  for (let p: TS.Node = node; p.parent && p !== component; p = p.parent) {
    const call = p.parent;
    if (!ts.isCallExpression(call) || call.arguments[0] !== p || !isFunctionLike(p)) continue;
    const callee = calleeText(call).replace(/^React\./, "");
    if (!/^use(Memo|Callback|Effect|LayoutEffect|InsertionEffect)$/.test(callee)) continue;
    const deps = call.arguments[1];
    if (!deps || !ts.isArrayLiteralExpression(deps) || state.depsDone.has(deps)) continue;
    state.depsDone.add(deps);
    if (deps.elements.some((e) => ts.isIdentifier(e) && e.text === state.translator)) continue;
    const at = deps.getEnd() - 1;
    state.edits.push({ start: at, end: at, text: deps.elements.length ? `, ${state.translator}` : state.translator });
  }
}

function messageCall(translator: string, key: string, values: { name: string; code: string }[], rich = false): string {
  const fn = rich ? `${translator}.rich` : translator;
  if (!values.length) return `${fn}("${key}")`;
  const obj = values.map((v) => (v.code === v.name ? v.name : `${v.name}: ${v.code}`)).join(", ");
  return `${fn}("${key}", { ${obj} })`;
}

/** Value names made unique and safe for ICU and for an object literal. */
function uniqueNames(names: string[], reserved: Set<string> = new Set()): string[] {
  const used = new Set(reserved);
  return names.map((n) => {
    let base = n.replace(/[^A-Za-z0-9_]/g, "") || "value";
    if (/^\d/.test(base)) base = "v" + base;
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base}${i}`;
    used.add(name);
    return name;
  });
}

function valueCode(state: FileState, p: Extract<Piece, { kind: "value" }>): string {
  return messageValue(state, p.expr, p.numeric);
}

/**
 * The code for a value passed into a message. Numbers go in as text, because ICU would
 * reformat them (2026 → "2,026"). An empty value goes in as "", which is how React showed
 * `undefined` or `null` before.
 */
function messageValue(state: FileState, expr: TS.Expression, numeric: boolean): string {
  const code = numeric ? `String(${expr.getText(state.sf)})` : keyAwareCode(state, expr);
  if (!isNullable(expr)) return code;
  const raw = expr.getText(state.sf);
  return numeric ? `(${raw}) == null ? "" : String(${raw})` : `(${code}) ?? ""`;
}

function isNullable(expr: TS.Expression): boolean {
  const type = checker.getTypeAtLocation(expr);
  return (type.isUnion() ? type.types : [type]).some((t) => (t.getFlags() & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)) !== 0);
}

/** A value going into a message: translated first if it now holds a key. */
function keyAwareCode(state: FileState, expr: TS.Expression): string {
  const code = expr.getText(state.sf);
  let inner: TS.Expression = expr;
  while (ts.isNonNullExpression(inner) || ts.isParenthesizedExpression(inner)) inner = inner.expression;
  const info = readerInfo(inner);
  if (!info) return code;
  if (info.strict) return `${state.translator}(${code})`;
  state.usesTranslateText = true;
  return `translateText(${state.translator}, ${code})`;
}

/** Whether an expression reads a converted constant (or calls a function returning a key). */
function readerInfo(node: TS.Node): Tracked | undefined {
  if (ts.isCallExpression(node)) return trackedCall(node) ? { strict: false } : undefined;
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isIdentifier(node)) return trackedFor(node);
  return undefined;
}

function trackedCall(node: TS.CallExpression): boolean {
  const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
  let symbol = checker.getSymbolAtLocation(callee);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return !!symbol?.declarations?.some(
    (d) => trackedDeclarations.has(d) && (ts.isFunctionDeclaration(d) || (ts.isVariableDeclaration(d) && !!d.initializer && isFunctionLike(d.initializer))),
  );
}

/** JSX children: groups text, values and simple inline tags into one message per run. */
function visitJsxChildren(state: FileState, parent: TS.JsxElement | TS.JsxFragment) {
  if (claimed.has(parent)) return;
  const runs: Piece[][] = [[]];
  for (const child of parent.children) {
    const p = jsxPiece(child);
    if (p === "skip") continue;
    if (p === "break") {
      runs.push([]);
      continue;
    }
    runs[runs.length - 1].push(p);
  }
  for (const run of runs) {
    // Text only inside child elements (<p>Title</p>) belongs to those elements' own runs.
    if (!run.some((p) => p.kind === "text" && pieceHasLetters(p))) continue;
    // A lone complex child (`{cond ? "Yes" : "No"}`) is converted literal by literal.
    if (run.length === 1 && run[0].kind === "complex") continue;
    const text = run.map((p) => (p.kind === "text" ? p.text : p.kind === "value" ? `{${p.name}}` : p.kind === "tag" ? `<${p.tag}>…` : "{…}")).join("");
    for (const p of run) claimed.add(p.node);
    markClaimed(run);
    if (run.some((p) => p.kind === "complex")) {
      report(state, run[0].node, "Complex split sentence", text, "Write it as one message; a word chosen in code becomes an ICU `select`.");
      continue;
    }
    const translator = translatorFor(state, parent);
    if (!translator) {
      report(state, run[0].node, "Text in a helper outside a component", text, "Pass the translator in as a parameter.");
      continue;
    }
    convertRun(state, run, translator);
  }
}

function markClaimed(run: Piece[]) {
  for (const p of run) claimSubtree(p.node);
}

function claimSubtree(node: TS.Node) {
  claimed.add(node);
  ts.forEachChild(node, claimSubtree);
}

function convertRun(state: FileState, run: Piece[], translator: string) {
  const sf = state.sf;
  const valuePieces: Extract<Piece, { kind: "value" }>[] = [];
  const tagPieces: Extract<Piece, { kind: "tag" }>[] = [];
  const collect = (ps: Piece[]) => {
    for (const p of ps) {
      if (p.kind === "value") valuePieces.push(p);
      if (p.kind === "tag") {
        tagPieces.push(p);
        collect(p.inner);
      }
    }
  };
  collect(run);
  const tagNames = uniqueNames(tagPieces.map((t) => t.tag));
  const valueNames = uniqueNames(valuePieces.map((v) => v.name), new Set(tagNames));
  const nameOf = new Map<Piece, string>();
  tagPieces.forEach((t, i) => nameOf.set(t, tagNames[i]));
  valuePieces.forEach((v, i) => nameOf.set(v, valueNames[i]));

  const render = (ps: Piece[]): string =>
    ps
      .map((p) => {
        if (p.kind === "text") return escapeIcu(p.text);
        if (p.kind === "value") return `{${nameOf.get(p)}}`;
        if (p.kind === "tag") return `<${nameOf.get(p)}>${render(p.inner)}</${nameOf.get(p)}>`;
        return "";
      })
      .join("");
  const message = render(run).replace(/\s+/g, " ").trim();
  const plain = run.map((p) => (p.kind === "text" ? p.text : "")).join("").trim();
  const key = keyFor(state, message, "", plain || message);

  const values = valuePieces.map((v) => ({ name: nameOf.get(v) ?? v.name, code: valueCode(state, v) }));
  const richValues = tagPieces.map((t) => {
    const open = t.element.openingElement.getText(sf);
    const close = t.element.closingElement.getText(sf);
    return { name: nameOf.get(t) ?? t.tag, code: `(chunks) => ${open}{chunks}${close}` };
  });
  const call = messageCall(translator, key, [...values, ...richValues], richValues.length > 0);

  // Replace from the first visible character to the last, leaving surrounding layout alone.
  const first = run[0].node;
  const last = run[run.length - 1].node;
  let start = first.getStart(sf);
  let end = last.getEnd();
  if (ts.isJsxText(first)) start += first.getText(sf).length - first.getText(sf).trimStart().length;
  if (ts.isJsxText(last)) end -= last.getText(sf).length - last.getText(sf).trimEnd().length;
  state.edits.push({ start, end, text: `{${call}}` });
}

/** Template literal `Remove ${name}` → message and values. */
function templateMessage(state: FileState, node: TS.TemplateExpression): { message: string; values: { name: string; code: string }[] } | undefined {
  const exprs = node.templateSpans.map((s) => s.expression);
  for (const e of exprs) if (primitiveKind(e) === "other" || containsLetteredString(e)) return undefined;
  const names = uniqueNames(exprs.map(valueName));
  let message = escapeIcu(node.head.text);
  const values = exprs.map((e, i) => {
    const kind = primitiveKind(e);
    message += `{${names[i]}}` + escapeIcu(node.templateSpans[i].literal.text);
    return { name: names[i], code: messageValue(state, e, kind === "number") };
  });
  return { message, values };
}

/** The visible text of a template literal, for tests and the report. */
function templateText(node: TS.TemplateExpression): string {
  return node.head.text + node.templateSpans.map((s) => "${…}" + s.literal.text).join("");
}

/**
 * A string in code. Decides whether it is interface text and, if so, whether it becomes
 * `t("key")` here (inside a component), a key in a constant (outside one), or a report line.
 */
function visitString(state: FileState, node: TS.StringLiteral | TS.NoSubstitutionTemplateLiteral | TS.TemplateExpression) {
  if (claimed.has(node)) return;
  const text = ts.isTemplateExpression(node) ? templateText(node) : node.text;
  if (!hasLetters(text)) return;
  if (isValuePosition(node)) return;
  if (isInsideNonTextCall(node)) return;

  const at = outer(node);
  const parent = at.parent;

  // Directives ("use client") and type positions.
  if (ts.isExpressionStatement(parent)) return;

  // The type expects this exact English (a union of literals): changing it breaks the code.
  if (!ts.isTemplateExpression(node) && isLiteralTypeContext(at)) {
    if (isSentenceLike(text) || (/\s/.test(text.trim()) && isTextInTextPlace(text))) {
      report(state, node, "English used as a value", text, "The code uses this English as an identifier. Keep it, and map it to a key where it is shown.");
    }
    return;
  }

  // JSX attribute: <X title="…" /> or title={…}.
  const attr = ts.isJsxAttribute(parent) ? parent : ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent) ? parent.parent : undefined;
  if (attr) {
    const name = propName(attr.name) ?? "";
    if (NEVER_PROPS.has(name) && name !== "value") return;
    if (name.startsWith("data-") || name.startsWith("on")) return;
    if (!isTextProp(name)) {
      if (isSentenceLike(text) || (name === "value" && isTextInTextPlace(text) && /^[A-Z]/.test(text.trim()))) {
        report(state, node, "Unclear prop", `${name}="${text}"`, `If \`${name}\` is shown on screen, add it to the text props or wrap the value in t().`);
      }
      return;
    }
    if (!isTextInTextPlace(text)) return;
    convertInline(state, node, text, name, true);
    return;
  }

  // JSX child expression: {"Text"} or {cond ? "A" : "B"} (runs were handled already).
  if (ts.isJsxExpression(parent) && !ts.isJsxAttribute(parent.parent)) {
    if (!isTextInTextPlace(text)) return;
    convertInline(state, node, text, "", false);
    return;
  }

  // Object property: { label: "…" }.
  if (ts.isPropertyAssignment(parent) && parent.initializer === at) {
    const name = propName(parent.name) ?? "";
    if (ORDER_TEMPLATE_FILES.has(state.rel) && ["botd", "clause", "name", "value"].includes(name)) return;
    if (name === "en") {
      convertCopyText(state, node, text);
      return;
    }
    if (NEVER_PROPS.has(name)) return;
    // A lone lowercase word in an object ("cnr", "caseNumber") is an identifier, not text.
    const loneLowercase = /^[a-z][A-Za-z0-9]*$/.test(text.trim()) || /^[A-Z0-9_]+$/.test(text.trim());
    const textual = (isTextProp(name) || isLabelMap(parent)) && !loneLowercase ? isTextInTextPlace(text) : isSentenceLike(text);
    if (!textual) {
      if (/^[A-Z][a-z]+$/.test(text)) singleWordValues++;
      return;
    }
    convertConstant(state, node, text, name, parent);
    return;
  }

  // Copy helper: t("English", "Malayalam").
  if (ts.isCallExpression(parent) && parent.arguments[0] === at && isCopyHelper(parent)) {
    convertCopyText(state, node, text);
    return;
  }

  // toast("Saved"), setError("…"), confirm("…").
  if (ts.isCallExpression(parent) && MESSAGE_CALLS.test(calleeText(parent))) {
    if (!isTextInTextPlace(text)) return;
    convertInline(state, node, text, "", false);
    return;
  }

  // "Case " + number: the pieces cannot be reordered for another language.
  if (ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    if (/\s/.test(text.trim()) || /\s$|^\s/.test(text)) report(state, node, "Joined with +", text, "Make it one message with placeholders.");
    return;
  }

  if (!isSentenceLike(text)) {
    if (/^[A-Z][a-z]+$/.test(text)) singleWordValues++;
    return;
  }

  // Lists of English: often values that are stored or compared, not only shown.
  if (ts.isArrayLiteralExpression(parent)) {
    report(state, node, "English used as a value", text, "If this list is only shown, move it to keys; if the text is stored or compared, keep it and translate where it is shown.");
    return;
  }

  // Default prop value: function Pager({ previous = "Previous" }).
  if (ts.isBindingElement(parent) || ts.isParameter(parent)) {
    const scope = scopeOf(parent);
    if (scope.kind === "component" && parent.initializer === at && ts.isIdentifier(parent.name)) {
      convertDefaultProp(state, node, text, parent);
      return;
    }
  }

  const scope = scopeOf(node);
  if (scope.kind === "component") {
    convertInline(state, node, text, "", false);
    return;
  }
  // Module-level constant: const EMPTY_TITLE = "Nothing here yet".
  if (scope.kind === "module" && ts.isVariableDeclaration(parent) && parent.initializer === at && !ts.isTemplateExpression(node)) {
    convertConstant(state, node, text, "", parent);
    return;
  }
  // A function that returns fixed text: return "Pending". Its callers translate the result.
  const returning = returningFunction(at);
  if (returning && !ts.isTemplateExpression(node) && isUnsafeHolder(returning)) {
    report(state, node, "English used as a value", text, "Callers use this text to build other text. Translate where it is shown instead.");
    return;
  }
  if (returning && !ts.isTemplateExpression(node)) {
    const key = keyFor(state, escapeIcu(text.trim()), "", text.trim());
    state.edits.push({ start: node.getStart(state.sf), end: node.getEnd(), text: `"${key}"` });
    trackedDeclarations.set(returning, { strict: false });
    return;
  }
  if (isLibFile(state.rel)) {
    report(state, node, "Sentence built in lib/", text, "Return a key and values, or take the translator as a parameter (one approved pattern).");
    return;
  }
  if (scope.kind === "helper") {
    report(state, node, "Text in a helper outside a component", text, "Pass the translator in as a parameter.");
    return;
  }
  report(state, node, "Unclear string", text, "Decide whether this is shown on screen.");
}

/**
 * The declaration of a named function this value is returned from, when it returns plain
 * text (`return "Pending"` or `=> "Pending"`). Undefined for components, methods and
 * anonymous callbacks, whose callers cannot be found.
 */
function returningFunction(at: TS.Node): TS.Node | undefined {
  let fn: TS.Node | undefined;
  if (ts.isReturnStatement(at.parent)) {
    for (let p: TS.Node | undefined = at.parent; p; p = p.parent) {
      if (isFunctionLike(p)) {
        fn = p;
        break;
      }
    }
  } else if (ts.isArrowFunction(at.parent) && at.parent.body === at) fn = at.parent;
  if (!fn || !isFunctionLike(fn) || isComponentOrHook(fn)) return undefined;
  if (ts.isFunctionDeclaration(fn) && fn.name) return fn;
  const holder = fn.parent;
  if ((ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name)) return holder;
  return undefined;
}

/** English that a type treats as an identifier ("Cases and hearings" | …). */
function isLiteralTypeContext(node: TS.Node): boolean {
  const type = checker.getContextualType(node as TS.Expression);
  if (!type) return false;
  // SetStateAction<"a" | "b" | null> also carries an updater function; only strings matter.
  const parts = (type.isUnion() ? type.types : [type]).filter((t) => (t.getFlags() & ts.TypeFlags.Object) === 0);
  const anyString = parts.some((t) => (t.getFlags() & ts.TypeFlags.String) !== 0);
  return !anyString && parts.some((t) => t.isStringLiteral());
}

function isCopyHelper(call: TS.CallExpression): boolean {
  if (!ts.isIdentifier(call.expression)) return false;
  const symbol = checker.getSymbolAtLocation(call.expression);
  const decl = symbol?.valueDeclaration;
  if (!decl || !ts.isVariableDeclaration(decl) || !decl.initializer || !ts.isArrowFunction(decl.initializer)) return false;
  const returnType = decl.initializer.type?.getText() ?? "";
  return returnType === "Copy";
}

/** Inside a component: the string becomes `t("key")` right where it is. */
function convertInline(state: FileState, node: TS.StringLiteral | TS.NoSubstitutionTemplateLiteral | TS.TemplateExpression, text: string, role: string, isAttribute: boolean) {
  const translator = translatorFor(state, node);
  if (!translator) {
    if (isLibFile(state.rel)) report(state, node, "Sentence built in lib/", text, "Return a key and values, or take the translator as a parameter.");
    else report(state, node, "Text in a helper outside a component", text, "Pass the translator in as a parameter.");
    return;
  }
  let call: string;
  if (ts.isTemplateExpression(node)) {
    const tm = templateMessage(state, node);
    if (!tm) {
      report(state, node, "Complex split sentence", text, "Write it as one message with placeholders.");
      return;
    }
    const key = keyFor(state, tm.message, role, text);
    call = messageCall(translator, key, tm.values);
    claimSubtree(node);
  } else {
    const key = keyFor(state, escapeIcu(text.trim()), role, text.trim());
    call = messageCall(translator, key, []);
  }
  const directAttribute = isAttribute && ts.isJsxAttribute(node.parent);
  state.edits.push({ start: node.getStart(state.sf), end: node.getEnd(), text: directAttribute ? `{${call}}` : call });
}

/** Copy `en` text: the key goes where the English was; Malayalam stays beside it. */
function convertCopyText(state: FileState, node: TS.StringLiteral | TS.NoSubstitutionTemplateLiteral | TS.TemplateExpression, text: string) {
  if (ts.isTemplateExpression(node)) {
    report(state, node, "Copy text with a template", text, "Use a {name} placeholder and fillCopy.");
    return;
  }
  if (KEY_SHAPE.test(text)) return;
  const key = keyFor(state, copyToIcu(text), "", text);
  state.edits.push({ start: node.getStart(state.sf), end: node.getEnd(), text: `"${key}"` });
}

/**
 * Outside a component: the constant holds the key, and the places that show it are found
 * through the type checker and wrapped in a translator.
 */
function convertConstant(state: FileState, node: TS.StringLiteral | TS.NoSubstitutionTemplateLiteral | TS.TemplateExpression, text: string, role: string, holder: TS.PropertyAssignment | TS.VariableDeclaration) {
  if (ts.isTemplateExpression(node)) {
    report(state, node, isLibFile(state.rel) ? "Sentence built in lib/" : "Text in a helper outside a component", text, "Return a key and values, or translate where it is shown.");
    return;
  }
  const scope = scopeOf(node);
  if (scope.kind === "component") {
    convertInline(state, node, text, role, false);
    return;
  }
  if (isUnsafeHolder(holder)) {
    report(state, node, "English used as a value", text, "Its text is also used to build other text (an order sentence, a message in lib/). Translate where it is shown instead.");
    return;
  }
  // Module level or inside a plain function: the value is a key either way, and the
  // places that show it are found through its type.
  const key = keyFor(state, escapeIcu(text.trim()), role, text.trim());
  state.edits.push({ start: node.getStart(state.sf), end: node.getEnd(), text: `"${key}"` });
  convertedLiterals.add(node);
  track(holder);
}

function convertDefaultProp(state: FileState, node: TS.StringLiteral | TS.NoSubstitutionTemplateLiteral | TS.TemplateExpression, text: string, holder: TS.BindingElement | TS.ParameterDeclaration) {
  if (ts.isTemplateExpression(node)) {
    report(state, node, "Default text for a prop", text, "Use a key as the default.");
    return;
  }
  if (isUnsafeHolder(holder)) {
    report(state, node, "Default text for a prop", text, "The component builds other text from this prop. Translate where it is shown.");
    return;
  }
  const key = keyFor(state, escapeIcu(text.trim()), "", text.trim());
  state.edits.push({ start: node.getStart(state.sf), end: node.getEnd(), text: `"${key}"` });
  trackedDeclarations.set(holder, { strict: false });
}

/** Records the declaration whose readers must translate it. */
function track(holder: TS.PropertyAssignment | TS.VariableDeclaration) {
  if (ts.isVariableDeclaration(holder)) {
    trackedDeclarations.set(holder, { strict: !holder.type && isConstDeclaration(holder) });
    return;
  }
  trackedDeclarations.set(holder, { strict: false });
  // A literal checked against a named type (Option.label): readers see the type's property.
  for (const d of contextualDeclarations(holder)) trackedDeclarations.set(d, { strict: false });
  markStrictRecord(holder);
}

/** The declarations readers of this property resolve to: itself and its type's property. */
function contextualDeclarations(holder: TS.PropertyAssignment): TS.Node[] {
  const contextual = checker.getContextualType(holder.parent);
  const name = propName(holder.name);
  if (!contextual || !name) return [];
  const out: TS.Node[] = [];
  for (const t of contextual.isUnion() ? contextual.types : [contextual]) {
    for (const d of t.getProperty(name)?.declarations ?? []) if (d !== holder) out.push(d);
  }
  return out;
}

/** Whether converting this holder would put a key into text the code builds. */
function isUnsafeHolder(holder: TS.Node): boolean {
  if (unsafeDeclarations.has(holder)) return true;
  return ts.isPropertyAssignment(holder) && contextualDeclarations(holder).some((d) => unsafeDeclarations.has(d));
}

function isConstDeclaration(decl: TS.VariableDeclaration): boolean {
  return ts.isVariableDeclarationList(decl.parent) && (decl.parent.flags & ts.NodeFlags.Const) !== 0;
}

/**
 * `const LABEL: Record<Status, string> = { … }` → `Record<Status, MessageKey>`, so a typo in
 * a key fails the build. Only the constant's own annotation is changed, never a shared type.
 */
function markStrictRecord(holder: TS.PropertyAssignment) {
  const decl = holdingVariable(holder);
  if (!decl?.type) return;
  const type = decl.type;
  if (ts.isTypeReferenceNode(type) && type.typeName.getText() === "Record" && type.typeArguments?.length === 2) {
    const value = type.typeArguments[1];
    if (value.kind === ts.SyntaxKind.StringKeyword) strictCandidates.set(value, decl);
  }
}

/** The `const X = { … }` an object property sits directly in. */
function holdingVariable(holder: TS.PropertyAssignment): TS.VariableDeclaration | undefined {
  let obj: TS.Node = holder.parent;
  while (ts.isAsExpression(obj.parent) || ts.isSatisfiesExpression(obj.parent) || ts.isParenthesizedExpression(obj.parent)) obj = obj.parent;
  const decl = obj.parent;
  return ts.isVariableDeclaration(decl) && decl.initializer === obj ? decl : undefined;
}

/**
 * A map from values to their labels: `const STATUS_LABEL: Record<Status, string>`, or a
 * constant named for what it holds (`…_LABELS`, `…_TITLES`, `…_COPY`). Every value in it is
 * text, single words included.
 */
function isLabelMap(holder: TS.PropertyAssignment): boolean {
  const decl = holdingVariable(holder);
  if (!decl || !ts.isIdentifier(decl.name)) return false;
  // By name only: a Record<string, string> is just as often a table of codes (GENDER_CODES).
  return /(LABELS?|TITLES?|TEXTS?|COPY|HEADINGS?|CAPTIONS?|Labels?|Titles?|Copy)$/.test(decl.name.text);
}

/**
 * A `Record<…, string>` becomes `Record<…, MessageKey>` only when every value in it was
 * converted; a map that still holds English would no longer compile.
 */
function confirmStrictRecords() {
  for (const [value, decl] of strictCandidates) {
    let obj: TS.Node | undefined = decl.initializer;
    while (obj && (ts.isAsExpression(obj) || ts.isSatisfiesExpression(obj) || ts.isParenthesizedExpression(obj))) obj = obj.expression;
    if (!obj || !ts.isObjectLiteralExpression(obj)) continue;
    const allKeys = obj.properties.every(
      (p) => ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.initializer) || ts.isNoSubstitutionTemplateLiteral(p.initializer)) && (convertedLiterals.has(p.initializer) || KEY_SHAPE.test(p.initializer.text)),
    );
    if (allKeys) strictVariables.add(value);
  }
}

/* ───────────────────────────── Readers of converted constants ───────────────────────────── */

/** Where a converted constant is read: wrapped in a translator if shown, reported if not. */
function visitReaders(state: FileState) {
  const visit = (node: TS.Node) => {
    // Values already folded into a converted message were translated there.
    if (claimed.has(node)) return;
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || (ts.isIdentifier(node) && !isDeclarationName(node))) {
      const info = trackedFor(node);
      if (info) handleReader(state, node as TS.Expression, info);
    }
    // stageLabel(stage): a function that returns a key.
    if (ts.isCallExpression(node) && !claimed.has(node) && trackedCall(node)) handleReader(state, node, { strict: false });
    ts.forEachChild(node, visit);
  };
  visit(state.sf);
}

function isDeclarationName(node: TS.Identifier): boolean {
  const p = node.parent;
  return (
    ((ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p) || ts.isBindingElement(p) || ts.isParameter(p) || ts.isPropertySignature(p) || ts.isShorthandPropertyAssignment(p)) && p.name === node) ||
    ts.isPropertyAccessExpression(p) ||
    ts.isImportSpecifier(p) ||
    ts.isExportSpecifier(p) ||
    ts.isImportClause(p)
  );
}

function trackedFor(node: TS.Node): Tracked | undefined {
  let symbol: TS.Symbol | undefined;
  if (ts.isPropertyAccessExpression(node)) symbol = checker.getSymbolAtLocation(node.name);
  else if (ts.isElementAccessExpression(node)) {
    // LABEL[status] on a strict record map.
    const decl = resolvedDeclaration(node.expression);
    if (decl && ts.isVariableDeclaration(decl) && decl.type && ts.isTypeReferenceNode(decl.type)) {
      const value = decl.type.typeArguments?.[1];
      if (value && strictVariables.has(value)) return { strict: true };
      if (decl.initializer && containsTrackedProperty(decl.initializer)) return { strict: false };
    }
    if (decl && ts.isVariableDeclaration(decl) && !decl.type && decl.initializer && containsTrackedProperty(decl.initializer)) return { strict: false };
    return undefined;
  } else symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return undefined;
  if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  for (const d of symbol.declarations ?? []) {
    const info = trackedDeclarations.get(d);
    if (info) {
      if (ts.isPropertyAccessExpression(node)) {
        // A literal-typed property (`as const`) is a MessageKey once the keys exist.
        const type = checker.getTypeAtLocation(node);
        if (type.isStringLiteral()) return { strict: true };
        const tdecl = resolvedDeclaration(node.expression);
        if (tdecl && ts.isVariableDeclaration(tdecl) && tdecl.type && ts.isTypeReferenceNode(tdecl.type)) {
          const value = tdecl.type.typeArguments?.[1];
          if (value && strictVariables.has(value)) return { strict: true };
        }
      }
      return info;
    }
  }
  return undefined;
}

/** What an expression names, through imports. */
function resolvedDeclaration(expr: TS.Expression): TS.Declaration | undefined {
  let symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(expr) ? expr.name : expr);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return symbol?.valueDeclaration;
}

/** The converted declarations a reader reaches. */
function readerDeclarations(node: TS.Node): TS.Node[] {
  if (ts.isCallExpression(node)) {
    const callee = ts.isPropertyAccessExpression(node.expression) ? node.expression.name : node.expression;
    let symbol = checker.getSymbolAtLocation(callee);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return (symbol?.declarations ?? []).filter((d) => trackedDeclarations.has(d));
  }
  if (ts.isElementAccessExpression(node)) {
    const decl = resolvedDeclaration(node.expression);
    const out: TS.Node[] = [];
    if (decl && ts.isVariableDeclaration(decl) && decl.initializer) {
      const visit = (n: TS.Node) => {
        if (trackedDeclarations.has(n)) out.push(n);
        ts.forEachChild(n, visit);
      };
      visit(decl.initializer);
    }
    return out;
  }
  let symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node) ? node.name : node);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return (symbol?.declarations ?? []).filter((d) => trackedDeclarations.has(d));
}

/**
 * After the first pass: a converted value read into a template, a `+`, a comparison or a
 * string method outside of display is text the code builds on. Those declarations stay
 * English in the second pass.
 */
function scanUnsafe(state: FileState) {
  const visit = (node: TS.Node) => {
    const isReader =
      ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node) || (ts.isIdentifier(node) && !isDeclarationName(node));
    // LIST.split("\n"), NAME.toLowerCase(): a string method means the value is data.
    if (isReader && ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node && STRING_METHODS.test(node.parent.name.text)) {
      for (const d of readerDeclarations(node)) unsafeDeclarations.add(d);
    }
    if (isReader && !isPartOfLongerAccess(node)) {
      const decls = readerDeclarations(node);
      if (decls.length && buildsText(state, node)) for (const d of decls) unsafeDeclarations.add(d);
      // A whole map of converted strings handed on (`addressParts: ADDRESS_PARTS`): its
      // values are then read under another name the script cannot follow.
      if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
        let symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(node) ? node.name : node);
        if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
        for (const d of symbol?.declarations ?? []) for (const h of convertedStringsIn(d)) unsafeDeclarations.add(h);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(state.sf);
}

/** Converted string properties inside a constant or property that holds an object. */
function convertedStringsIn(decl: TS.Node): TS.PropertyAssignment[] {
  if (!(ts.isVariableDeclaration(decl) || ts.isPropertyAssignment(decl)) || !decl.initializer) return [];
  let init: TS.Expression = decl.initializer;
  while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression;
  if (!ts.isObjectLiteralExpression(init)) return [];
  const out: TS.PropertyAssignment[] = [];
  for (const p of init.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    if (convertedLiterals.has(p.initializer)) out.push(p);
    else out.push(...convertedStringsIn(p));
  }
  return out;
}

function isPartOfLongerAccess(node: TS.Node): boolean {
  const p = node.parent;
  return (
    ((ts.isPropertyAccessExpression(p) || ts.isElementAccessExpression(p)) && p.expression === node) ||
    (ts.isCallExpression(p) && p.expression === node) ||
    (ts.isPropertyAccessExpression(p) && p.name === node)
  );
}

/**
 * Anything but showing it. A value passed on (to a variable, a function, another prop) can
 * end up in an order sentence or a comparison the script cannot follow, so only direct
 * display counts as safe.
 */
function buildsText(state: FileState, node: TS.Node): boolean {
  void state;
  return !isShown(node);
}

/** Read straight onto the screen: a JSX child, a text prop, a toast, or a shown template. */
function isShown(node: TS.Node): boolean {
  const at = outer(node);
  const p = at.parent;
  return (
    (ts.isJsxExpression(p) && !ts.isJsxAttribute(p.parent)) ||
    (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent) && isTextProp(propName(p.parent.name) ?? "")) ||
    (ts.isCallExpression(p) && MESSAGE_CALLS.test(calleeText(p)) && p.arguments[0] === at) ||
    (ts.isTemplateSpan(p) && isShownTemplate(p.parent)) ||
    (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent) && propName(p.parent.name) === "key")
  );
}

function containsTrackedProperty(node: TS.Node): boolean {
  let found = false;
  const visit = (n: TS.Node) => {
    if (found) return;
    if (trackedDeclarations.has(n)) found = true;
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function handleReader(state: FileState, node: TS.Expression, info: Tracked) {
  // Part of a longer access (LABELS.draft.title): only the outermost read is the value.
  if (ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) return;
  if (ts.isElementAccessExpression(node.parent) && node.parent.expression === node) return;
  if (ts.isCallExpression(node.parent) && node.parent.expression === node) return;
  const at = outer(node);
  const parent = at.parent;
  const sf = state.sf;
  const text = node.getText(sf);

  const shown =
    (ts.isJsxExpression(parent) && !ts.isJsxAttribute(parent.parent)) ||
    (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent) && isTextProp(propName(parent.parent.name) ?? "")) ||
    (ts.isCallExpression(parent) && MESSAGE_CALLS.test(calleeText(parent))) ||
    (ts.isTemplateSpan(parent) && isShownTemplate(parent.parent));
  if (!shown) {
    if (isUsedAsData(at)) {
      report(state, node, "Key used as data", text, "This now holds a key. Search, sort or compare on the translated text instead.");
    } else if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent)) {
      report(state, node, "Unclear prop", `${propName(parent.parent.name)}={${text}}`, "This now holds a key. Translate it here if the prop is shown on screen.");
    }
    return;
  }
  if (!isStringLike(node)) {
    report(state, node, "Key used as data", text, "This sometimes holds a key but is not plain text here (it may be JSX). Translate it where the key is produced.");
    return;
  }
  const translator = translatorFor(state, node);
  if (!translator) {
    report(state, node, "Key shown outside a component", text, "Translate where it is shown, or pass the translator in.");
    return;
  }
  if (info.strict) {
    state.edits.push({ start: node.getStart(sf), end: node.getStart(sf), text: `${translator}(` });
    state.edits.push({ start: node.getEnd(), end: node.getEnd(), text: ")" });
  } else {
    state.usesTranslateText = true;
    state.edits.push({ start: node.getStart(sf), end: node.getStart(sf), text: `translateText(${translator}, ` });
    state.edits.push({ start: node.getEnd(), end: node.getEnd(), text: ")" });
  }
}

/** A string, possibly missing: the only thing translateText takes. */
function isStringLike(expr: TS.Expression): boolean {
  const type = checker.getTypeAtLocation(expr);
  return (type.isUnion() ? type.types : [type]).every((t) => (t.getFlags() & (ts.TypeFlags.StringLike | ts.TypeFlags.Undefined | ts.TypeFlags.Null)) !== 0);
}

function isShownTemplate(template: TS.Node): boolean {
  const at = outer(template);
  const p = at.parent;
  return (ts.isJsxExpression(p) && !ts.isJsxAttribute(p.parent)) || (ts.isJsxExpression(p) && ts.isJsxAttribute(p.parent) && isTextProp(propName(p.parent.name) ?? ""));
}

function isUsedAsData(node: TS.Node): boolean {
  const p = node.parent;
  if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken].includes(p.operatorToken.kind)) return true;
  if (ts.isPropertyAccessExpression(p) && /^(toLowerCase|toUpperCase|includes|startsWith|endsWith|indexOf|localeCompare|split|match|search|trim|normalize|length)$/.test(p.name.text)) return true;
  if (ts.isCallExpression(p) && /localeCompare|includes|indexOf|startsWith|endsWith|filter|sort|find/.test(calleeText(p))) return true;
  if (ts.isCaseClause(p) || ts.isSwitchStatement(p)) return true;
  return false;
}

/* ───────────────────────────── Copy reads ───────────────────────────── */

/** `copy.en` read directly would show a key once Copy holds keys. */
function visitCopyReads(state: FileState) {
  const visit = (node: TS.Node) => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === "en") {
      const type = checker.getTypeAtLocation(node.expression);
      if (type.getProperty("ml") || type.aliasSymbol?.name === "Copy") {
        if (!/^src\/lib\/(onboarding|join)\/content\.ts$/.test(state.rel) || !isInsidePickOrFill(node)) {
          report(state, node, "Reads copy.en directly", node.getText(state.sf), "Read it through pick() or a translator; copy.en now holds a key.");
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(state.sf);
}

function isInsidePickOrFill(node: TS.Node): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name && /^(pick|fill|fillCopy)$/.test(p.name.text)) return true;
  }
  return false;
}

/* ───────────────────────────── Per file ───────────────────────────── */

function bindingNames(sf: TS.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (n: TS.Node) => {
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n) || ts.isFunctionDeclaration(n) || ts.isImportSpecifier(n) || ts.isImportClause(n) || ts.isNamespaceImport(n)) && n.name && ts.isIdentifier(n.name)) {
      names.add(n.name.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return names;
}

function chooseTranslator(sf: TS.SourceFile): string {
  const taken = bindingNames(sf);
  return ["t", "tr", "tx", "translate"].find((n) => !taken.has(n)) ?? "translateUi";
}

function isDemoConstant(node: TS.Node): string | undefined {
  for (let p: TS.Node | undefined = node; p; p = p.parent) {
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) {
      if (DEMO_CONSTANT.test(p.name.text)) return p.name.text;
      // Typed as fixture data: Record<string, RemovalConsentFixture>.
      if (p.type && /Fixture|Sample|Demo|Mock/.test(p.type.getText())) return p.name.text;
    }
  }
  return undefined;
}

function isPageMetadata(node: TS.Node): boolean {
  for (let p: TS.Node | undefined = node; p; p = p.parent) {
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && p.name.text === "metadata") return true;
    if (ts.isFunctionDeclaration(p) && p.name?.text === "generateMetadata") return true;
  }
  return false;
}

function analyse(state: FileState) {
  const sf = state.sf;
  const demoSeen = new Set<string>();
  let metadataSeen = false;
  const visit = (node: TS.Node) => {
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) visitJsxChildren(state, node);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const demo = isDemoConstant(node);
      if (demo) {
        if (!demoSeen.has(demo)) skips.push({ file: state.rel, line: lineOf(sf, node), text: demo, reason: "Demo data constant" });
        demoSeen.add(demo);
      } else if (isPageMetadata(node)) {
        if (!metadataSeen && hasLetters(node.getText(sf))) skips.push({ file: state.rel, line: lineOf(sf, node), text: "metadata", reason: "Page title (later item 10)" });
        metadataSeen = true;
      } else if (ts.isTemplateExpression(node) && ts.isTemplateExpression(node.parent?.parent ?? node)) {
        // Nested template: handled with its parent.
      } else {
        visitString(state, node);
      }
      if (ts.isTemplateExpression(node)) return;
    }
    if (ts.isJsxText(node) && !claimed.has(node)) {
      const text = renderedJsxText(node);
      if (pieceHasLetters({ kind: "text", text, node })) {
        report(state, node, "Unclear string", text, "Text the script could not place in a message.");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

/** Adds the translator and imports to each file that needs them. */
function finishFile(state: FileState) {
  const sf = state.sf;
  const needsHook = [...state.needsTranslator];
  const imports: string[] = [];
  let needsUseTranslations = false;
  let needsGetTranslations = false;
  for (const fn of needsHook) {
    if (!fn.body) continue;
    const isAsync = !!fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
    const serverAsync = isAsync && !state.isClient;
    if (serverAsync) needsGetTranslations = true;
    else needsUseTranslations = true;
    const line = serverAsync ? `const ${state.translator} = await getTranslations();` : `const ${state.translator} = useTranslations();`;
    if (ts.isBlock(fn.body)) {
      const already = fn.body.statements.some((s) => ts.isVariableStatement(s) && s.getText(sf).startsWith(`const ${state.translator} =`));
      if (already) continue;
      const first = fn.body.statements[0];
      const indent = first ? " ".repeat(sf.getLineAndCharacterOfPosition(first.getStart(sf)).character) : "  ";
      const at = fn.body.getStart(sf) + 1;
      state.edits.push({ start: at, end: at, text: `\n${indent}${line}` });
    } else {
      const start = fn.body.getStart(sf);
      const end = fn.body.getEnd();
      state.edits.push({ start, end: start, text: `{\n  ${line}\n  return (` });
      state.edits.push({ start: end, end, text: `);\n}` });
    }
  }
  const text = sf.getFullText();
  if (needsUseTranslations && !/import\s*\{[^}]*\buseTranslations\b[^}]*\}\s*from\s*"next-intl"/.test(text)) imports.push(`import { useTranslations } from "next-intl";`);
  if (needsGetTranslations && !/\bgetTranslations\b[^;]*from\s*"next-intl\/server"/.test(text)) imports.push(`import { getTranslations } from "next-intl/server";`);
  if (state.usesTranslateText && !/\btranslateText\b[^;]*from\s*"@\/i18n\/translate-text"/.test(text)) imports.push(`import { translateText } from "@/i18n/translate-text";`);
  if (state.usesMessageKey && !/\bMessageKey\b[^;]*from\s*"@\/i18n\/messages"/.test(text)) imports.push(`import type { MessageKey } from "@/i18n/messages";`);
  if (imports.length) {
    const lastImport = [...sf.statements].reverse().find(ts.isImportDeclaration);
    const directive = sf.statements.find((s) => ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression));
    const at = lastImport ? lastImport.getEnd() : directive ? directive.getEnd() : 0;
    state.edits.push({ start: at, end: at, text: (at ? "\n" : "") + imports.join("\n") + (at ? "" : "\n") });
  }
}

/** Forgets everything one pass produced except which declarations hold keys. */
function resetPass() {
  // What builds other text stays English, so its readers have nothing to translate.
  for (const d of unsafeDeclarations) trackedDeclarations.delete(d);
  for (const [d] of trackedDeclarations) {
    if (ts.isPropertyAssignment(d) && contextualDeclarations(d).some((c) => unsafeDeclarations.has(c))) trackedDeclarations.delete(d);
  }
  newMessages.clear();
  findings.length = 0;
  skips.length = 0;
  claimed.clear();
  textFiles.clear();
  keysInUse.clear();
  keysByPrefix.clear();
  strictVariables.clear();
  strictCandidates.clear();
  convertedLiterals.clear();
  singleWordValues = 0;
  for (const state of files.values()) {
    state.edits = [];
    state.needsTranslator.clear();
    state.usesTranslateText = false;
    state.usesMessageKey = false;
    state.depsDone.clear();
  }
}

/** Applies edits from the end, so earlier positions stay valid. */
function applyEdits(rel: string, source: string, edits: Edit[]): string {
  const sorted = edits
    .map((e, i) => ({ ...e, i }))
    .sort((a, b) => b.start - a.start || b.end - a.end || b.i - a.i);
  let out = source;
  let last: (Edit & { i: number }) | undefined;
  for (const e of sorted) {
    if (last && e.start !== e.end && e.end > last.start && last.start !== last.end) {
      throw new Error(`Overlapping edits in ${rel}: "${source.slice(e.start, e.end)}" → ${e.text} and "${source.slice(last.start, last.end)}" → ${last.text}`);
    }
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
    if (e.start !== e.end) last = e;
  }
  return out;
}

/* ───────────────────────────── Main ───────────────────────────── */

const sourceFiles = program
  .getSourceFiles()
  .filter((sf) => sf.fileName.startsWith(SRC + path.sep) && /\.tsx?$/.test(sf.fileName));
const rels = sourceFiles.map((sf) => path.relative(APP_ROOT, sf.fileName).split(path.sep).join("/"));
const prefixes = computePrefixes(rels);
const skippedFiles: { file: string; reason: string }[] = [];

for (const sf of sourceFiles) {
  const rel = path.relative(APP_ROOT, sf.fileName).split(path.sep).join("/");
  const skip = SKIPPED_FILES.find((s) => s.test(rel));
  if (skip) {
    if (!/\.test\.tsx?$|\.d\.ts$/.test(rel)) skippedFiles.push({ file: rel, reason: skip.reason });
    continue;
  }
  const isClient = sf.statements.some((s) => ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === "use client");
  files.set(rel, {
    rel,
    sf,
    prefix: prefixes.get(rel) ?? "app",
    edits: [],
    needsTranslator: new Set(),
    translator: chooseTranslator(sf),
    usesTranslateText: false,
    usesMessageKey: false,
    isClient,
    depsDone: new Set(),
  });
}

/*
 * Two passes. The first only learns which constants become keys (in any file); the second
 * starts clean and, knowing all of them, translates a converted value even when it sits
 * inside text being converted in another file.
 */
for (const state of files.values()) analyse(state);
for (const state of files.values()) scanUnsafe(state);
resetPass();
for (const state of files.values()) analyse(state);
confirmStrictRecords();
for (const state of files.values()) visitReaders(state);
for (const state of files.values()) visitCopyReads(state);
for (const value of strictVariables) {
  const sf = value.getSourceFile();
  const rel = path.relative(APP_ROOT, sf.fileName).split(path.sep).join("/");
  const state = files.get(rel);
  if (!state) continue;
  state.edits.push({ start: value.getStart(sf), end: value.getEnd(), text: "MessageKey" });
  state.usesMessageKey = true;
}
for (const state of files.values()) if (state.edits.length) finishFile(state);

/* Output */

const changed: { rel: string; before: string; after: string }[] = [];
for (const state of files.values()) {
  if (!state.edits.length) continue;
  const before = state.sf.getFullText();
  const after = applyEdits(state.rel, before, state.edits);
  if (after !== before) changed.push({ rel: state.rel, before, after });
}

const mergedEnglish: Record<string, string> = { ...english };
for (const [k, v] of newMessages) if (!(k in mergedEnglish)) mergedEnglish[k] = v;
const mergedHindi: Record<string, string> = { ...hindi };
for (const [k, v] of Object.entries(mergedEnglish)) if (!(k in mergedHindi)) mergedHindi[k] = v;
const sortKeys = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b, "en")));

if (WRITE) {
  for (const c of changed) fs.writeFileSync(path.join(APP_ROOT, c.rel), c.after);
  fs.writeFileSync(path.join(MESSAGES_DIR, "en.json"), JSON.stringify(sortKeys(mergedEnglish), null, 2) + "\n");
  fs.writeFileSync(path.join(MESSAGES_DIR, "hi.json"), JSON.stringify(sortKeys(mergedHindi), null, 2) + "\n");
} else if (PREVIEW_DIR) {
  for (const c of changed) {
    const out = path.join(PREVIEW_DIR, c.rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, c.after);
  }
  fs.mkdirSync(path.join(PREVIEW_DIR, "messages"), { recursive: true });
  fs.writeFileSync(path.join(PREVIEW_DIR, "messages/en.json"), JSON.stringify(sortKeys(mergedEnglish), null, 2) + "\n");
  fs.writeFileSync(path.join(PREVIEW_DIR, "messages/hi.json"), JSON.stringify(sortKeys(mergedHindi), null, 2) + "\n");
}

writeReport();

function writeReport() {
  const byCategory = new Map<string, number>();
  for (const f of findings) byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1);
  const byFile = new Map<string, Finding[]>();
  for (const f of findings) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
  const unused = Object.keys(english).filter((k) => !keysInUse.has(k) && !isKeyInCode(k));
  const shared = [...textFiles.entries()]
    .filter(([text, set]) => set.size >= 3 && !COMMON[text])
    .sort((a, b) => b[1].size - a[1].size);

  const lines: string[] = [];
  lines.push("# Message extraction report", "");
  lines.push(`Generated by \`scripts/extract-messages.mts\` (${WRITE ? "write" : "dry run"}).`);
  lines.push("Rebuilt on every run: it lists only what is still pending.", "");
  lines.push("## Summary", "", "| | Count |", "|---|---|");
  lines.push(`| New messages | ${newMessages.size} |`);
  lines.push(`| Messages already in en.json, reused | ${[...keysInUse].filter((k) => k in english).length} |`);
  lines.push(`| Files ${WRITE ? "changed" : "that would change"} | ${changed.length} |`);
  lines.push(`| Needs a hand fix | ${findings.length} |`);
  for (const [c, n] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) lines.push(`| — ${c} | ${n} |`);
  lines.push(`| Skipped on purpose (files) | ${skippedFiles.length} |`);
  lines.push(`| Single capitalised words in data positions, left alone | ${singleWordValues} |`);
  lines.push("");

  lines.push("## Needs a hand fix, by file", "");
  for (const [file, list] of [...byFile.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`### ${file} (${list.length})`, "");
    for (const f of list.sort((a, b) => a.line - b.line)) {
      lines.push(`- [ ] :${f.line} — **${f.category}** — \`${f.text.replace(/`/g, "'")}\``);
      lines.push(`      ${f.fix}`);
    }
    lines.push("");
  }

  lines.push("## Skipped on purpose", "");
  lines.push("### Files", "");
  for (const s of skippedFiles.sort((a, b) => a.file.localeCompare(b.file))) lines.push(`- ${s.file} — ${s.reason}`);
  lines.push("", "### Inside files", "");
  for (const s of skips) lines.push(`- ${s.file}:${s.line} — ${s.text} — ${s.reason}`);
  lines.push("- src/lib/employee/order-templates.ts — order wording (`botd`, variable `name`, option `value`, `conditional.clause`) — court document text (later item 17)");
  lines.push("");

  lines.push("## Shared candidates for `common_`", "", "English that appears in three or more files. Approve any that mean the same everywhere.", "");
  for (const [text, set] of shared) lines.push(`- "${clip(text)}" — ${set.size} files: ${[...set].map((f) => path.basename(f)).join(", ")}`);
  lines.push("");

  lines.push("## Keys in en.json no longer used in code", "");
  if (!unused.length) lines.push("None.");
  for (const k of unused) lines.push(`- ${k}`);
  lines.push("");

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, lines.join("\n"));
  console.log(`${WRITE ? "Wrote" : "Dry run:"} ${newMessages.size} new messages, ${changed.length} files, ${findings.length} to fix by hand.`);
  console.log(`Report: ${REPORT_FILE}`);
}

function isKeyInCode(key: string): boolean {
  for (const state of files.values()) if (state.sf.getFullText().includes(`"${key}"`)) return true;
  return false;
}
