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

/**
 * Court approval of an advocate or clerk registration. Litigants have none (`null`).
 * A `PENDING` account cannot sign in; a `REJECTED` one can, to correct and resubmit.
 */
export type ApprovalStatus = "PENDING" | "ACCEPTED" | "REJECTED";

/** What every successful auth call reports about the signed-in account. */
export type AccountState = {
  userId: string;
  registrationStatus: RegistrationStatus;
  /**
   * Where the person goes next, decided by the backend:
   *   `"profile"`  — finish registration;
   *   `"resubmit"` — a rejected advocate/clerk registration to correct;
   *   `"terms"`    — re-accept updated terms (no screen yet);
   *   `null`       — the account is ready.
   * Kept as a string because the backend may add values.
   */
  next: string | null;
  /** `null` for litigants, and wherever the response does not carry it. */
  approvalStatus: ApprovalStatus | null;
  /** Not every response carries it — `POST /sessions` does not; `GET /users/me` does. */
  role: BackendRole | null;
  /** Known only when this visit told us (registration) or the sandbox knows it. */
  name: string | null;
};

/** Who is signed in, from `GET /users/me/` — the source of role and name after sign-in. */
export type CurrentAccount = {
  /** Always one of the four: a response without a known role is refused, not defaulted. */
  role: BackendRole;
  name: string | null;
  /** National digits, e.g. "9876543210". */
  mobile: string;
  email: string | null;
  /** The advocate profile's Bar registration number; null for every other role. */
  barNumber: string | null;
  /** False when updated terms are waiting to be accepted. */
  hasCurrentTerms: boolean;
};

/** The roles offered on the registration screen. */
export type RegistrationRole = "litigant" | "poa" | "advocate" | "advocateClerk";

/** What the final registration step submits. */
export type RegistrationDetails = {
  name: string;
  /** Optional on the form; omitted when blank. */
  email?: string;
  password: string;
  /** Advocate: the bar registration ID. Clerk: the clerk registration number. */
  registrationNumber?: string;
  /** The Bar Council / clerk ID scan: PDF, JPEG or PNG, at most 10 MB. Required for
   *  advocates and clerks; the backend refuses either without it. */
  document?: File;
};

/** What a finished registration reports. */
export type RegistrationOutcome = AccountState & {
  /**
   * Advocates and clerks wait for court approval, and the backend has already ended
   * their session — they see the awaiting-approval screen, never a home.
   */
  awaitingApproval: boolean;
  /** A number the person can quote at the court. `null` until the backend sends one. */
  applicationNumber: string | null;
};

/** The roles whose registrations the court approves — and can reject. */
export type ApprovedRole = "advocate" | "advocateClerk";

/** A rejected registration, as the correction screens show it. */
export type RejectedRegistration = {
  role: ApprovedRole;
  /** The 10 national digits the person signs in with. Not editable. */
  mobile: string;
  name: string;
  email: string;
  registrationNumber: string;
  /** The file name of the document last submitted, if any. */
  documentName: string | null;
  /** The one message the verifying officer wrote. May be empty. */
  officerMessage: string;
  /** ISO timestamp, when known. */
  rejectedAt: string | null;
  /** A quotable application number; `null` until the backend sends one. */
  applicationNumber: string | null;
  /**
   * Which steps the officer marked. The backend sends no marks (only the message), so
   * this is empty there; the sandbox fills it to keep the design reviewable.
   */
  flagged: RejectedField[];
};

export type RejectedField = "name" | "email" | "regNumber" | "idFile";

/** The corrected claim sent back for approval. Mobile, role, password and terms stand. */
export type ResubmissionDetails = {
  name: string;
  email?: string;
  registrationNumber: string;
  /** A fresh ID scan. Required: the backend keeps nothing from the rejected one. */
  document: File;
};

/** A national (10-digit) mobile number plus exactly one credential. */
export type Credentials =
  | { mobile: string; otp: string }
  | { mobile: string; password: string };
