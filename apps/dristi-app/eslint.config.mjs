import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Last, so it switches off the style rules above and Prettier alone formats.
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/vendor/**"]),
]);

export default eslintConfig;
