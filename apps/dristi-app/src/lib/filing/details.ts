/**
 * Turning the local draft into the backend's case-details sections (dristi-be spec 0021
 * §5.3), and deciding when a section is complete enough to save.
 *
 * Case details are "sections": a whole section object is PUT to
 * `/cases/{id}/details/{section}` and replaces what was stored, so saving is idempotent and
 * needs no per-row id (unlike evidence). The backend rejects a section that is missing a
 * required field, so a section is sent only once its `*Ready` check passes; a half-filled
 * one stays the browser's working copy. These are pure functions; the backend call lives in
 * `data/cases-api.ts`.
 */

import { IFSC_PATTERN } from "./lookups";
import { limitationView } from "./selectors";
import type { FilingDraft, Jurisdiction } from "./types";

/** A details section body, as the backend's section schema expects it. */
export type DetailsSectionBody = Record<string, string | number | boolean>;

/**
 * Whether the jurisdiction & limitation section has every field the backend requires.
 * `causeDate` is the effective cause-of-action date (typed, or derived from the notice
 * service date — see `limitationView`), not the raw `jurisdiction.causeDate`.
 */
export function jurisdictionReady(j: Jurisdiction, causeDate: string): boolean {
  if (!causeDate) return false;
  // When the payee deposited the cheque, jurisdiction follows their collecting branch, so
  // its bank details and police station are required.
  if (j.deposited === "yes") {
    return (
      IFSC_PATTERN.test(j.ifsc.trim().toUpperCase()) &&
      !!j.payeeBankName.trim() &&
      !!j.payeeBankBranch.trim() &&
      !!j.payeePolice.trim()
    );
  }
  return true;
}

/**
 * Build the `jurisdiction_limitation` section body, or `null` when it is not complete.
 *
 * The drawer's police station, the other-pending complaints' court/case numbers, the delay
 * condonation reason and the filing date have no home in the schema yet, so they are not
 * sent (see the jurisdiction integration tracker). The filing date is the case's `filed_at`,
 * set at submission.
 */
export function jurisdictionSectionBody(j: Jurisdiction, causeDate: string): DetailsSectionBody | null {
  if (!jurisdictionReady(j, causeDate)) return null;
  const body: DetailsSectionBody = {
    cheque_deposited_by_payee: j.deposited === "yes",
    other_complaints_pending: j.otherPending === "yes",
    cause_of_action_date: causeDate,
  };
  if (j.deposited === "yes") {
    body.payee_ifsc_code = j.ifsc.trim().toUpperCase();
    body.payee_bank_name = j.payeeBankName.trim();
    body.payee_bank_branch = j.payeeBankBranch.trim();
    body.bank_police_station = j.payeePolice.trim();
  }
  return body;
}

/** The jurisdiction section body for a draft, resolving the effective cause-of-action date. */
export function jurisdictionDetails(draft: FilingDraft): DetailsSectionBody | null {
  return jurisdictionSectionBody(draft.jurisdiction, limitationView(draft).causeDate);
}
