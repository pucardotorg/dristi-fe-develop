/**
 * The auth seam against the DRISTI backend (dristi-be spec 0005).
 *
 *   requestOtp            POST /auth/otp/request   { mobile_number, purpose }
 *   verifyRegistrationOtp POST /users              { mobile_number, otp }      → session
 *   signIn                POST /sessions           { mobile_number, otp | password } → session
 *   completeRegistration  POST /litigants          { name, email?, password, terms_accepted }
 *   signOut               DELETE /sessions
 *
 * The session is a cookie the browser keeps; the API client sends it, and the CSRF token
 * the backend sets at sign-in, on every later call. This file's other job is translating
 * the backend's statuses into `AuthError` codes, so no screen ever reads a status code.
 */

import { api, isApiError, type ApiClient } from "@/lib/api";

import { AuthError, type AuthErrorCode } from "./errors";
import { toBackendMobile } from "./mobile";
import type { AuthService } from "./service";
import type {
  AccountState,
  BackendRole,
  Credentials,
  OtpPurpose,
  RegistrationDetails,
  RegistrationRole,
  RegistrationStatus,
} from "./types";

/**
 * Which endpoint completes each role. Only the litigant flow is integrated: power of
 * attorney has no endpoint of its own on the backend yet (posting it to `litigants`
 * would record the wrong role), and advocate / clerk registration needs the bar-ID
 * document upload and court approval, which come later.
 */
const COMPLETION_PATH: Partial<Record<RegistrationRole, string>> = {
  litigant: "litigants",
};

type AccountStateBody = {
  user_id?: unknown;
  registration_status?: unknown;
  next?: unknown;
  role?: unknown;
};

const BACKEND_ROLES: readonly BackendRole[] = ["LITIGANT", "POWER_OF_ATTORNEY", "ADVOCATE", "CLERK"];

function toAccountState(body: AccountStateBody, name: string | null = null): AccountState {
  if (typeof body?.user_id !== "string" || typeof body.registration_status !== "string") {
    throw new AuthError("unavailable", { message: "Unexpected account response." });
  }
  return {
    userId: body.user_id,
    registrationStatus: body.registration_status as RegistrationStatus,
    next: typeof body.next === "string" ? body.next : null,
    role: BACKEND_ROLES.includes(body.role as BackendRole) ? (body.role as BackendRole) : null,
    name,
  };
}

/**
 * Translate an API failure. `byStatus` names what a status means for *this* call — a
 * 401 is a wrong code on one endpoint and wrong credentials on another. Anything not
 * listed, and every network failure or timeout, is `unavailable`.
 */
function translate(
  error: unknown,
  byStatus: Partial<Record<number, AuthErrorCode>>,
): AuthError {
  if (error instanceof AuthError) return error;
  if (!isApiError(error) || error.kind !== "http") {
    return new AuthError("unavailable", { cause: error });
  }

  if (error.status === 400 && error.fieldErrors.mobile_number) {
    return new AuthError("invalid-mobile", { cause: error });
  }
  if (error.status === 429) {
    return new AuthError("resend-too-soon", {
      retryAfterSeconds: error.retryAfterSeconds,
      cause: error,
    });
  }
  // Django answers a failed CSRF check with 403 too. That is a deployment fault (this
  // app's origin missing from the backend's CSRF_TRUSTED_ORIGINS), not the person's,
  // so it must not read as "your session expired".
  if (error.status === 403 && error.message.startsWith("CSRF Failed")) {
    console.error(
      "[auth] The backend refused the CSRF check. Add this app's origin " +
        `(${typeof window === "undefined" ? "?" : window.location.origin}) to the backend's CSRF_TRUSTED_ORIGINS.`,
    );
    return new AuthError("unavailable", { message: error.message, cause: error });
  }

  const code = byStatus[error.status];
  if (!code) return new AuthError("unavailable", { cause: error });
  return new AuthError(code, {
    fieldErrors: code === "invalid-details" ? error.fieldErrors : undefined,
    cause: error,
  });
}

export class HttpAuthService implements AuthService {
  constructor(private readonly client: ApiClient = api) {}

  async requestOtp(mobile: string, purpose: OtpPurpose): Promise<void> {
    try {
      await this.client.post("auth/otp/request", {
        mobile_number: toBackendMobile(mobile),
        purpose,
      });
    } catch (error) {
      throw translate(error, {});
    }
  }

  async verifyRegistrationOtp(mobile: string, otp: string): Promise<AccountState> {
    try {
      const body = await this.client.post<AccountStateBody>("users", {
        mobile_number: toBackendMobile(mobile),
        otp,
      });
      return toAccountState(body);
    } catch (error) {
      throw translate(error, { 400: "invalid-code", 401: "invalid-code", 409: "already-registered" });
    }
  }

  async signIn(credentials: Credentials): Promise<AccountState> {
    const { mobile, ...secret } = credentials;
    try {
      const body = await this.client.post<AccountStateBody>("sessions", {
        mobile_number: toBackendMobile(mobile),
        ...secret,
      });
      return toAccountState(body);
    } catch (error) {
      throw translate(error, { 400: "invalid-credentials", 401: "invalid-credentials" });
    }
  }

  async completeRegistration(
    role: RegistrationRole,
    details: RegistrationDetails,
  ): Promise<AccountState> {
    const path = COMPLETION_PATH[role];
    if (!path) {
      throw new AuthError("not-supported", {
        message: `Registration as "${role}" is not integrated yet.`,
      });
    }

    const email = details.email?.trim();
    try {
      const body = await this.client.post<AccountStateBody>(path, {
        name: details.name.trim(),
        ...(email ? { email } : {}),
        password: details.password,
        terms_accepted: true,
      });
      return toAccountState(body, details.name.trim());
    } catch (error) {
      throw translate(error, {
        400: "invalid-details",
        401: "session-expired",
        403: "session-expired",
        409: "already-registered",
      });
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.client.delete("sessions");
    } catch (error) {
      throw translate(error, {});
    }
  }
}
