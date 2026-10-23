/**
 * Browser-visible configuration — the one place the app reads `NEXT_PUBLIC_*`.
 *
 * Next.js inlines `NEXT_PUBLIC_*` into the bundle at **build** time, so these are fixed
 * per build: they are for settings that are safe to publish and that a deployment
 * chooses once. Anything secret, or anything that must change without a rebuild (the
 * backend address), is server-only and lives in `lib/server/env.ts`.
 *
 * Every variable is documented in `apps/dristi-app/.env.example`. Each one is read with
 * its full literal name — `process.env.NEXT_PUBLIC_X` — because that is the only form
 * the inliner recognises.
 */

/**
 * Where sign-in and registration go.
 *
 * - `api` (default): the DRISTI backend, through the `/api/v1` proxy.
 * - `sandbox`: an in-browser stand-in (`lib/auth/sandbox.ts`) for demos and design
 *   review deployments that run without a backend. Any 6-digit code works.
 */
export type AuthSource = "api" | "sandbox";

export const AUTH_SOURCE: AuthSource =
  process.env.NEXT_PUBLIC_AUTH_SOURCE === "sandbox" ? "sandbox" : "api";

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
