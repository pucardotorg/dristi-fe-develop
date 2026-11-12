/**
 * What to tell the filer when the backend refuses one of a party's contacts.
 *
 * The backend names the item it refused (`mobile_numbers.1`, `addresses.0.police_station`,
 * `institution_contacts.addresses.0.pincode`) and why (its code). The form shows these
 * as rows, so the message names the row in the form's words rather than the field's; the
 * words are in `../content.ts`. Anything not recognised here falls back to the backend's
 * own message.
 */

import type { ApiError } from "@/lib/api";

import { partyFieldCopy as copy } from "../content";

/** The contact was given more than once in its list. */
const E_DUPLICATE_CONTACT = "E07033";
/** The field does not apply to this participant — the form sent it in error. */
const E_FIELD_NOT_APPLICABLE = "E07023";

/** "" for the first item, which reads as just "the mobile number"; "second " and so on after. */
function nth(index: number | undefined): string {
  if (index === undefined) return "";
  return copy.ordinals[index] ?? copy.nthAfterFifth(index + 1);
}

/** `[institution(_contacts).](mobile_numbers|email_addresses|addresses)[.index][.part]` */
const CONTACT_FIELD = new RegExp(
  "^(?:(institution|institution_contacts)\\.)?" +
    "(mobile_numbers|email_addresses|addresses)(?:\\.(\\d+))?(?:\\.(\\w+))?$"
);

function contactMessage(field: string, codes: readonly string[]): string | undefined {
  const match = CONTACT_FIELD.exec(field);
  if (!match || codes.includes(E_FIELD_NOT_APPLICABLE)) return undefined;
  const [, owner, list, at, part] = match;
  const company = !!owner;
  const whose = company ? copy.companyWhose : copy.whose;
  const index = at === undefined ? undefined : Number(at);

  if (list === "addresses") {
    if (index === undefined) return company ? copy.companyAddressMissing : copy.addressMissing;
    const label = part ? copy.addressParts[part] : undefined;
    return label
      ? copy.addressPartMissing(label, whose, nth(index))
      : copy.addressInvalid(whose, nth(index));
  }

  if (codes.includes(E_DUPLICATE_CONTACT)) {
    if (list === "email_addresses") return copy.repeated(company ? copy.companyEmail : copy.email);
    return copy.repeated(company ? copy.companyPhone : copy.mobile);
  }
  if (list === "email_addresses") return copy.emailInvalid(whose, nth(index));
  return company ? copy.companyPhoneInvalid(nth(index)) : copy.mobileInvalid(nth(index));
}

const FIELD_MESSAGES: Record<string, string> = {
  contact_details_unknown_declared: copy.contactUnknownWithContact,
  institution_id: copy.companyNotOnCase,
  institution_contacts: copy.companyContactsNotSaved,
};

/** The form's message for the first party field the backend refused, if it is one we know. */
export function partyFieldMessage(error: ApiError): string | undefined {
  for (const field of Object.keys(error.fieldErrors)) {
    const message =
      contactMessage(field, error.fieldCodes[field] ?? []) ?? FIELD_MESSAGES[field];
    if (message) return message;
  }
  return undefined;
}
