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

export type ValidationError = { field: string; message: string };

/** The result of `POST /cases/{id}/validate`. */
export type ValidationResult = { isValid: boolean; errors: ValidationError[] };

/**
 * The filing step a validate error belongs to, or `null` when it maps to none.
 *
 * A per-participant completeness error names the row as `participants.<uuid>`, which does
 * not say the role, so the witness/accused cases read it from the message
 * ("Witness #1 has no …", "Accused #2 has no name."). Pass the error's `message` for those.
 */
export function stepForValidationField(field: string, message?: string): StepId | null {
  if (field === "affidavit") return "affidavit";

  const dot = field.indexOf(".");
  const area = dot === -1 ? field : field.slice(0, dot);
  const rest = dot === -1 ? "" : field.slice(dot + 1);

  switch (area) {
    case "participants": {
      if (rest === "accused") return "accused";
      if (/^Witness\b/.test(message ?? "")) return "witnesses";
      if (/^Accused\b/.test(message ?? "")) return "accused";
      // `participants.complainants`, a complainant / POA-holder gap, or an advocate /
      // party-in-person gap reported against one complainant — all fixed from the
      // complainant step.
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
