/**
 * Remote asset references in a stylesheet, SVG or HTML file: the files ESLint does not
 * read. Everything the app loads is served by the app itself, never a public CDN
 * (issue #44, docs/self-hosted-assets.md); `remote-assets.test.ts` runs this over every
 * such file in `src/` and `public/`.
 *
 * A stylesheet synced in from the design system is the likeliest way a font CDN comes
 * back, as an `@import` of a Google Fonts URL.
 */

export type RemoteAssetRef = {
  /** 1-based line of the match. */
  line: number;
  /** The reference as written, from its opening token to the end of the URL. */
  match: string;
};

/** `https://`, `http://` or protocol-relative `//`. */
const REMOTE = String.raw`(?:https?:)?\/\/`;

const PATTERNS: readonly RegExp[] = [
  // CSS `url(…)`, which also covers `@import url(…)`.
  new RegExp(String.raw`url\(\s*["']?\s*${REMOTE}[^)"'\s]*`, "gi"),
  // CSS `@import "…"`.
  new RegExp(String.raw`@import\s+["']\s*${REMOTE}[^"']*`, "gi"),
  // SVG/HTML attributes that load what they point at. `xmlns` only names a namespace.
  new RegExp(
    String.raw`(?<![\w:-])(?:src|srcset|href|xlink:href|poster|data)\s*=\s*["']\s*${REMOTE}[^"']*`,
    "gi",
  ),
];

/** Every remote asset reference in `text`, in the order they appear. */
export function findRemoteAssetRefs(text: string): RemoteAssetRef[] {
  const found: { index: number; match: string }[] = [];
  for (const pattern of PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      found.push({ index: m.index, match: m[0] });
    }
  }
  return found
    .sort((a, b) => a.index - b.index)
    .map(({ index, match }) => ({ line: lineAt(text, index), match }));
}

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}
