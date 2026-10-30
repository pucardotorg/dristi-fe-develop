/**
 * Stand-in registers the backend does not answer yet.
 *
 * Advocates are found through the backend (`searchAdvocates` in `data/cases-api.ts`);
 * `RegisteredAdvocate` remains as the shape of a bar-council entry the employee approval
 * screen compares a claim against.
 */

export type RegisteredAdvocate = {
  barNumber: string;
  name: string;
  /** Where they are enrolled — shown to tell two similar numbers apart. */
  bar: string;
};

/* ───────────────────────────── ON Court register ───────────────────── */

/**
 * What a returning litigant already has on file. The real service
 * answers this from the court's own records once the number is verified by OTP.
 *
 * ENGINEERING SEAM — replace `fetchOnCourtRecord` with that call. Verification and the
 * fetch are one step on purpose; do not split them, because the OTP is what authorises
 * reading someone's saved address back onto a screen.
 */
export type OnCourtRecord = {
  name: string;
  email: string;
  age: string;
  address: {
    line1: string;
    city: string;
    pin: string;
    district: string;
    state: string;
  };
};

const ON_COURT: Record<string, OnCourtRecord> = {
  "9847012345": {
    name: "Prateek Sharma",
    email: "prateek.sharma@example.com",
    age: "47",
    address: {
      line1: "14/337, Cantonment Road, Vadakkevila",
      city: "Sample District",
      pin: "691010",
      district: "Sample District",
      state: "Kerala",
    },
  },
  "9995566778": {
    name: "Lakshmi Gopinath",
    email: "lakshmi.g@example.com",
    age: "39",
    address: {
      line1: "Sreyas, TC 22/1180, Beach Road",
      city: "Sample District",
      pin: "691001",
      district: "Sample District",
      state: "Kerala",
    },
  },
};

/** `null` when the number is not on the register — the common case, and not an error. */
export async function fetchOnCourtRecord(mobile: string): Promise<OnCourtRecord | null> {
  const key = mobile.replace(/\D/g, "").slice(-10);
  return ON_COURT[key] ?? null;
}
