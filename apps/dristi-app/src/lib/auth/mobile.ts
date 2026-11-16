/**
 * Indian mobile numbers, as the screens collect them and as the backend stores them.
 *
 * Screens hold the 10 national digits; the backend wants `+91` followed by a number
 * starting 6–9 (dristi-be `mobile_number_validator`). Checking the leading digit here
 * means a mistyped first digit is caught on the field, not after a round trip.
 */

const NATIONAL = /^[6-9]\d{9}$/;

/** True for a 10-digit number that can be an Indian mobile. */
export function isIndianMobile(national: string): boolean {
  return NATIONAL.test(national);
}

/** `"9876543210"` → `"+919876543210"`. */
export function toBackendMobile(national: string): string {
  return `+91${national}`;
}

/**
 * The 10 national digits of a number however it was typed or stored: `"+91 98765 43210"`,
 * `"919876543210"`, `"+919876543210"` and `"09876543210"` all give `"9876543210"`.
 * Anything longer is cut to ten, so a field fed through it never overflows.
 */
export function toNationalMobile(value: string): string {
  let digits = value.replace(/\D/g, "");
  // The country code, written with its "+" or stored as the first two of twelve digits.
  if (/^\s*\+\s*91/.test(value) || (digits.length === 12 && digits.startsWith("91"))) {
    digits = digits.slice(2);
  }
  // The trunk 0 dialled before a number from inside India; no national number starts with one.
  return digits.replace(/^0+/, "").slice(0, 10);
}
