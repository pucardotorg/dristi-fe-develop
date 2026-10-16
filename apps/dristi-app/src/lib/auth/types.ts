/**
 * The auth contract the screens speak — independent of whether the backend or the
 * sandbox answers. Backend field names (`user_id`, `registration_status`) stop at
 * `http.ts`; everything above it sees these types.
 */

/**
 * Why a code is being sent. The backend keeps the two apart: a code issued to register
 * cannot sign anyone in, and the other way round.
 */
export type OtpPurpose = "register" | "login";

/** The account types the backend knows (dristi-be `Role`). */
export type BackendRole = "LITIGANT" | "POWER_OF_ATTORNEY" | "ADVOCATE" | "CLERK";

/** `PENDING_PROFILE`: the number is verified but registration is unfinished. */
export type RegistrationStatus = "PENDING_PROFILE" | "COMPLETE";

/** What every successful auth call reports about the signed-in account. */
export type AccountState = {
  userId: string;
  registrationStatus: RegistrationStatus;
  /**
   * Where the person goes next, decided by the backend: `"profile"` means finish
   * registration; `null` means the account is ready. Kept as a string because the
   * backend plans more values (terms re-acceptance); unknown values route like
   * `"profile"` — to the screen that can finish an account, never past it.
   */
  next: string | null;
  /** Not every response carries it — `POST /sessions` does not (yet). */
  role: BackendRole | null;
  /** Known only when this visit told us (registration) or the sandbox knows it. */
  name: string | null;
};

/** The roles offered on the registration screen. */
export type RegistrationRole = "litigant" | "poa" | "advocate" | "advocateClerk";

/** What the final registration step submits. */
export type RegistrationDetails = {
  name: string;
  /** Optional on the form; omitted when blank. */
  email?: string;
  password: string;
};

/** A national (10-digit) mobile number plus exactly one credential. */
export type Credentials =
  | { mobile: string; otp: string }
  | { mobile: string; password: string };
