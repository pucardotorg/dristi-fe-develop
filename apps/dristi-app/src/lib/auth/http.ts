/**
 * The auth seam against the DRISTI backend (dristi-be spec 0005).
 *
 *   requestOtp              POST /auth/otp/request   { mobile_number, purpose }
 *   verifyRegistrationOtp   POST /users              { mobile_number, otp }          → session
 *   signIn                  POST /sessions           { mobile_number, otp | password } → session
 *   getCurrentAccount       GET  /users/me           role, name, terms
 *   completeRegistration    POST /litigants          JSON
 *                           POST /power-of-attorneys JSON, same body as litigants
 *                           POST /advocates          multipart (bar ID document required)
 *                           POST /clerks             multipart (bar ID document required)
 *   getRejectedRegistration GET  /registrations/current
 *   resubmitRegistration    POST /registrations/current/resubmit  multipart (document required)
 *   signOut                 DELETE /sessions
 *
 * The session is a cookie the browser keeps; the API client sends it, and the CSRF token
 * the backend sets at sign-in, on every later call. This file's other job is translating
 * the backend's answers into `AuthError` codes, so no screen ever reads a status code.
 *
 * Advocates and clerks wait for court approval. The backend ends their session when they
 * finish registering or resubmit, refuses them a session while pending (403, E01013),
 * and gives a rejected one a session with `next: "resubmit"` so they can correct it.
 */

import { api, isApiError, type ApiClient } from "@/lib/api";

import { AuthError, type AuthErrorCode } from "./errors";
import { toBackendMobile } from "./mobile";
import type { AuthService } from "./service";
import type {
  AccountState,
  ApprovalStatus,
  CurrentAccount,
  ApprovedRole,
  BackendRole,
  Credentials,
  OtpPurpose,
  RegistrationDetails,
  RegistrationOutcome,
  RegistrationRole,
  RegistrationStatus,
  RejectedRegistration,
  ResubmissionDetails,
} from "./types";

/** Registered backend error codes this file branches on (dristi-be `apps/users/errors.py`). */
const E_APPROVAL_PENDING = "E01013";
const E_NOTHING_TO_RESUBMIT = "E01012";

/**
 * Uploads of scanned ID documents can take a while on a slow connection — longer than
 * the client's 30-second default. The proxy allows 60 s per hop.
 */
const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * Which endpoint completes each role. Power of attorney has its own endpoint, which
 * takes the litigant's JSON body and records the POWER_OF_ATTORNEY role. A role left
 * out of this map is refused as `not-supported` before anything is sent.
 */
const COMPLETION_PATH: Partial<Record<RegistrationRole, string>> = {
  litigant: "litigants",
  poa: "power-of-attorneys",
  advocate: "advocates",
  advocateClerk: "clerks",
};

/** The profile field that carries each approved role's registration number. */
const NUMBER_FIELD: Record<ApprovedRole, string> = {
  advocate: "bar_registration_id",
  advocateClerk: "clerk_registration_number",
};

const BACKEND_ROLES: readonly BackendRole[] = ["LITIGANT", "POWER_OF_ATTORNEY", "ADVOCATE", "CLERK"];
const APPROVAL_STATUSES: readonly ApprovalStatus[] = ["PENDING", "ACCEPTED", "REJECTED"];

type AccountStateBody = {
  user_id?: unknown;
  registration_status?: unknown;
  approval_status?: unknown;
  next?: unknown;
  role?: unknown;
  application_number?: unknown;
};

type RejectedRegistrationBody = {
  role?: unknown;
  officer_message?: unknown;
  rejected_at?: unknown;
  name?: unknown;
  email?: unknown;
  mobile_number?: unknown;
  registration_number?: unknown;
  document?: { file_name?: unknown } | null;
  application_number?: unknown;
};

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const textOrNull = (value: unknown): string | null =>
  typeof value === "string" && value ? value : null;

function toAccountState(body: AccountStateBody, name: string | null = null): AccountState {
  if (typeof body?.user_id !== "string" || typeof body.registration_status !== "string") {
    throw new AuthError("unavailable", { message: "Unexpected account response." });
  }
  return {
    userId: body.user_id,
    registrationStatus: body.registration_status as RegistrationStatus,
    next: typeof body.next === "string" ? body.next : null,
    approvalStatus: APPROVAL_STATUSES.includes(body.approval_status as ApprovalStatus)
      ? (body.approval_status as ApprovalStatus)
      : null,
    role: BACKEND_ROLES.includes(body.role as BackendRole) ? (body.role as BackendRole) : null,
    name,
  };
}

