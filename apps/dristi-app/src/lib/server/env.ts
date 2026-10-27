/**
 * Server-side configuration, read at request time.
 *
 * Nothing here is `NEXT_PUBLIC_`, so none of it is inlined into the browser bundle and
 * none of it is frozen at build time: the same build (the Docker image CI pushes from
 * `main`) can be pointed at any backend by setting the variable where it runs. Only
 * server code — route handlers, server components — may import this module. Browser-side
 * settings live in `lib/config.ts`.
 *
 * Values are parsed, not trusted: a malformed value is reported as a reason the API
 * proxy can show, instead of becoming a confusing upstream URL.
 */

export type ApiBaseUrlResult =
  | { ok: true; baseUrl: string }
  | { ok: false; reason: string };

/**
 * The backend's versioned API root the proxy forwards to, e.g.
 * `https://be.dristi-dev.in/api/v1`.
 *
 * The path is part of the value on purpose: the API version is configuration, so moving
 * to `/api/v2` (or serving the API under another prefix) is an environment change, not a
 * code change. Returned without a trailing slash.
 */
export function readApiBaseUrl(
  raw: string | undefined = process.env.API_BASE_URL,
): ApiBaseUrlResult {
  const value = raw?.trim();
  if (!value) {
    return {
      ok: false,
      reason:
        "API_BASE_URL is not set. Add it to apps/dristi-app/.env.development.local " +
        "(see .env.example) or to the server's environment.",
    };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // The reason reaches the browser (the proxy's 503), so the raw value is not echoed:
    // a malformed one can still carry an internal host or credentials.
    return { ok: false, reason: "API_BASE_URL is not a valid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `API_BASE_URL must use http or https, not "${url.protocol}".` };
  }
  if (url.search || url.hash || url.username || url.password) {
    return {
      ok: false,
      reason: `API_BASE_URL must be a plain URL (e.g. "${url.origin}/api/v1"), without a query, fragment or credentials.`,
    };
  }

  return { ok: true, baseUrl: `${url.origin}${url.pathname.replace(/\/+$/, "")}` };
}
