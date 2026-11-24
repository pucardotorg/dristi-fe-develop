/**
 * Aadhaar e-sign for a case filing, end to end, as two calls the screens make:
 *
 *   - `beginCaseEsign`, on "Aadhaar OTP": reads the open signing package for the latest
 *     copy (`currentFileId`, which changes after every signature), picks the signed-in
 *     person's next box, and asks the backend to open a signing attempt. The screen then
 *     posts the returned form to C-DAC.
 *   - `finishCaseEsign`, on the landing route C-DAC's result returns to: waits for the
 *     attempt to settle, records the signature on the case, and says which draft to go
 *     back to.
 *
 * The landing route is told only the transaction. The participant is found again the same
 * way it was chosen (`nextSignature`), and the draft by the case id the transaction names.
 */

import { isApiError } from "@/lib/api";
import { getRepository as getEsignRepository } from "@/lib/esign/data";
import {
  isSettled,
  MAX_POLLS,
  pollDelayMs,
  providerForm,
  type ProviderForm,
} from "@/lib/esign/esign-flow";
import type { EsignTransaction } from "@/lib/esign/types";

import { getCaseFilingRepository, getRepository } from "./data";
import {
  mySignatories,
  nextSignature,
  signingFailure,
  type SigningFailure,
} from "./signing-package";
import type { FilingDraft, SigningPackage, UserProfile } from "./types";

/** `module` the backend records the attempt under. */
export const ESIGN_MODULE = "esign";

/** "The case is not a draft in progress": it is frozen for signing already. */
const E_NOT_A_DRAFT = "E07004";

/**
 * Get the case ready to sign, on "Continue to sign" once it has passed validation: an
 * open package is used as it is; otherwise the case is frozen for signing and the copy
 * everyone signs is prepared. Freezing a case that is frozen already (a package never got
 * prepared, say) is refused with E07004, which is fine here: the copy is prepared anyway.
 */
export async function prepareCaseForSigning(caseId: string): Promise<SigningPackage> {
  const cases = getCaseFilingRepository();
  const open = await cases.getSigningPackage(caseId);
  if (open) return open;
  try {
    await cases.submitForSigning(caseId);
  } catch (error) {
    if (!(isApiError(error) && error.hasCode(E_NOT_A_DRAFT))) throw error;
  }
  return cases.prepareSigningPackage(caseId);
}

export type EsignStart =
  | { kind: "redirect"; form: ProviderForm }
  /** The case has no open signing package: it was returned to draft, or never prepared. */
  | { kind: "no-package" }
  /** The signed-in person signs as nobody on the package (an advocate, today). */
  | { kind: "not-a-signer" }
  /** Every box of theirs is already signed. */
  | { kind: "already-signed" }
  /** The backend's provider address could not be trusted with the form. */
  | { kind: "bad-provider" };

/** Open a signing attempt for the signed-in person's next box on this case. */
export async function beginCaseEsign(
  caseId: string,
  draft: FilingDraft,
  profile: UserProfile | null,
): Promise<EsignStart> {
  const pkg = await getCaseFilingRepository().getSigningPackage(caseId);
  if (!pkg) return { kind: "no-package" };
  const next = nextSignature(pkg, draft, profile);
  if (!next) {
    return mySignatories(pkg, draft, profile).length > 0
      ? { kind: "already-signed" }
      : { kind: "not-a-signer" };
  }
  const { placeholder } = next;
  const request = await getEsignRepository().startSigning({
    module: ESIGN_MODULE,
    entityType: "CASE_FILING",
    entityId: caseId,
    fileId: pkg.currentFileId,
    // The backend computed the box; it goes back unchanged, without the participant id
    // (the e-sign placeholder takes placement keys only).
    placeholder: {
      page: placeholder.page,
      x: placeholder.x,
      y: placeholder.y,
      width: placeholder.width,
      height: placeholder.height,
      reason: placeholder.reason,
      signerName: placeholder.signerName,
    },
    // The court's backend id is not known to the app yet; the backend accepts none.
    organizationId: null,
  });
  const form = providerForm(request);
  return form ? { kind: "redirect", form } : { kind: "bad-provider" };
}

export type EsignFinish =
  | { kind: "signed"; draftId: string | null }
  | {
      kind: "failed";
      draftId: string | null;
      /** The attempt failed at C-DAC, ran out of time, or could not be recorded on the case. */
      reason: "declined" | "expired" | "not-recorded";
      failure?: SigningFailure;
    }
  /** Still not settled after waiting: the person can look again later. */
  | { kind: "pending"; draftId: string | null };

/** The local draft for a case, if this browser holds one. */
async function draftForCase(caseId: string): Promise<FilingDraft | null> {
  if (!caseId) return null;
  const drafts = await getRepository().listDrafts();
  return drafts.find((d) => d.caseId === caseId) ?? null;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/** Ask for the attempt until it settles, or give up after `MAX_POLLS`. */
async function settledTransaction(
  transactionId: string,
  signal: AbortSignal,
): Promise<EsignTransaction> {
  const esign = getEsignRepository();
  let latest = await esign.getTransaction(transactionId, signal);
  for (let n = 0; !isSettled(latest.status) && n < MAX_POLLS; n += 1) {
    await wait(pollDelayMs(n), signal);
    latest = await esign.getTransaction(transactionId, signal);
  }
  return latest;
}

/**
 * Finish the attempt the browser came back from: wait for its outcome and, when it
 * succeeded, record the signature for the participant whose box was signed.
 */
export async function finishCaseEsign(
  transactionId: string,
  profile: UserProfile | null,
  signal: AbortSignal,
): Promise<EsignFinish> {
  const transaction = await settledTransaction(transactionId, signal);
  const caseId = transaction.entityId;
  const draft = await draftForCase(caseId);
  const draftId = draft?.id ?? null;

  if (transaction.status === "FAILURE") return { kind: "failed", draftId, reason: "declined" };
  if (transaction.status === "EXPIRED") return { kind: "failed", draftId, reason: "expired" };
  if (transaction.status !== "SUCCESS" || !transaction.signedFileId) {
    return { kind: "pending", draftId };
  }

  const cases = getCaseFilingRepository();
  const pkg = await cases.getSigningPackage(caseId, signal);
  // Recorded already (the page was reloaded): the signed copy is the current one.
  if (pkg?.currentFileId === transaction.signedFileId) return { kind: "signed", draftId };
  const signer = pkg && draft ? (nextSignature(pkg, draft, profile)?.signatory ?? null) : null;
  // Without the draft, the only safe guess is a package with one signature left.
  const unsigned = pkg?.signatories.filter((s) => !s.hasSigned) ?? [];
  const participantId =
    signer?.caseParticipantId ?? (unsigned.length === 1 ? unsigned[0].caseParticipantId : null);
  if (!participantId) return { kind: "failed", draftId, reason: "not-recorded" };

  try {
    await cases.recordSignature(caseId, participantId, transaction.signedFileId);
  } catch (error) {
    return { kind: "failed", draftId, reason: "not-recorded", failure: signingFailure(error) };
  }
  return { kind: "signed", draftId };
}
