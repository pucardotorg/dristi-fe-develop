/**
 * Same-origin proxy from this app to the DRISTI backend.
 *
 * The browser calls `/api/v1/...` on the app's own origin; this forwards the call to
 * `${API_BASE_URL}/.../` (e.g. `https://be.dristi-dev.in/api/v1/.../`) and streams the
 * answer back. Being same-origin is the point: the backend authenticates with a session
 * cookie and checks a CSRF token, and both just work when the browser believes it is
 * talking to one site. There is no CORS to configure and no cookie domain to share.
 *
 * Why a route handler and not the alternatives:
 *   - `next.config` rewrites are fixed at build time, so one Docker image could not
 *     serve two environments;
 *   - Next's `proxy.ts` buffers request bodies up to a cap (10 MB by default) and
 *     truncates beyond it, which would corrupt large case-document uploads.
 *
 * Three rules shape the forwarding:
 *   1. **Trailing slash.** Next.js redirects `/x/` to `/x` before any app code runs, and
 *      Django routes require the slash. The browser client sends paths without it; this
 *      module adds it to every upstream path. Callers never think about it.
 *   2. **Origin is forwarded untouched.** The backend's CSRF check compares the browser's
 *      `Origin` with its `CSRF_TRUSTED_ORIGINS`; the fix for a mismatch is to trust this
 *      app's origin there, never to rewrite the header here.
 *   3. **The path cannot escape `API_BASE_URL`.** Every segment is decoded, checked and
 *      re-encoded, so `..` (in any encoding) is refused instead of reaching, say,
 *      `/admin/`.
 */

import type { ApiBaseUrlResult } from "./env";

/** Where this app serves the proxy. The browser client calls paths under it. */
export const API_PREFIX = "/api/v1";

/** Upper bound for one upstream call. Generous: uploads of scanned documents are slow. */
export const UPSTREAM_TIMEOUT_MS = 60_000;

/** RFC 9110 §7.6.1 connection-specific headers: meaningful for one hop only. */
const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

/**
 * Request headers not passed upstream. `host` is the backend's own; `content-length` is
 * recomputed from the buffered body; `accept-encoding` is left to fetch, which
 * negotiates and decodes compression itself.
 */
const REQUEST_DROP = new Set([...HOP_BY_HOP, "host", "content-length", "accept-encoding"]);

/**
 * Response headers not passed back. fetch has already decoded the body, so the upstream
 * `content-encoding` and `content-length` no longer describe what we send.
 */
const RESPONSE_DROP = new Set([...HOP_BY_HOP, "content-encoding", "content-length", "set-cookie"]);

/** Next.js-internal request headers; never meaningful to the backend. */
const INTERNAL_PREFIX = "x-middleware-";

export type ProxyOptions = {
  api: ApiBaseUrlResult;
  /** Injected in tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** A proxy-made error, shaped like a DRF error so the browser client parses one format. */
function proxyError(status: number, code: string, detail: string): Response {
  return Response.json(
    { detail, code },
    { status, headers: { "cache-control": "no-store" } },
  );
}

/**
 * The upstream URL for an incoming `/api/v1/...` pathname, or `null` if the path is not
 * one this proxy will forward.
 *
 * Exported for tests. `baseUrl` is the validated `API_BASE_URL` (no trailing slash);
 * `pathname` is the raw request pathname (percent-encoded as the client sent it);
 * `search` is passed through verbatim, including the leading `?`.
 */
export function buildUpstreamUrl(baseUrl: string, pathname: string, search: string): URL | null {
  if (pathname !== API_PREFIX && !pathname.startsWith(`${API_PREFIX}/`)) return null;

  const rest = pathname.slice(API_PREFIX.length).replace(/^\/+|\/+$/g, "");
  const segments: string[] = [];
  for (const raw of rest ? rest.split("/") : []) {
    let segment: string;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      return null; // malformed percent-encoding
    }
    if (segment === "" || segment === "." || segment === "..") return null;
    segments.push(encodeURIComponent(segment));
  }

  const path = segments.length ? `${segments.join("/")}/` : "";
  const url = new URL(`${baseUrl}/${path}`);
  url.search = search;

  // Belt and braces: whatever the parser did, the result must still be under the base.
  const basePath = new URL(`${baseUrl}/`).pathname;
  return url.pathname.startsWith(basePath) ? url : null;
}

function upstreamRequestHeaders(request: Request): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (REQUEST_DROP.has(key) || key.startsWith(INTERNAL_PREFIX)) return;
    headers.set(key, value);
  });

  // Tell the backend who the browser actually reached, unless a proxy in front of this
  // app (or Next.js itself) has already said so.
  const incoming = new URL(request.url);
  if (!headers.has("x-forwarded-host")) {
    headers.set("x-forwarded-host", request.headers.get("host") ?? incoming.host);
  }
  if (!headers.has("x-forwarded-proto")) {
    headers.set("x-forwarded-proto", incoming.protocol.replace(/:$/, ""));
  }
  return headers;
}

function downstreamResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!RESPONSE_DROP.has(key)) headers.set(key, value);
  });
  // Each cookie is its own header line; joining them with commas would break them.
  for (const cookie of upstream.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return headers;
}

/** Forward one request to the backend and return the backend's response. */
export async function proxyToApi(request: Request, options: ProxyOptions): Promise<Response> {
  const { api, fetchImpl = fetch, timeoutMs = UPSTREAM_TIMEOUT_MS } = options;

  if (!api.ok) {
    return proxyError(503, "api_not_configured", api.reason);
  }

  const incoming = new URL(request.url);
  const target = buildUpstreamUrl(api.baseUrl, incoming.pathname, incoming.search);
  if (!target) {
    return proxyError(400, "invalid_path", "This API path is not allowed.");
  }

  const method = request.method.toUpperCase();
  // Buffered rather than streamed: a streamed body goes out chunked, without a
  // Content-Length, and WSGI servers (Django's included) read such a body as empty.
  const body =
    method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetchImpl(target, {
      method,
      headers: upstreamRequestHeaders(request),
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(timeoutMs)]),
    });
  } catch (error) {
    if (request.signal.aborted) {
      // The browser went away; nobody is listening. 499 is nginx's "client closed request".
      return new Response(null, { status: 499 });
    }
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    // The query string is left out of the log: it can carry personal data (mobile numbers).
    console.error(
      `[api-proxy] ${method} ${target.pathname} failed: ${timedOut ? "timeout" : String(error)}`,
    );
    return timedOut
      ? proxyError(504, "upstream_timeout", "The DRISTI server took too long to respond.")
      : proxyError(502, "upstream_unreachable", "The DRISTI server could not be reached.");
  }

  // A null-body status cannot be constructed with a body, even an empty stream.
  const nullBody = upstream.status === 204 || upstream.status === 205 || upstream.status === 304;
  return new Response(nullBody || method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: downstreamResponseHeaders(upstream),
  });
}
