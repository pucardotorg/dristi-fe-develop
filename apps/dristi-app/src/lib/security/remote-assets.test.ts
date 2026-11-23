import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { findRemoteAssetRefs } from "./remote-assets";

const matches = (text: string) => findRemoteAssetRefs(text).map((r) => r.match);

describe("findRemoteAssetRefs — finds what a browser would fetch from elsewhere", () => {
  it("finds a font stylesheet pulled in by @import, in either form", () => {
    assert.deepEqual(
      matches(
        [
          `@import url("https://fonts.example.org/css2?family=Inter");`,
          `@import 'https://fonts.example.org/css2?family=Roboto';`,
        ].join("\n"),
      ),
      [
        `url("https://fonts.example.org/css2?family=Inter`,
        `@import 'https://fonts.example.org/css2?family=Roboto`,
      ],
    );
  });

  it("finds url() with an absolute or protocol-relative address", () => {
    assert.deepEqual(
      matches(
        `@font-face { src: url(//cdn.example.org/a.woff2) format("woff2"); }\n` +
          `.hero { background: url( 'http://img.example.org/b.png' ); }`,
      ),
      [`url(//cdn.example.org/a.woff2`, `url( 'http://img.example.org/b.png`],
    );
  });

  it("finds SVG and HTML attributes that load a remote file", () => {
    assert.deepEqual(
      matches(
        `<image href="https://img.example.org/a.png"/>` +
          `<use xlink:href="https://img.example.org/s.svg#i"/>` +
          `<script src='//cdn.example.org/x.js'></script>`,
      ),
      [
        `href="https://img.example.org/a.png`,
        `xlink:href="https://img.example.org/s.svg#i`,
        `src='//cdn.example.org/x.js`,
      ],
    );
  });

  it("gives the line each reference is on", () => {
    const refs = findRemoteAssetRefs(`a {}\n\nb { background: url(https://x.example/y.png); }`);
    assert.deepEqual(
      refs.map((r) => r.line),
      [3],
    );
  });

  it("leaves namespaces, local files, data URLs, packages and comments alone", () => {
    assert.deepEqual(
      matches(
        [
          `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`,
          `<image href="/brand/logo.svg"/><image href="data:image/png;base64,AAAA"/>`,
          `@import "tailwindcss"; @import "./feedback.css"; @import url("/fonts/a.css");`,
          `.a { background: url(/img/a.png); mask: url("data:image/svg+xml;utf8,<svg/>"); }`,
          `/* tokens synced from https://example.org/ds */`,
          `<a data-href="x" href-lang="en">`,
        ].join("\n"),
      ),
      [],
    );
  });
});

describe("the app's own stylesheets, SVGs and HTML load nothing from elsewhere", () => {
  const APP_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
  const SCANNED = new Set([".css", ".svg", ".html", ".htm"]);
  // Generated from node_modules by scripts/copy-runtime-assets.mjs and git-ignored.
  const SKIPPED = new Set([join(APP_ROOT, "public", "vendor")]);

  function files(dir: string): string[] {
    if (SKIPPED.has(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return files(path);
      return SCANNED.has(extname(entry.name).toLowerCase()) ? [path] : [];
    });
  }

  it("has no remote url(), @import, src or href in src/ or public/", () => {
    const scanned = [...files(join(APP_ROOT, "src")), ...files(join(APP_ROOT, "public"))];
    assert.ok(scanned.length > 0, "found no files to scan; is APP_ROOT right?");

    const found = scanned.flatMap((path) =>
      findRemoteAssetRefs(readFileSync(path, "utf8")).map(
        (ref) => `${relative(APP_ROOT, path)}:${ref.line}  ${ref.match}`,
      ),
    );
    assert.deepEqual(
      found,
      [],
      "Serve these from the app instead (issue #44, docs/self-hosted-assets.md)",
    );
  });
});
