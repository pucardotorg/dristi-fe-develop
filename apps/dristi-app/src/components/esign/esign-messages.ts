import type { useTranslations } from "next-intl";

import type { EsignStart } from "@/lib/filing/case-esign";
import type { SigningFailure } from "@/lib/filing/signing-package";

type Translate = ReturnType<typeof useTranslations>;

/** Why Aadhaar e-sign could not start or finish, as one thing to tell the person. */
export type EsignProblem =
  Exclude<EsignStart["kind"], "redirect"> | SigningFailure | "not-connected";

/**
 * The sentence for each problem. A 403 from the e-sign service does not say why (not a
 * signer, already signed, or someone else signing), so it reads as "not right now" rather
 * than guessing which.
 */
export function esignProblemMessage(t: Translate, problem: EsignProblem): string {
  switch (problem) {
    case "not-a-signer":
      return t("esign_onlyComplainantsSign");
    case "already-signed":
      return t("esign_alreadySigned");
    case "no-package":
      return t("esign_notReadyToSign");
    case "bad-provider":
      return t("esign_couldNotOpen");
    case "not-permitted":
      return t("esign_notPermittedNow");
    case "in-progress":
      return t("esign_someoneElseSigning");
    case "stale-copy":
      return t("esign_complaintChanged");
    case "unavailable":
      return t("esign_unavailable");
    case "session-ended":
      return t("esign_sessionEnded");
    case "unreachable":
      return t("esign_unreachable");
    case "not-connected":
      return t("esign_notConnected");
    case "other":
      return t("esign_couldNotStart");
  }
}
