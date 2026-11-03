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
import type { AdrPrayer, FilingDraft, Jurisdiction } from "./types";

/** A details section body, as the backend's section schema expects it. */
export type DetailsSectionBody = Record<string, string | number | boolean>;

/** Whether rich-text (HTML) editor output has any real content, not just empty markup. */
export function richTextHasContent(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim().length > 0;
}

/**
 * Whether the jurisdiction & limitation section has every field the backend requires.
 * `causeDate` is the effective cause-of-action date (typed, or derived from the notice
 * service date — see `limitationView`), not the raw `jurisdiction.causeDate`.
 */
export function jurisdictionReady(j: Jurisdiction, causeDate: string, filingDate: string): boolean {
  // Both the cause-of-action and complaint filing dates are required by the section.
  if (!causeDate || !filingDate) return false;
  // The police station of the branch that grounds jurisdiction is always required: the
  // payee's when they deposited the cheque, otherwise the drawer's.
  const policeStation = j.deposited === "yes" ? j.payeePolice : j.drawerPolice;
  if (!policeStation.trim()) return false;
  // When the payee deposited the cheque, jurisdiction follows their collecting branch, so
  // its bank details are required too.
  if (j.deposited === "yes") {
    return (
      IFSC_PATTERN.test(j.ifsc.trim().toUpperCase()) &&
      !!j.payeeBankName.trim() &&
      !!j.payeeBankBranch.trim()
    );
  }
  return true;
}

/**
 * Build the `jurisdiction_limitation` section body, or `null` when it is not complete.
 *
 * The police station is split by whose branch grounds jurisdiction: the payee's collecting
 * branch when they deposited the cheque (sent with their bank details), otherwise the
 * drawer's. The condonation reason is sent only when the complaint is filed late, since that
 * is the only time the backend's completeness check requires it. The other-pending
 * complaints' court/case numbers still have no home in the schema, so they are not sent (see
 * the jurisdiction integration tracker).
 */
export function jurisdictionSectionBody(
  j: Jurisdiction,
  causeDate: string,
  filingDate: string,
  late: boolean,
): DetailsSectionBody | null {
  if (!jurisdictionReady(j, causeDate, filingDate)) return null;
  const deposited = j.deposited === "yes";
  const body: DetailsSectionBody = {
    cheque_deposited_by_payee: deposited,
    other_complaints_pending: j.otherPending === "yes",
    cause_of_action_date: causeDate,
    complaint_filing_date: filingDate,
  };
  if (deposited) {
    body.payee_ifsc_code = j.ifsc.trim().toUpperCase();
    body.payee_bank_name = j.payeeBankName.trim();
    body.payee_bank_branch = j.payeeBankBranch.trim();
    body.payee_bank_police_station = j.payeePolice.trim();
  } else {
    body.drawer_bank_police_station = j.drawerPolice.trim();
  }
  if (late && j.condonationReason.trim()) body.condonation_reason = j.condonationReason.trim();
  return body;
}

/** The jurisdiction section body for a draft, resolving the effective cause-of-action date. */
export function jurisdictionDetails(draft: FilingDraft): DetailsSectionBody | null {
  const limitation = limitationView(draft);
  return jurisdictionSectionBody(
    draft.jurisdiction,
    limitation.causeDate,
    limitation.filingDate,
    limitation.overBy > 0,
  );
}

/** Whether the ADR/prayer section has the one field the backend requires: a final relief. */
export function adrPrayerReady(a: AdrPrayer): boolean {
  return richTextHasContent(a.finalRelief);
}

/**
 * Build the `adr_other_prayer` section body, or `null` when the final relief is empty.
 *
 * `adr_preference` is an optional `YES` / `NO` enum on the backend; it no longer accepts
 * `MAYBE`, so a "maybe" choice is omitted until the design and backend reconcile (the design
 * still offers Maybe — see the integration tracker). The optional rich-text fields are sent
 * only when they have content; `other_details`, `interim_relief` and `final_relief` are
 * stored as sent and must be sanitised wherever they are rendered.
 */
export function adrPrayerSectionBody(a: AdrPrayer): DetailsSectionBody | null {
  if (!adrPrayerReady(a)) return null;
  const body: DetailsSectionBody = {
    final_relief: a.finalRelief,
  };
  if (a.adr === "yes" || a.adr === "no") body.adr_preference = a.adr.toUpperCase();
  if (richTextHasContent(a.otherDetails)) body.other_details = a.otherDetails;
  if (richTextHasContent(a.interimRelief)) body.interim_relief = a.interimRelief;
  return body;
}

/** The ADR/prayer section body for a draft. */
export function adrPrayerDetails(draft: FilingDraft): DetailsSectionBody | null {
  return adrPrayerSectionBody(draft.adr);
}
