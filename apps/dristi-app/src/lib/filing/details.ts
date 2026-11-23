/**
 * Turning the local draft into the backend's case-details sections (dristi-be spec 0021
 * §5.3), and deciding when a section is complete enough to save.
 *
 * Case details are "sections": a whole section object is PUT to
 * `/cases/{id}/details/{section}` and replaces what was stored, so saving is idempotent and
 * needs no per-row id (unlike evidence). The backend accepts a partly filled section — on
 * save it drops the required-field rules and strips empty values — so each builder sends
 * only the fields that are filled and well-formed, and returns `null` only when nothing
 * worth saving has been entered yet (so an untouched section is not PUT). Completeness is
 * enforced by `POST /cases/{id}/validate` before signing. These are pure functions; the
 * backend call lives in `data/cases-api.ts`.
 */

import { IFSC_PATTERN } from "./lookups";
import { limitationView } from "./selectors";
import type { AdrPrayer, FilingDraft, Jurisdiction } from "./types";

/** One other pending S.138 complaint between the same parties, as the backend stores it. */
export type OtherComplaintBody = { court: string; case_number: string };

/** A details section body, as the backend's section schema expects it. */
export type DetailsSectionBody = Record<string, string | number | boolean | OtherComplaintBody[]>;

/**
 * The completed other-pending complaints to send, each trimmed. A complaint counts only when
 * both its court and case number are filled; the backend requires at least one when
 * `other_complaints_pending` is true, and rejects an empty/whitespace value, so blank rows
 * are left out.
 */
export function otherComplaintsBody(j: Jurisdiction): OtherComplaintBody[] {
  return j.otherCases
    .filter((c) => c.court.trim() && c.caseNumber.trim())
    .map((c) => ({ court: c.court.trim(), case_number: c.caseNumber.trim() }));
}

/** Whether rich-text (HTML) editor output has any real content, not just empty markup. */
export function richTextHasContent(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim().length > 0
  );
}

/**
 * Build the `jurisdiction_limitation` section body, sending only the fields that are filled
 * and well-formed, or `null` when nothing beyond the default toggles has been entered.
 *
 * `causeDate` is the effective cause-of-action date (typed, or derived from the notice
 * service date — see `limitationView`), not the raw `jurisdiction.causeDate`. The police
 * station is split by whose branch grounds jurisdiction: the payee's collecting branch when
 * they deposited the cheque (sent with their bank details), otherwise the drawer's. When
 * another complaint is pending, each complete one's court and case number is sent in
 * `other_complaints` (never an empty array, which the backend's `minItems` would reject).
 * The condonation reason is sent whenever it is written; the backend requires it only for a
 * late filing, which `validate` checks before signing.
 */
export function jurisdictionSectionBody(
  j: Jurisdiction,
  causeDate: string,
  filingDate: string,
): DetailsSectionBody | null {
  const deposited = j.deposited === "yes";
  const pending = j.otherPending === "yes";
  const complaints = otherComplaintsBody(j);
  const body: DetailsSectionBody = {
    cheque_deposited_by_payee: deposited,
    other_complaints_pending: pending,
  };
  if (causeDate) body.cause_of_action_date = causeDate;
  if (filingDate) body.complaint_filing_date = filingDate;
  if (deposited) {
    const ifsc = j.ifsc.trim().toUpperCase();
    if (IFSC_PATTERN.test(ifsc)) body.payee_ifsc_code = ifsc;
    if (j.payeeBankName.trim()) body.payee_bank_name = j.payeeBankName.trim();
    if (j.payeeBankBranch.trim()) body.payee_bank_branch = j.payeeBankBranch.trim();
    if (j.payeePolice.trim()) body.payee_bank_police_station = j.payeePolice.trim();
  } else if (j.drawerPolice.trim()) {
    body.drawer_bank_police_station = j.drawerPolice.trim();
  }
  if (pending && complaints.length) body.other_complaints = complaints;
  if (j.condonationReason.trim()) body.condonation_reason = j.condonationReason.trim();
  // Only the default toggles were set: leave the section unsaved until something is filled.
  return Object.keys(body).length > 2 ? body : null;
}

/** The jurisdiction section body for a draft, resolving the effective cause-of-action date. */
export function jurisdictionDetails(draft: FilingDraft): DetailsSectionBody | null {
  const limitation = limitationView(draft);
  return jurisdictionSectionBody(draft.jurisdiction, limitation.causeDate, limitation.filingDate);
}

/**
 * Build the `adr_other_prayer` section body, sending only what is filled, or `null` when
 * nothing has been chosen or written (just the default `yes` ADR preference).
 *
 * `adr_preference` is an optional `YES` / `NO` / `MAYBE` enum on the backend; the design's
 * three choices map one-to-one, so the chosen one is uppercased. The rich-text fields are
 * sent only when they have real content; `other_details`, `interim_relief` and
 * `final_relief` are stored as sent and must be sanitised wherever they are rendered.
 */
export function adrPrayerSectionBody(a: AdrPrayer): DetailsSectionBody | null {
  const body: DetailsSectionBody = { adr_preference: a.adr.toUpperCase() };
  if (richTextHasContent(a.finalRelief)) body.final_relief = a.finalRelief;
  if (richTextHasContent(a.otherDetails)) body.other_details = a.otherDetails;
  if (richTextHasContent(a.interimRelief)) body.interim_relief = a.interimRelief;
  // Nothing written and the preference left at its default: leave the section unsaved.
  if (Object.keys(body).length === 1 && a.adr === "yes") return null;
  return body;
}

/** The ADR/prayer section body for a draft. */
export function adrPrayerDetails(draft: FilingDraft): DetailsSectionBody | null {
  return adrPrayerSectionBody(draft.adr);
}
