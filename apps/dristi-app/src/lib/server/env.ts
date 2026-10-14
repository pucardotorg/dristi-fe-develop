/**
 * Server-side configuration, read at request time.
 *
 * Nothing here is `NEXT_PUBLIC_`, so none of it is inlined into the browser bundle and
 * none of it is frozen at build time: the same build (the Docker image CI pushes from
 * `main`) can be pointed at any backend by setting the variable where it runs. Only
 * server code — route handlers, server components — may import this module.
 *
 * Values are parsed, not trusted: a malformed origin is reported as a reason the API
 * proxy can show, instead of becoming a confusing upstream URL.
 */

export type ApiOriginResult =
  | { ok: true; origin: string }
  | { ok: false; reason: string };

/**
 * The backend origin the API proxy forwards to, e.g. `http://localhost:8000`.
 *
 * Origin only — scheme, host and port. The `/api/v1` prefix belongs to the proxy, so a
 * path here is a configuration mistake and is rejected rather than silently doubled.
 */
export function readApiOrigin(raw: string | undefined = process.env.API_ORIGIN): ApiOriginResult {
  const value = raw?.trim();
  if (!value) {
    return {
      ok: false,
      reason:
        "API_ORIGIN is not set. Add it to apps/dristi-app/.env.development.local " +
        "(see .env.example) or to the server's environment.",
    };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: `API_ORIGIN is not a valid URL: "${value}".` };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `API_ORIGIN must use http or https, not "${url.protocol}".` };
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    return {
      ok: false,
      reason: `API_ORIGIN must be an origin only (e.g. "${url.origin}"), without a path or query.`,
    };
  }

  return { ok: true, origin: url.origin };
}
