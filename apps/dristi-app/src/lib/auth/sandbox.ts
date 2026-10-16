/**
 * The auth seam without a backend — for demos and design-review deployments
 * (`NEXT_PUBLIC_AUTH_SOURCE=sandbox`). Nothing leaves the browser and nothing persists.
 *
 * It answers the way the backend does, so the screens are exercised exactly as they
 * will be in production: unknown numbers fail sign-in with the same vague
 * `invalid-credentials`, a registered number cannot register again, and any 6-digit
 * code is accepted (there is no SMS to read it from).
 *
 * Two demo logins:
 *   7007663437 — a litigant (Rajan K. Nair).
 *   8009460966 — an advocate (Adv. Anjali Nair) who also holds a litigant profile.
 * Any password works for them.
 */

import { AuthError } from "./errors";
import type { AuthService } from "./service";
import type {
  AccountState,
  BackendRole,
  Credentials,
  RegistrationDetails,
  RegistrationRole,
} from "./types";

const DEMO_ACCOUNTS: Record<string, { role: BackendRole; name: string }> = {
  "7007663437": { role: "LITIGANT", name: "Rajan K. Nair" },
  "8009460966": { role: "ADVOCATE", name: "Anjali Nair" },
};

const ROLE_OF: Record<RegistrationRole, BackendRole> = {
  litigant: "LITIGANT",
  poa: "POWER_OF_ATTORNEY",
  advocate: "ADVOCATE",
  advocateClerk: "CLERK",
};

const CODE = /^\d{6}$/;

export class SandboxAuthService implements AuthService {
  /** The number verified in this visit — the sandbox's stand-in for a session. */
  private verifiedMobile: string | null = null;

  async requestOtp(): Promise<void> {}

  async verifyRegistrationOtp(mobile: string, otp: string): Promise<AccountState> {
    if (!CODE.test(otp)) throw new AuthError("invalid-code");
    if (DEMO_ACCOUNTS[mobile]) throw new AuthError("already-registered");
    this.verifiedMobile = mobile;
    return {
      userId: `sandbox-${mobile}`,
      registrationStatus: "PENDING_PROFILE",
      next: "profile",
      role: null,
      name: null,
    };
  }

  async signIn(credentials: Credentials): Promise<AccountState> {
    const account = DEMO_ACCOUNTS[credentials.mobile];
    const proof = "otp" in credentials ? CODE.test(credentials.otp) : Boolean(credentials.password);
    if (!account || !proof) throw new AuthError("invalid-credentials");
    this.verifiedMobile = credentials.mobile;
    return {
      userId: `sandbox-${credentials.mobile}`,
      registrationStatus: "COMPLETE",
      next: null,
      role: account.role,
      name: account.name,
    };
  }

  async completeRegistration(
    role: RegistrationRole,
    details: RegistrationDetails,
  ): Promise<AccountState> {
    if (!this.verifiedMobile) throw new AuthError("session-expired");
    // Every role completes here, so the advocate and clerk screens stay reviewable.
    return {
      userId: `sandbox-${this.verifiedMobile}`,
      registrationStatus: "COMPLETE",
      next: null,
      role: ROLE_OF[role],
      name: details.name.trim(),
    };
  }

  async signOut(): Promise<void> {
    this.verifiedMobile = null;
  }
}
