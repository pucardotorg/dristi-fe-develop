/**
 * The backend completeness check (`POST /cases/{id}/validate`, dristi-be spec 0021 §6.3)
 * and how its errors map to the filing's steps.
 *
 * Each error names a `field` such as `participants.accused`, `evidence.cheque`,
 * `documents.VAKALATNAMA`, `details.adr_other_prayer`, `participants.<uuid>` or `affidavit`.
 * `stepForValidationField` turns that into the step the filer opens to fix it, so the
 * Preview can link each missing item to where it is entered.
 */

import type { StepId } from "./steps";
import type { FilingDraft } from "./types";

export type ValidationError = { field: string; message: string };

/** The result of `POST /cases/{id}/validate`. */
export type ValidationResult = { isValid: boolean; errors: ValidationError[] };

/**
 * A map from each saved participant's `case_participant_id` to the step it is entered on,
 * built from the ids the party saves recorded on the draft. A per-participant validate error
 * names its id (`participants.<uuid>`), which `stepForValidationField` resolves through this.
 */
export function participantSteps(draft: FilingDraft): Map<string, StepId> {
  const steps = new Map<string, StepId>();
  const add = (ids: string[] | undefined, step: StepId) => {
    for (const id of ids ?? []) steps.set(id, step);
  };
  for (const c of draft.complainants) {
    add(c.caseParticipantIds, "complainant");
    // The backend takes a PoA holder off with its complainant, so it is fixed there too.
    if (c.savedPoaHolder) steps.set(c.savedPoaHolder.participantId, "complainant");
  }
  for (const a of draft.accused) add(a.caseParticipantIds, "accused");
  for (const w of draft.witnesses) add(w.caseParticipantIds, "witnesses");
  return steps;
}

/**
 * The filing step a validate error belongs to, or `null` when it maps to none.
 *
 * A per-participant completeness error names the row as `participants.<uuid>`, which does
 * not say the role. `participantStepById` (from {@link participantSteps}) resolves the id to
 * its step; when the row was saved in another browser and is not on this draft, the role is
 * read from the message ("Witness #1 has no …", "Accused #2 has no name.") instead.
 */
export function stepForValidationField(
  field: string,
  message?: string,
  participantStepById?: Map<string, StepId>,
): StepId | null {
  if (field === "affidavit") return "affidavit";

  const dot = field.indexOf(".");
  const area = dot === -1 ? field : field.slice(0, dot);
  const rest = dot === -1 ? "" : field.slice(dot + 1);

  switch (area) {
    case "participants": {
      if (rest === "accused") return "accused";
      if (rest === "complainants") return "complainant";
      const byId = participantStepById?.get(rest);
      if (byId) return byId;
      if (/^Witness\b/.test(message ?? "")) return "witnesses";
      if (/^Accused\b/.test(message ?? "")) return "accused";
      // A complainant / POA-holder gap, or an advocate / party-in-person gap reported
      // against one complainant — all fixed from the complainant step.
      return "complainant";
    }
    case "representations":
      return "advocate";
    case "evidence":
      // The return memo is entered with the cheque; only the demand notice is its own step.
      return rest.includes("demand_notice") || rest.includes("legal") ? "demand-notice" : "cheque";
    case "documents":
      return "documents";
    case "details":
      return rest === "adr_other_prayer" ? "adr-prayer" : "jurisdiction";
    default:
      return null;
  }
}
