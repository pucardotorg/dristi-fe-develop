import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
 * Screens never touch data sources (AGENTS.md "Data"; .agents/policies/data-seam.md).
 * A screen gets data from its feature's store or hook, or `getRepository()`, so the same
 * file works in sandbox and api mode and connecting the backend never edits a screen.
 */
const SCREENS = ["src/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"];
// Route handlers are the demo server (bulk, provakil) and the backend proxy, not screens.
const NOT_SCREENS = ["src/app/api/**", "src/app/provakil/api/**"];

// The app's own `lib/` through the `@/lib/…` alias or a relative path (`../../lib/…`);
// a package's deep path (`somepkg/lib/api`) is left alone.
const appLib = (...paths) => paths.flatMap((path) => [`@/lib/${path}`, `.*/**/lib/${path}`]);

const BACKEND_IMPORTS = {
  group: appLib("api", "api/*", "server", "server/*", "**/data/http"),
  message: "Screens get data from the feature's repository or store, not the API. See AGENTS.md, Data.",
};
const SANDBOX_IMPORTS = {
  group: appLib("**/fixtures", "**/data/indexeddb", "**/data/sandbox"),
  message:
    "Fixtures and sandbox code belong behind the feature's repository. Use getRepository() or the feature's store/hook. See AGENTS.md, Data.",
};
const STORAGE_MESSAGE =
  "Screens don't keep data in browser storage: data goes through a repository, UI preferences through useLocalStorageValue (@/hooks/use-local-storage-value).";
const STORAGE_APIS = ["localStorage", "sessionStorage", "indexedDB"];
const STORAGE_GLOBALS = STORAGE_APIS.map((name) => ({ name, message: STORAGE_MESSAGE }));
const STORAGE_PROPERTIES = ["window", "globalThis", "self"].flatMap((object) =>
  STORAGE_APIS.map((property) => ({
    object,
    property,
    message: STORAGE_MESSAGE,
  }))
);

/*
 * In lib/, browser storage and IndexedDB belong only in a feature's sandbox, behind its
 * repository, so data never bypasses the data switch. UI preferences use
 * useLocalStorageValue from @/hooks, which is outside lib/.
 */
const LIB = ["src/lib/**/*.{ts,tsx}"];
const LIB_SANDBOXES = ["src/lib/**/data/indexeddb.ts", "src/lib/**/data/sandbox.ts", "src/lib/**/*.test.ts"];
const LIB_STORAGE_MESSAGE =
  "In lib/, keep data in the feature's sandbox (lib/<feature>/data/indexeddb.ts; start one with npm run new:data) and reach it through getRepository(). UI preferences use useLocalStorageValue.";
const LIB_STORAGE_GLOBALS = STORAGE_APIS.map((name) => ({ name, message: LIB_STORAGE_MESSAGE }));
const LIB_STORAGE_PROPERTIES = STORAGE_PROPERTIES.map((rule) => ({ ...rule, message: LIB_STORAGE_MESSAGE }));
const LIB_IDB = { paths: [{ name: "idb", message: LIB_STORAGE_MESSAGE }] };
// lib/ modules that kept data or UI state in browser storage before the rule existed: demo
// stores and UI preferences. Each comes off when its feature moves behind a repository
// (npm run new:data) or its preference moves to useLocalStorageValue.
const LIB_STILL_USE_STORAGE = [
  "src/lib/advocate/new-account.ts",
  "src/lib/applications/store.ts",
  "src/lib/bulk/setup-repository.ts",
  "src/lib/employee/browser-record.ts",
  "src/lib/employee/cognizance-layout.ts",
  "src/lib/employee/demo-seed.ts",
  "src/lib/employee/deposition-shortcuts.ts",
  "src/lib/employee/nav-layout.ts",
  "src/lib/employee/nav-shown.ts",
  "src/lib/employee/next-hearing-entry.ts",
  "src/lib/employee/order-shortcuts.ts",
  "src/lib/employee/session.ts",
  "src/lib/filing/details-formats.ts",
  "src/lib/filing/linked-complaints.ts",
  "src/lib/filing/profile.tsx",
  "src/lib/filing/sample-drafts.ts",
  "src/lib/filing/scrutiny-demo.ts",
  "src/lib/vakalatnama/store.ts",
];
// Bulk filing's browser store: a sandbox-only demo (lib/filing/data/http.ts says so).
const LIB_STILL_IMPORT_IDB = ["src/lib/bulk/store.browser.ts"];

/*
 * Screens that broke the rule before it existed. Each is excused only from the rule it
 * breaks, and comes off its list when it moves behind a repository; new code is checked
 * in full. Bracketed route folders are written with `*`, because brackets are glob syntax.
 */
const STILL_IMPORT_FIXTURES = [
  "src/app/(app)/cases/folders/*/page.tsx",
  "src/app/(app)/raise-application/page.tsx",
  "src/components/cases/case-applications.tsx",
  "src/components/cases/case-detail.tsx",
  "src/components/cases/case-timeline.tsx",
  "src/components/cases/submit-documents-form.tsx",
  "src/components/employee/scrutiny/scrutiny-queue.tsx",
];
const STILL_USE_STORAGE = [
  "src/app/join/*/join-flow.tsx",
  "src/components/advocate/advocate-home.tsx",
  "src/components/cases/use-cases-table-columns.ts",
  "src/components/employee/cognizance-case-screen.tsx",
  "src/components/employee/use-cause-list-columns.ts",
  "src/components/feedback-provider.tsx",
  "src/components/filing/sections/preview-section.tsx",
  "src/components/filing/sign-link/sign-link-screen.tsx",
  "src/components/scrutiny/correction-screen.tsx",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/vendor/**"]),
  {
    files: SCREENS,
    ignores: NOT_SCREENS,
    rules: {
      "no-restricted-imports": ["error", { patterns: [BACKEND_IMPORTS, SANDBOX_IMPORTS] }],
      "no-restricted-globals": ["error", ...STORAGE_GLOBALS],
      "no-restricted-properties": ["error", ...STORAGE_PROPERTIES],
    },
  },
  // Rule options replace rather than merge, so this keeps the backend ban for these files.
  {
    files: STILL_IMPORT_FIXTURES,
    rules: { "no-restricted-imports": ["error", { patterns: [BACKEND_IMPORTS] }] },
  },
  {
    files: STILL_USE_STORAGE,
    rules: { "no-restricted-globals": "off", "no-restricted-properties": "off" },
  },
  {
    files: LIB,
    ignores: LIB_SANDBOXES,
    rules: {
      "no-restricted-imports": ["error", LIB_IDB],
      "no-restricted-globals": ["error", ...LIB_STORAGE_GLOBALS],
      "no-restricted-properties": ["error", ...LIB_STORAGE_PROPERTIES],
    },
  },
  {
    files: LIB_STILL_USE_STORAGE,
    rules: { "no-restricted-globals": "off", "no-restricted-properties": "off" },
  },
  {
    files: LIB_STILL_IMPORT_IDB,
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;
