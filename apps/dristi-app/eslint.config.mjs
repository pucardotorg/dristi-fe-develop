import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

/**
 * No public CDN (issue #44): every script, style, font, image and video is served by this
 * app. These rules catch a remote asset at PR time; the Content-Security-Policy in
 * next.config.ts refuses one in the browser. See docs/self-hosted-assets.md.
 */
const SELF_HOST =
  "Serve scripts, styles, fonts, images and video from this app, not a CDN or another site (issue #44, docs/self-hosted-assets.md).";

/** `https://…`, `http://…` or protocol-relative `//…`. */
const REMOTE = String.raw`/^(https?:)?\/\//`;

/** Elements that load what their URL attribute points at. `<a>`/`Link` only navigate. */
const ASSET_ELEMENT = String.raw`JSXOpeningElement[name.name=/^(script|link|img|iframe|video|audio|source|track|embed|object|image|use|Image|Script)$/]`;
const ASSET_ATTRIBUTE = String.raw`JSXAttribute[name.name=/^(src|srcSet|href|poster|data|xlinkHref)$/]`;
const ASSET_PROPERTY = String.raw`AssignmentExpression[left.property.name=/^(src|srcset|poster|workerSrc)$/]`;
const ASSET_CONSTRUCTOR = String.raw`NewExpression[callee.name=/^(Worker|SharedWorker|Audio)$/]`;

/** Hosts that only ever serve files: named anywhere in a string, they are an asset. */
const CDN_HOSTS = String.raw`/(unpkg\.com|cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|esm\.sh|cdn\.skypack\.dev|fonts\.googleapis\.com|fonts\.gstatic\.com|ajax\.googleapis\.com|storage\.googleapis\.com|code\.jquery\.com|bootstrapcdn\.com|fontawesome\.com|use\.typekit\.net|cdn\.tailwindcss\.com|cloudfront\.net|akamaihd\.net|raw\.githubusercontent\.com|gravatar\.com|youtube\.com|youtube-nocookie\.com|youtu\.be|ytimg\.com|vimeo\.com|vimeocdn\.com)/`;

const remoteAsset = (selector) => [
  { selector: `${selector} Literal[value=${REMOTE}]`, message: SELF_HOST },
  { selector: `${selector} TemplateLiteral[quasis.0.value.raw=${REMOTE}]`, message: SELF_HOST },
];

const noPublicCdn = {
  files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          { name: "next/font/google", message: `Use next/font/local. ${SELF_HOST}` },
          { name: "@next/font/google", message: `Use next/font/local. ${SELF_HOST}` },
        ],
      },
    ],
    "no-restricted-syntax": [
      "error",
      ...remoteAsset(`${ASSET_ELEMENT} > ${ASSET_ATTRIBUTE}`),
      ...remoteAsset(ASSET_PROPERTY),
      ...remoteAsset(ASSET_CONSTRUCTOR),
      ...remoteAsset("ImportExpression"),
      { selector: `Literal[value=${CDN_HOSTS}]`, message: SELF_HOST },
      { selector: `TemplateElement[value.raw=${CDN_HOSTS}]`, message: SELF_HOST },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  noPublicCdn,
  // Last, so it switches off the style rules above and Prettier alone formats.
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/vendor/**"]),
]);

export default eslintConfig;
