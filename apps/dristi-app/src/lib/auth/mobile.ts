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
