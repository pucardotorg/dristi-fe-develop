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
]);

export default eslintConfig;
