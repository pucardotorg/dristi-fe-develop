/**
 * Auth failures, named by what happened rather than by HTTP status.
 *
 * Screens branch on `code` and pick their own (translated) words; they never see a
 * status code or a backend sentence, except `fieldErrors` on `invalid-details`, which
 * carries the backend's own per-field messages because only the server knows its
 * password rules in full.
 */

import type { FieldErrors } from "@/lib/api";

export type AuthErrorCode =
  /** The backend rejected the number's format (it must be +91 followed by 6–9…). */
  | "invalid-mobile"
  /** The code is wrong, expired, or already used. */
  | "invalid-code"
  /** Registering a number that already has a finished account. */
  | "already-registered"
  /** Sign-in failed. Deliberately vague: the backend will not say whether the number
   *  exists, so nobody can probe which numbers are registered. */
  | "invalid-credentials"
  /** An advocate or clerk whose registration the court has not yet approved. The
   *  backend gives such an account no session. */
  | "approval-pending"
  /** There is no rejected registration to load or resubmit (it was approved, or is
   *  pending again). */
  | "nothing-to-resubmit"
  /** A code went out moments ago; `retryAfterSeconds` says when another may. */
  | "resend-too-soon"
  /** The verified session is gone (expired, or signed out in another tab). */
  | "session-expired"
  /** The upload was too large for the server (or the web server in front of it) to
   *  accept — even when it is within the app's own 10 MB limit. */
  | "document-too-large"
  /** The backend refused some submitted fields; see `fieldErrors`. */
  | "invalid-details"
  /** This build cannot complete that request yet (e.g. a role not integrated). */
  | "not-supported"
  /** The server could not be reached, timed out, or failed. Worth retrying. */
  | "unavailable";

export class AuthError extends Error {
  override readonly name = "AuthError";
  readonly code: AuthErrorCode;
  readonly retryAfterSeconds: number | null;
  readonly fieldErrors: FieldErrors;

  constructor(
    code: AuthErrorCode,
    options: {
      message?: string;
      retryAfterSeconds?: number | null;
      fieldErrors?: FieldErrors;
      cause?: unknown;
    } = {},
  ) {
    super(options.message ?? code, { cause: options.cause });
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
    this.fieldErrors = options.fieldErrors ?? {};
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
