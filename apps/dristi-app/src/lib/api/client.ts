/**
 * The one way the browser talks to the DRISTI backend.
 *
 * Every call goes to `/api/v1/...` on this app's own origin, where the API proxy
 * (`app/api/v1/[...path]/route.ts`) forwards it to the backend. This module owns
 * everything a call needs and nothing a screen should repeat:
 *
 *   - the session cookie travels on every call (`credentials: "same-origin"`);
 *   - write calls carry Django's CSRF header;
 *   - bodies are JSON unless they are `FormData` / `Blob` (uploads);
 *   - every call has a timeout and can be cancelled with an `AbortSignal`;
 *   - the backend's `meta` envelope comes off (`envelope.ts`);
 *   - every failure becomes an `ApiError` (`errors.ts`).
 *
 * Paths are written as the backend documents them, with or without slashes —
 * `api.get("locations")`, `api.get("locations/")` — and the trailing slash Django needs
 * is the proxy's job. Interpolate ids with `encodeURIComponent`.
 *
 * Repositories (`lib/<feature>/data/http.ts`) call this; screens call repositories.
 */

import { CSRF_HEADER_NAME, readCsrfToken } from "./csrf";
import { unwrapEnvelope, type ResponseMeta } from "./envelope";
import { ApiError, parseErrorBody, parseRetryAfter } from "./errors";

/** Where the API proxy is mounted on this app's origin. */
export const API_BASE_PATH = "/api/v1";

/** Default client-side timeout. Pass `timeoutMs` per call for slow uploads. */
export const DEFAULT_TIMEOUT_MS = 30_000;

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";

type QueryValue = string | number | boolean | null | undefined;
/** `null` / `undefined` values are left out; arrays repeat the key (`?status=a&status=b`). */
export type Query = Record<string, QueryValue | readonly QueryValue[]>;

/** JSON, or raw bodies the browser sends as-is (multipart uploads, files). */
export type RequestBody = unknown;

export type ResponseType = "json" | "blob" | "text";

export type RequestOptions = {
  query?: Query;
  body?: RequestBody;
  headers?: HeadersInit;
  signal?: AbortSignal;
  /** Milliseconds before giving up; `null` disables the timeout. */
  timeoutMs?: number | null;
  /** How to read a successful body. Defaults to JSON. */
  responseType?: ResponseType;
};

export type ApiResponse<T> = {
  data: T;
  /** The backend's response metadata, when the body carried it. */
  meta: ResponseMeta | null;
  status: number;
  headers: Headers;
};

export type ApiClientConfig = {
  /** Path prefix or absolute origin + prefix. The browser client uses `API_BASE_PATH`. */
  baseUrl: string;
  fetchImpl?: typeof fetch;
  getCsrfToken?: () => string | null;
  defaultTimeoutMs?: number;
};

export type ApiClient = ReturnType<typeof createApiClient>;

const SAFE_METHODS = new Set<HttpMethod>(["GET", "HEAD"]);

/** `"/locations/abc/"` → `"locations/abc"`. Absolute URLs are refused: wrong client. */
function normalizePath(path: string): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) {
    throw new TypeError(`api paths are relative to ${API_BASE_PATH}; got "${path}".`);
  }
  return path.replace(/^\/+|\/+$/g, "");
}

function buildQuery(query: Query | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item !== null && item !== undefined) params.append(key, String(item));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

function isRawBody(body: unknown): body is BodyInit {
  return (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body)
  );
}

async function readBody(response: Response, responseType: ResponseType): Promise<unknown> {
  if (responseType === "blob") return response.blob();
  if (responseType === "text") return response.text();
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/** Best-effort read of an error body: JSON if it parses, otherwise nothing. */
async function readErrorBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null; // an HTML error page from something in between, say
  }
}

