/**
 * The auth seam without a backend — for demos and design-review deployments
 * (`NEXT_PUBLIC_AUTH_SOURCE=sandbox`). Nothing leaves the browser and nothing persists.
 *
 * It answers the way the backend does, so the screens are exercised exactly as they
 * will be in production: unknown numbers fail sign-in with the same vague
 * `invalid-credentials`, a registered number cannot register again, advocates and clerks
 * end awaiting approval, and any 6-digit code is accepted (there is no SMS to read).
 *
 * Demo logins (any password or 6-digit code):
 *   7007663437 — a litigant (Rajan K. Nair).
 *   8009460966 — an approved advocate (Adv. Anjali Nair).
 *   8888888888 — an advocate whose registration awaits approval.
 *   9999999999 — an advocate whose registration was rejected: signs in to correct it.
 */

import { AuthError } from "./errors";
import type { AuthService } from "./service";
import type {
  AccountState,
  ApprovalStatus,
  CurrentAccount,
  BackendRole,
  Credentials,
  RegistrationDetails,
  RegistrationOutcome,
  RegistrationRole,
  RejectedRegistration,
  ResubmissionDetails,
} from "./types";

type DemoAccount = { role: BackendRole; name: string; approval: ApprovalStatus | null };

const DEMO_ACCOUNTS: Record<string, DemoAccount> = {
  "7007663437": { role: "LITIGANT", name: "Rajan K. Nair", approval: null },
  "8009460966": { role: "ADVOCATE", name: "Anjali Nair", approval: "ACCEPTED" },
  "8888888888": { role: "ADVOCATE", name: "Arun Thomas", approval: "PENDING" },
  "9999999999": { role: "ADVOCATE", name: "Sreelakshmi Menonn", approval: "REJECTED" },
};

/**
 * The rejected demo (PM, Sept 3). The officer marked the name (it does not match the
 * Bar record — note the deliberate "Menonn") and the ID scan (unreadable); the number
 * and Bar registration number were fine.
 */
const DEMO_REJECTION: RejectedRegistration = {
  role: "advocate",
  mobile: "9999999999",
  name: "Sreelakshmi Menonn",
  email: "sreelakshmi.menon@gmail.com",
  registrationNumber: "K/1742/2019",
  documentName: "bar-council-id.jpg",
  officerMessage:
    "The name entered does not match the Bar Council record for K/1742/2019: the enrolment register holds the surname as Menon, not as entered. The Bar Council ID uploaded is also not readable; the registration number and photograph cannot be made out from the scan, so the document cannot be verified against the register. Correct the name to match the Bar Council record exactly, upload a clear and complete scan of the Bar Council ID with the registration number visible, and resubmit the registration for approval.",
  rejectedAt: null,
  applicationNumber: "ADV-2026-483920",
  flagged: ["name", "idFile"],
};

const ROLE_OF: Record<RegistrationRole, BackendRole> = {
  litigant: "LITIGANT",
  poa: "POWER_OF_ATTORNEY",
  advocate: "ADVOCATE",
  advocateClerk: "CLERK",
};

const CODE = /^\d{6}$/;

/** A plausible application number, so the awaiting-approval design stays reviewable. */
function demoApplicationNumber(role: RegistrationRole): string {
  const serial = String(Math.floor(Math.random() * 900000) + 100000);
  return `${role === "advocateClerk" ? "CLK" : "ADV"}-${new Date().getFullYear()}-${serial}`;
}

export class SandboxAuthService implements AuthService {
  /** The number signed in or verified in this visit — the sandbox's session. */
  private sessionMobile: string | null = null;

  async requestOtp(): Promise<void> {}

  async verifyRegistrationOtp(mobile: string, otp: string): Promise<AccountState> {
    if (!CODE.test(otp)) throw new AuthError("invalid-code");
    if (DEMO_ACCOUNTS[mobile]) throw new AuthError("already-registered");
    this.sessionMobile = mobile;
    return {
      userId: `sandbox-${mobile}`,
      registrationStatus: "PENDING_PROFILE",
      next: "profile",
      approvalStatus: null,
      role: null,
      name: null,
    };
  }

  async signIn(credentials: Credentials): Promise<AccountState> {
    const account = DEMO_ACCOUNTS[credentials.mobile];
    const proof = "otp" in credentials ? CODE.test(credentials.otp) : Boolean(credentials.password);
    if (!account || !proof) throw new AuthError("invalid-credentials");
    if (account.approval === "PENDING") throw new AuthError("approval-pending");
    this.sessionMobile = credentials.mobile;
    return {
      userId: `sandbox-${credentials.mobile}`,
      registrationStatus: "COMPLETE",
      next: account.approval === "REJECTED" ? "resubmit" : null,
      approvalStatus: account.approval,
      role: account.role,
      name: account.name,
    };
  }

  async getCurrentAccount(): Promise<CurrentAccount> {
    const account = this.sessionMobile ? DEMO_ACCOUNTS[this.sessionMobile] : undefined;
    if (!account) throw new AuthError("session-expired");
    return { role: account.role, name: account.name, hasCurrentTerms: true };
  }

  async completeRegistration(
    role: RegistrationRole,
    details: RegistrationDetails,
  ): Promise<RegistrationOutcome> {
    if (!this.sessionMobile) throw new AuthError("session-expired");
    const awaitingApproval = role === "advocate" || role === "advocateClerk";
    // Like the backend: advocates and clerks must send the bar ID document.
    if (awaitingApproval && !details.document) {
      throw new AuthError("invalid-details", {
        fieldErrors: { bar_id_document: ["No file was submitted."] },
      });
    }
    const outcome: RegistrationOutcome = {
      userId: `sandbox-${this.sessionMobile}`,
      registrationStatus: "COMPLETE",
      next: null,
      approvalStatus: awaitingApproval ? "PENDING" : null,
      role: ROLE_OF[role],
      name: details.name.trim(),
      awaitingApproval,
      applicationNumber: awaitingApproval ? demoApplicationNumber(role) : null,
    };
    // Like the backend: a pending account holds no session.
    if (awaitingApproval) this.sessionMobile = null;
    return outcome;
  }

  async getRejectedRegistration(): Promise<RejectedRegistration> {
    if (!this.sessionMobile) throw new AuthError("session-expired");
    if (this.sessionMobile !== DEMO_REJECTION.mobile) throw new AuthError("nothing-to-resubmit");
    return DEMO_REJECTION;
  }

  async resubmitRegistration(
    details: ResubmissionDetails,
  ): Promise<{ applicationNumber: string | null }> {
    void details;
    if (this.sessionMobile !== DEMO_REJECTION.mobile) throw new AuthError("nothing-to-resubmit");
    this.sessionMobile = null;
    return { applicationNumber: DEMO_REJECTION.applicationNumber };
  }

  async signOut(): Promise<void> {
    this.sessionMobile = null;
  }
}
