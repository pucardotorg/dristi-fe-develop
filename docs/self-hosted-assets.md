# Self-hosted assets

The Dristi App serves every script, stylesheet, font, image and video itself. Nothing is
loaded from a public CDN or another site
([issue #44](https://github.com/pucardotorg/dristi-fe-develop/issues/44)). Read this before
adding a font, a library that loads files at runtime, an embed or any other asset.

## Where each kind of asset goes

| Asset                              | Put it here                                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JavaScript and CSS from npm        | Import it. Next bundles it and serves it from `/_next/static`.                                                                                                                                                                             |
| Fonts                              | Commit the `.woff2` files with their licence and load them with `next/font/local` (see `src/app/provakil/layout.tsx`).                                                                                                                     |
| Images, PDFs, sample files         | `apps/dristi-app/public/`, referenced by path (`/brand/…`).                                                                                                                                                                                |
| Video and captions                 | `apps/dristi-app/public/videos/`, played with `<video>` and a `<track>` (see `components/onboarding/video-slot.tsx`).                                                                                                                      |
| Files a library fetches at runtime | Copy them out of `node_modules` in `apps/dristi-app/scripts/copy-runtime-assets.mjs` into `public/vendor/`, then point the library at that path. The pdf.js worker works this way.                                                         |
| Images in CMS content              | Our own servers only: this app, or the DRISTI back end behind `/api`. CMS markdown (`components/cms/cms-markdown.tsx`) renders any image URL an editor writes, and the policy blocks one from another site, so it shows as a broken image. |

Do not use `next/font/google`. It serves the font from this app but downloads it from Google
on every build and dev run. Do not embed YouTube, Vimeo or similar players either: they load
their own scripts, styles and images from their own servers.

## What keeps it this way

| Check                                                                        | Runs in                       | Catches                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint (`eslint.config.mjs`)                                                 | `npm run lint`, CI            | `next/font/google`; a remote URL in the `src`/`href`/`poster` of `script`, `link`, `img`, `iframe`, `video`, `Image`, `Script` and similar; one assigned to `.src` or `workerSrc`, given to `new Worker` or `import()`; a known CDN or video host in any string |
| `src/lib/security/remote-assets.test.ts`                                     | `npm run test:app`, CI        | A remote `url()`, `@import`, `src` or `href` in any CSS, SVG or HTML file under `src/` or `public/` (ESLint does not read these)                                                                                                                                |
| Content-Security-Policy (`src/lib/security/csp.ts`, set in `next.config.ts`) | Every browser, every response | Anything that gets past the two above, including files a dependency tries to load. The browser refuses scripts, styles, fonts, images, media, workers and frames from any other origin.                                                                         |

Links that only navigate (`<a href>`, `Link`) to other sites are fine.

## The policy

`default-src 'self'`, and every kind of file (`script-src`, `style-src`, `img-src`,
`font-src`, `media-src`, `frame-src`, `worker-src`, `object-src`) is limited to this origin
plus `data:` / `blob:` where uploads and previews need them. Inline scripts and styles are
allowed because Next's App Router and next-themes rely on them; nonces would make every page
render dynamically. `'unsafe-eval'` and the HMR websocket are allowed in `next dev` only.

`connect-src`, the data calls the browser may make, also allows:

| Origin                         | Why                                                                                           | When                                                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `https://ifsc.razorpay.com`    | IFSC → bank and branch on the filing forms (`lib/filing/lookups.ts`, `lib/bulk/reference.ts`) | Always                                                                                                                             |
| `https://api.postalpincode.in` | PIN → district and state, same places                                                         | Always                                                                                                                             |
| FasterFixes API                | The review widget ([feedback-widget.md](feedback-widget.md))                                  | Only when `NEXT_PUBLIC_FASTERFIXES_PROJECT_ID` is set at build time; `NEXT_PUBLIC_FASTERFIXES_API_ORIGIN` or the FasterFixes cloud |

These are data services, not file hosts, and were kept by decision when #44 was done. Moving
the lookups behind our own server, or onto the court's services, is a separate change. To
allow another data origin, add it in `connectOriginsFromEnv` with its reason and a test.

The policy is fixed at build time, like the `NEXT_PUBLIC_*` values it reads.

## Deployments

- **Docker / `next start`**: the app sends the policy itself.
- **Static export** (`STATIC_EXPORT=true`): there is no server to send headers. Set the same
  `Content-Security-Policy` on the web server in front.
- **Netlify previews**: Netlify serves the app from its own CDN. That is hosting, not
  something the code controls; decide per deployment whether previews may run there.