export function createApiClient(config: ApiClientConfig) {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  // Late-bound: calling a detached `window.fetch` throws "Illegal invocation", and tests
  // replace the global after this module loads.
  const fetchImpl = config.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  const getCsrfToken = config.getCsrfToken ?? (() => null);
  const defaultTimeoutMs = config.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const { query, body, signal, responseType = "json" } = options;
    const timeoutMs = options.timeoutMs === undefined ? defaultTimeoutMs : options.timeoutMs;

    const url = `${baseUrl}/${normalizePath(path)}${buildQuery(query)}`;
    const headers = new Headers(options.headers);
    if (!headers.has("accept")) headers.set("accept", "application/json");

    let payload: BodyInit | undefined;
    if (body !== undefined) {
      if (isRawBody(body)) {
        payload = body; // the browser sets the multipart boundary itself
      } else {
        payload = JSON.stringify(body);
        headers.set("content-type", "application/json");
      }
    }

    if (!SAFE_METHODS.has(method)) {
      const token = getCsrfToken();
      if (token) headers.set(CSRF_HEADER_NAME, token);
    }

    // One controller, aborted by whichever comes first: the caller or the timeout.
    const controller = new AbortController();
    let timedOut = false;
    const timer =
      timeoutMs === null
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeoutMs);
    const onCallerAbort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener("abort", onCallerAbort, { once: true });

    try {
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method,
          headers,
          body: payload,
          credentials: "same-origin",
          signal: controller.signal,
        });
      } catch (cause) {
        if (timedOut) {
          throw new ApiError({
            kind: "timeout",
            message: "The server took too long to respond. Please try again.",
            cause,
          });
        }
        if (controller.signal.aborted) {
          throw new ApiError({ kind: "aborted", message: "The request was cancelled.", cause });
        }
        throw new ApiError({
          kind: "network",
          message: "Could not reach the server. Check your connection and try again.",
          cause,
        });
      }

      if (!response.ok) {
        const errorBody = await readErrorBody(response);
        const parsed = parseErrorBody(errorBody);
        throw new ApiError({
          kind: "http",
          status: response.status,
          message: parsed.message,
          code: parsed.code,
          fieldErrors: parsed.fieldErrors,
          retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
          body: errorBody,
        });
      }

      if (method === "HEAD" || response.status === 204 || response.status === 205) {
        return { data: null as T, meta: null, status: response.status, headers: response.headers };
      }

      let raw: unknown;
      try {
        raw = await readBody(response, responseType);
      } catch (cause) {
        if (controller.signal.aborted) {
          throw new ApiError({
            kind: timedOut ? "timeout" : "aborted",
            message: timedOut
              ? "The server took too long to respond. Please try again."
              : "The request was cancelled.",
            cause,
          });
        }
        throw new ApiError({
          kind: "invalid-response",
          status: response.status,
          message: "The server sent a response this app could not read.",
          cause,
        });
      }

      const { data, meta } =
        responseType === "json" ? unwrapEnvelope(raw) : { data: raw, meta: null };
      return { data: data as T, meta, status: response.status, headers: response.headers };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onCallerAbort);
    }
  }

  /** Shorthands that return only the payload. Use `request` for status, headers or meta. */
  return {
    request,
    get: <T>(path: string, options?: Omit<RequestOptions, "body">) =>
      request<T>("GET", path, options).then((r) => r.data),
    post: <T>(path: string, body?: RequestBody, options?: Omit<RequestOptions, "body">) =>
      request<T>("POST", path, { ...options, body }).then((r) => r.data),
    put: <T>(path: string, body?: RequestBody, options?: Omit<RequestOptions, "body">) =>
      request<T>("PUT", path, { ...options, body }).then((r) => r.data),
    patch: <T>(path: string, body?: RequestBody, options?: Omit<RequestOptions, "body">) =>
      request<T>("PATCH", path, { ...options, body }).then((r) => r.data),
    delete: <T = null>(path: string, options?: Omit<RequestOptions, "body">) =>
      request<T>("DELETE", path, options).then((r) => r.data),
  };
}

/** The app's client: same-origin, through the API proxy, with the browser's CSRF token. */
export const api = createApiClient({ baseUrl: API_BASE_PATH, getCsrfToken: readCsrfToken });