/** `"+919876543210"` → `"9876543210"`: the screens hold national digits. */
function toNational(mobile: string): string {
  return mobile.replace(/^\+91/, "");
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

  // Registered codes first: they are exact where a status is only a category.
  if (error.hasCode(E_APPROVAL_PENDING)) {
    return new AuthError("approval-pending", { cause: error });
  }
  if (error.hasCode(E_NOTHING_TO_RESUBMIT)) {
    return new AuthError("nothing-to-resubmit", { cause: error });
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
  if (error.status === 413) {
    // Too large for the server — or the web server in front of it, whose own HTML page
    // carries no usable message, so the screen words this itself.
    return new AuthError("document-too-large", { cause: error });
  }

  const code = byStatus[error.status];
  if (!code) return new AuthError("unavailable", { cause: error });
  return new AuthError(code, {
    fieldErrors: code === "invalid-details" ? error.fieldErrors : undefined,
    cause: error,
  });
}

/** A multipart body. Booleans go as "true"/"false", which DRF's form parser reads. */
function formBody(fields: Record<string, string | undefined>, document?: File): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(key, value);
  }
  if (document) form.append("bar_id_document", document, document.name);
  return form;
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
      // 403 here is an advocate or clerk still awaiting approval: older deployments
      // send it without the E01013 code, so the status covers them too.
      throw translate(error, {
        400: "invalid-credentials",
        401: "invalid-credentials",
        403: "approval-pending",
      });
    }
  }

  async getCurrentAccount(): Promise<CurrentAccount> {
    let body: {
      role?: unknown;
      name?: unknown;
      mobile_number?: unknown;
      email?: unknown;
      has_current_terms?: unknown;
      profile?: { bar_registration_id?: unknown } | null;
    };
    try {
      body = await this.client.get("users/me");
    } catch (error) {
      throw translate(error, { 401: "session-expired", 403: "session-expired" });
    }
    // The role decides which home opens, so a missing or unknown one is refused rather
    // than defaulted (a null role would open the litigant home for anyone).
    if (!BACKEND_ROLES.includes(body?.role as BackendRole)) {
      throw new AuthError("unavailable", { message: "Unexpected account response." });
    }
    return {
      role: body.role as BackendRole,
      name: textOrNull(body.name),
      mobile: toNational(text(body.mobile_number)),
      email: textOrNull(body.email),
      barNumber: textOrNull(body.profile?.bar_registration_id),
      hasCurrentTerms: body.has_current_terms !== false,
    };
  }

  async completeRegistration(
    role: RegistrationRole,
    details: RegistrationDetails,
  ): Promise<RegistrationOutcome> {
    const path = COMPLETION_PATH[role];
    if (!path) {
      throw new AuthError("not-supported", {
        message: `Registration as "${role}" is not integrated yet.`,
      });
    }

    const name = details.name.trim();
    const email = details.email?.trim() || undefined;
    const approved = role === "advocate" || role === "advocateClerk";
    const number = details.registrationNumber?.trim() ?? "";

    // Advocates and clerks are multipart only: the bar ID document is required for both,
    // and JSON cannot carry it. Nested profile fields become `profile.<field>` keys.
    const body = approved
      ? formBody(
          {
            name,
            email,
            password: details.password,
            terms_accepted: "true",
            [`profile.${NUMBER_FIELD[role]}`]: number,
          },
          details.document,
        )
      : { name, ...(email ? { email } : {}), password: details.password, terms_accepted: true };

    try {
      const response = await this.client.post<AccountStateBody>(path, body, {
        timeoutMs: body instanceof FormData ? UPLOAD_TIMEOUT_MS : undefined,
      });
      return {
        ...toAccountState(response, name),
        awaitingApproval: approved,
        applicationNumber: textOrNull(response.application_number),
      };
    } catch (error) {
      throw translate(error, {
        400: "invalid-details",
        401: "session-expired",
        403: "session-expired",
        409: "already-registered",
      });
    }
  }

  async getRejectedRegistration(): Promise<RejectedRegistration> {
    let body: RejectedRegistrationBody;
    try {
      body = await this.client.get<RejectedRegistrationBody>("registrations/current");
    } catch (error) {
      throw translate(error, { 401: "session-expired", 403: "session-expired", 409: "nothing-to-resubmit" });
    }

    const role: ApprovedRole | null =
      body?.role === "ADVOCATE" ? "advocate" : body?.role === "CLERK" ? "advocateClerk" : null;
    if (!role) {
      throw new AuthError("unavailable", { message: "Unexpected registration response." });
    }
    return {
      role,
      mobile: toNational(text(body.mobile_number)),
      name: text(body.name),
      email: text(body.email),
      registrationNumber: text(body.registration_number),
      documentName: textOrNull(body.document?.file_name),
      officerMessage: text(body.officer_message),
      rejectedAt: textOrNull(body.rejected_at),
      applicationNumber: textOrNull(body.application_number),
      flagged: [],
    };
  }

  async resubmitRegistration(
    details: ResubmissionDetails,
  ): Promise<{ applicationNumber: string | null }> {
    const name = details.name.trim();
    const email = details.email?.trim() || undefined;
    const registrationNumber = details.registrationNumber.trim();
    // Multipart: a fresh bar ID document is required with every resubmission.
    const body = formBody({ name, email, registration_number: registrationNumber }, details.document);

    try {
      const response = await this.client.post<{ application_number?: unknown }>(
        "registrations/current/resubmit",
        body,
        { timeoutMs: UPLOAD_TIMEOUT_MS },
      );
      return { applicationNumber: textOrNull(response?.application_number) };
    } catch (error) {
      throw translate(error, {
        400: "invalid-details",
        401: "session-expired",
        403: "session-expired",
        409: "nothing-to-resubmit",
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
