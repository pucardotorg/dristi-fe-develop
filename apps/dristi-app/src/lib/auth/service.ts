/**
 * The auth seam. Screens call these five operations and nothing else; `index.ts`
 * decides whether the backend (`http.ts`) or the in-browser sandbox (`sandbox.ts`)
 * answers. Every failure is an `AuthError` (`errors.ts`).
 *
 * Mobile numbers are the 10 national digits the screens collect; implementations add
 * the country code themselves.
 */

import type {
  AccountState,
  CurrentAccount,
  Credentials,
  OtpPurpose,
  RegistrationDetails,
  RegistrationOutcome,
  RegistrationRole,
  RejectedRegistration,
  ResubmissionDetails,
} from "./types";

export interface AuthService {
  /** Send a one-time code. Resolves even for unknown numbers — that is the point. */
  requestOtp(mobile: string, purpose: OtpPurpose): Promise<void>;

  /**
   * Prove a number during registration. Creates the account (or resumes an unfinished
   * one) and starts a session for it; the profile is still to come.
   */
  verifyRegistrationOtp(mobile: string, otp: string): Promise<AccountState>;

  /** Sign in with a one-time code or a password. */
  signIn(credentials: Credentials): Promise<AccountState>;

  /**
   * The signed-in account's role and name. Resolves `null` — never rejects — when it
   * cannot say (the endpoint is not deployed yet, the server is unreachable), so a
   * caller can always fall back to what sign-in returned.
   */
  getCurrentAccount(): Promise<CurrentAccount | null>;

  /**
   * Finish registration for the verified number in the current session. Advocates and
   * clerks come back `awaitingApproval`, already signed out.
   */
  completeRegistration(
    role: RegistrationRole,
    details: RegistrationDetails,
  ): Promise<RegistrationOutcome>;

  /** The signed-in account's rejected registration, to pre-fill the correction. */
  getRejectedRegistration(): Promise<RejectedRegistration>;

  /** Send the corrected registration back for approval. Ends the session. */
  resubmitRegistration(
    details: ResubmissionDetails,
  ): Promise<{ applicationNumber: string | null }>;

  /** End the session. Safe to call when already signed out. */
  signOut(): Promise<void>;
}
