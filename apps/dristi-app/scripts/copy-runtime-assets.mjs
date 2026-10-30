/**
 * Copy the pdf.js worker into `public/vendor/` so the app serves it itself (no CDN at
 * runtime). File previews and the case PDF viewer render pages with it:
 *
 *   - pdf.js worker            → /vendor/pdf.worker.min.mjs
 *
 * Runs before `dev` and `build`. `public/vendor/` is generated and git-ignored.
 */

import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const require = createRequire(import.meta.url);

const out = join(appRoot, "public", "vendor");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const pdfjs = dirname(require.resolve("pdfjs-dist/package.json"));
cpSync(join(pdfjs, "build", "pdf.worker.min.mjs"), join(out, "pdf.worker.min.mjs"));

console.log("runtime assets → public/vendor/");
