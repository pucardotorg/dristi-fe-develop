/**
 * One error type for every way an API call can fail.
 *
 * Screens never inspect `fetch` failures, status codes or DRF bodies directly; they get
 * an `ApiError` and branch on `kind` (and `status` for HTTP failures). That keeps the
 * backend's error format in one file: if it changes, this file changes, screens do not.
 *
 * DRF reports errors in two shapes, and both arrive here:
 *   { "detail": "Registration is not complete." }               — one message
 *   { "mobile_number": ["Enter a valid number."], "otp": [...] } — per-field messages
 * Nested serializers nest the second shape; it is flattened to dotted keys
 * ("address.pincode", "witnesses.1.name") so a form can look a field up directly.
 */

/**
 * - `http`: the server answered with a non-2xx status.
 * - `network`: no answer at all (offline, DNS, refused). `status` is 0.
 * - `timeout`: the client gave up waiting. `status` is 0.
 * - `aborted`: the caller cancelled (e.g. a component unmounted). Usually ignored.
 * - `invalid-response`: a 2xx whose body was not the JSON the call expected.
 */
export type ApiErrorKind = "http" | "network" | "timeout" | "aborted" | "invalid-response";

/** Field path → messages, e.g. `{ "address.pincode": ["Enter 6 digits."] }`. */
export type FieldErrors = Record<string, string[]>;

/** DRF's key for errors that belong to the whole form rather than one field. */
export const NON_FIELD_ERRORS = "non_field_errors";

type ApiErrorInit = {
  kind: ApiErrorKind;
  status?: number;
  message: string;
  code?: string | null;
  fieldErrors?: FieldErrors;
  retryAfterSeconds?: number | null;
  body?: unknown;
  cause?: unknown;
};

export class ApiError extends Error {
  override readonly name = "ApiError";
  readonly kind: ApiErrorKind;
  /** HTTP status; 0 when the server never answered. */
  readonly status: number;
  /** Machine-readable code when the server sent one (our proxy always does). */
  readonly code: string | null;
  readonly fieldErrors: FieldErrors;
  /** From `Retry-After` (e.g. the OTP resend cooldown, HTTP 429). */
  readonly retryAfterSeconds: number | null;
  /** The parsed body, for debugging. Not for display. */
  readonly body: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message, { cause: init.cause });
    this.kind = init.kind;
    this.status = init.status ?? 0;
    this.code = init.code ?? null;
    this.fieldErrors = init.fieldErrors ?? {};
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
    this.body = init.body;
  }

  /** The first message for a field, or undefined. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

const GENERIC_HTTP_MESSAGE = "Something went wrong. Please try again.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Flatten DRF's (possibly nested) field errors into dotted paths. */
function collectFieldErrors(value: unknown, path: string, out: FieldErrors): void {
  if (typeof value === "string") {
    (out[path] ??= []).push(value);
    return;
  }
  if (Array.isArray(value)) {
    // A list of strings is one field's messages; a list of objects is per-item errors.
    value.forEach((item, index) => {
      collectFieldErrors(item, typeof item === "string" ? path : `${path}.${index}`, out);
    });
    return;
  }
  if (isRecord(value)) {
    for (const [key, nested] of Object.entries(value)) {
      collectFieldErrors(nested, path ? `${path}.${key}` : key, out);
    }
  }
}

/**
 * Turn an HTTP error body into the parts of an `ApiError`.
 *
 * `meta` (added to every response by the backend's renderer) is not an error and is
 * skipped. The message prefers `detail`, then the first non-field error, then a generic
 * sentence — never a raw status line.
 */
export function parseErrorBody(body: unknown): {
  message: string;
  code: string | null;
  fieldErrors: FieldErrors;
} {
  if (!isRecord(body)) {
    return { message: GENERIC_HTTP_MESSAGE, code: null, fieldErrors: {} };
  }

  const { detail, code } = body;
  const fieldErrors: FieldErrors = {};
  for (const [key, value] of Object.entries(body)) {
    if (key !== "detail" && key !== "code" && key !== "meta") {
      collectFieldErrors(value, key, fieldErrors);
    }
  }

  const message =
    (typeof detail === "string" && detail) ||
    fieldErrors[NON_FIELD_ERRORS]?.[0] ||
    GENERIC_HTTP_MESSAGE;

  return { message, code: typeof code === "string" ? code : null, fieldErrors };
}

/** `Retry-After` as seconds: either delta-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now) / 1000));
}
