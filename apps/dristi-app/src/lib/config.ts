/**
 * Browser-visible app settings.
 *
 * Next.js inlines `NEXT_PUBLIC_*` into the bundle at **build** time, so these are fixed
 * per build: they are for settings that are safe to publish and that a deployment
 * chooses once. Anything secret, or anything that must change without a rebuild (the
 * backend address), is server-only and lives in `lib/server/env.ts`. Where data and
 * sign-in come from (sandbox or backend) is decided in `lib/data/source.ts`.
 *
 * Every variable is documented in `apps/dristi-app/.env.example`. Each one is read with
 * its full literal name — `process.env.NEXT_PUBLIC_X` — because that is the only form
 * the inliner recognises.
 */

/**
 * The app's own public address, e.g. `https://fe.dristi-dev.in` — for absolute links
 * that leave the browser (a signing link sent to someone else). Optional: unset, the
 * address the browser is on is used, which is right whenever people reach the app on
 * the same address they share. Set it when they do not (a preview host, an internal
 * name behind a public domain).
 */
export function appBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return typeof window === "undefined" ? "" : window.location.origin;
}

/** An absolute link to a path in this app. `path` starts with `/`. */
export function appUrl(path: string): string {
  return `${appBaseUrl()}${path}`;
}
