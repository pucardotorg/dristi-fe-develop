/**
 * User-facing copy for the e-filing flow's logic in `lib/filing`: what the filer is told when
 * a save to the backend case fails. The filing screens are not translated yet, so these are
 * plain strings.
 */

/** When a save to the backend case fails (see `caseFilingErrorMessage` in `data/cases-api.ts`). */
export const caseFilingCopy = {
  generic: "Something went wrong. Please try again.",
  unreachable: "We couldn't reach the court's server. Check your connection and try again.",
  submitted: "This case has been submitted, so it can no longer be changed.",
  documentTypeNotAccepted: "The court doesn't accept this kind of document for this case.",
  witnessExists: "This person is already a witness for this side.",
  noticeNotOnCase:
    "The demand notice this belongs to is no longer on the case. Save the demand notice step again, then try again.",
  noticeLinkFailed: "This document couldn't be attached to its demand notice. Please try again.",
  sessionEnded: "Your session has ended. Sign in again to keep saving this filing.",
  draftGone: "This draft is no longer on the court's server. Start a new filing to save it.",
  // The same limit the upload screens check before sending (`MAX_UPLOAD_BYTES`).
  fileTooLarge: "This file is too large. Upload a file of up to 15 MB.",
} as const;

/** The jurisdiction & limitation step. */
export const jurisdictionCopy = {
  /** Under the reason field, when Continue is pressed on a late filing without one. */
  condonationMissing:
    "Give a reason for the delay. The complaint is filed after the one-month limit, so the court needs it.",
} as const;

/** Under a mobile number field whose value cannot be an Indian mobile (`mobileIssue`). */
export const mobileFieldCopy = {
  invalid: "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.",
  /** Read into "Add the … to save this to your case." when a party is held back for it. */
  missingLabel: "10-digit mobile number",
} as const;

/** The parts of an address, as the form labels them, by the backend's field name. */
const ADDRESS_PARTS: Record<string, string> = {
  line1: "address line",
  city: "city",
  pincode: "pincode",
  district: "district",
  state: "state",
  police_station: "police station",
};

/**
 * When the backend refuses one of a party's contacts (see `data/party-field-errors.ts`).
 * `whose` is "the " or "the company's "; `nth` is "" for the first item, then "second "
 * and so on, so a single mobile number reads as just "the mobile number".
 */
export const partyFieldCopy = {
  addressMissing: "Add an address to save this to your case.",
  companyAddressMissing: "Add the company's address to save this to your case.",
  addressPartMissing: (part: string, whose: string, nth: string) =>
    `Add the ${part} to ${whose}${nth}address to save this to your case.`,
  addressInvalid: (whose: string, nth: string) => `Check ${whose}${nth}address and try again.`,
  repeated: (kind: string) => `The same ${kind} is entered twice. Remove the repeat.`,
  emailInvalid: (whose: string, nth: string) =>
    `${whose.charAt(0).toUpperCase()}${whose.slice(1)}${nth}email isn't a valid email address.`,
  mobileInvalid: (nth: string) =>
    `The ${nth}mobile number isn't valid. Enter a 10-digit Indian mobile number.`,
  // A company's number may be a landline, so it is a phone number, not a mobile.
  companyPhoneInvalid: (nth: string) =>
    `The company's ${nth}phone number isn't valid. Check it and try again.`,
  contactUnknownWithContact:
    "You declared there is no phone or email for this accused, but one is entered. " +
    "Remove it, or withdraw the declaration.",
  companyNotOnCase:
    "The company this person is summoned for is no longer on the case. Save the accused again.",
  companyContactsNotSaved:
    "The company's phone numbers, emails and addresses couldn't be saved. Try again.",

  addressParts: ADDRESS_PARTS,
  ordinals: ["", "second ", "third ", "fourth ", "fifth "],
  nthAfterFifth: (position: number) => `${position}th `,
  whose: "the ",
  companyWhose: "the company's ",
  mobile: "mobile number",
  companyPhone: "company phone number",
  email: "email",
  companyEmail: "company email",
} as const;
