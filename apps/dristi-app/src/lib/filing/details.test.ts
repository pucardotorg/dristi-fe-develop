import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankAdr, blankJurisdiction } from "./blank";
import { adrPrayerSectionBody, jurisdictionSectionBody } from "./details";
import type { AdrPrayer, Jurisdiction } from "./types";

/** A complete "payee deposited" jurisdiction, so tests can vary one field at a time. */
function filledJurisdiction(over: Partial<Jurisdiction> = {}): Jurisdiction {
  return {
    ...blankJurisdiction(),
    deposited: "yes",
    ifsc: "hdfc0000512",
    payeeBankName: "HDFC Bank",
    payeeBankBranch: "Kochi",
    payeePolice: "Ernakulam Central",
    otherPending: "no",
    ...over,
  };
}

const CAUSE = "2024-02-21";
const FILING = "2024-03-01";

describe("jurisdictionSectionBody", () => {
  it("builds the full section with the payee's police station when the payee deposited", () => {
    const body = jurisdictionSectionBody(
      filledJurisdiction({
        otherPending: "yes",
        otherCases: [{ court: "Munsiff", caseNumber: "CC/12/2024" }],
      }),
      CAUSE,
      FILING,
    );
    assert.deepEqual(body, {
      cheque_deposited_by_payee: true,
      other_complaints_pending: true,
      cause_of_action_date: CAUSE,
      complaint_filing_date: FILING,
      payee_ifsc_code: "HDFC0000512",
      payee_bank_name: "HDFC Bank",
      payee_bank_branch: "Kochi",
      payee_bank_police_station: "Ernakulam Central",
      other_complaints: [{ court: "Munsiff", case_number: "CC/12/2024" }],
    });
  });

  it("omits other_complaints when none is pending, or when a pending one has no complete row", () => {
    const notPending = jurisdictionSectionBody(
      filledJurisdiction({ otherPending: "no" }),
      CAUSE,
      FILING,
    );
    assert.ok(notPending);
    assert.ok(!("other_complaints" in notPending));

    // Pending but every row half-filled: send the flag, but not an empty array (minItems 1).
    const pendingButBlank = jurisdictionSectionBody(
      filledJurisdiction({
        otherPending: "yes",
        otherCases: [{ court: "Munsiff", caseNumber: "" }],
      }),
      CAUSE,
      FILING,
    );
    assert.ok(pendingButBlank);
    assert.equal(pendingButBlank.other_complaints_pending, true);
    assert.ok(!("other_complaints" in pendingButBlank));
  });

  it("sends the drawer's police station (no payee bank block) when not deposited", () => {
    const body = jurisdictionSectionBody(
      filledJurisdiction({
        deposited: "no",
        ifsc: "",
        payeeBankName: "",
        payeeBankBranch: "",
        payeePolice: "",
        drawerPolice: "Fort",
      }),
      CAUSE,
      FILING,
    );
    assert.deepEqual(body, {
      cheque_deposited_by_payee: false,
      other_complaints_pending: false,
      cause_of_action_date: CAUSE,
      complaint_filing_date: FILING,
      drawer_bank_police_station: "Fort",
    });
  });

  it("sends the condonation reason whenever it is written", () => {
    const body = jurisdictionSectionBody(
      filledJurisdiction({ condonationReason: "Hospitalised" }),
      CAUSE,
      FILING,
    );
    assert.ok(body);
    assert.equal(body.condonation_reason, "Hospitalised");

    const none = jurisdictionSectionBody(filledJurisdiction(), CAUSE, FILING);
    assert.ok(none);
    assert.ok(!("condonation_reason" in none));
  });

  it("does not send the old single police-station key or other cases", () => {
    const body = jurisdictionSectionBody(
      filledJurisdiction({ otherCases: [{ court: "X", caseNumber: "Y" }] }),
      CAUSE,
      FILING,
    );
    assert.ok(body);
    for (const key of ["bank_police_station", "other_cases"]) {
      assert.ok(!(key in body), `${key} should not be sent`);
    }
  });

  describe("partial save", () => {
    it("returns null when only the default toggles are set, so an untouched section is not PUT", () => {
      assert.equal(jurisdictionSectionBody(blankJurisdiction(), "", ""), null);
    });

    it("saves what is filled, leaving out missing dates and a part-filled bank block", () => {
      // The payee's bank is half-entered (name only) and the dates are not in yet.
      const body = jurisdictionSectionBody(
        filledJurisdiction({ ifsc: "", payeeBankBranch: "", payeePolice: "" }),
        "",
        "",
      );
      assert.deepEqual(body, {
        cheque_deposited_by_payee: true,
        other_complaints_pending: false,
        payee_bank_name: "HDFC Bank",
      });
    });

    it("leaves out a malformed IFSC rather than sending it", () => {
      const body = jurisdictionSectionBody(filledJurisdiction({ ifsc: "BADCODE" }), CAUSE, FILING);
      assert.ok(body);
      assert.ok(!("payee_ifsc_code" in body));
    });

    it("never produces an empty value", () => {
      const body = jurisdictionSectionBody(
        filledJurisdiction({ payeeBankBranch: "   " }),
        CAUSE,
        "",
      );
      assert.ok(body);
      for (const value of Object.values(body)) {
        assert.notEqual(value, "");
        assert.notEqual(value, 0);
      }
    });
  });
});

function adrPrayer(over: Partial<AdrPrayer> = {}): AdrPrayer {
  return {
    ...blankAdr(),
    adr: "maybe",
    otherDetails: "",
    interimRelief: "<p>Pay interim compensation.</p>",
    finalRelief: "<p>Take cognizance under S-138.</p>",
    ...over,
  };
}

describe("adrPrayerSectionBody", () => {
  it("uppercases the ADR choice and sends the relief fields that have content", () => {
    assert.deepEqual(adrPrayerSectionBody(adrPrayer({ adr: "no", otherDetails: "<p>Note.</p>" })), {
      adr_preference: "NO",
      final_relief: "<p>Take cognizance under S-138.</p>",
      other_details: "<p>Note.</p>",
      interim_relief: "<p>Pay interim compensation.</p>",
    });
  });

  it("sends MAYBE for the 'maybe' choice (backend accepts YES/NO/MAYBE)", () => {
    const body = adrPrayerSectionBody(adrPrayer({ adr: "maybe" }));
    assert.ok(body);
    assert.equal(body.adr_preference, "MAYBE");
    assert.equal(body.final_relief, "<p>Take cognizance under S-138.</p>");
  });

  it("omits empty optional rich-text fields", () => {
    const body = adrPrayerSectionBody(
      adrPrayer({ adr: "yes", otherDetails: "", interimRelief: "<p></p>" }),
    );
    assert.ok(body);
    assert.ok(!("other_details" in body));
    assert.ok(!("interim_relief" in body));
    assert.equal(body.adr_preference, "YES");
  });

  describe("partial save", () => {
    it("saves a non-default preference even before any relief is written", () => {
      const body = adrPrayerSectionBody(adrPrayer({ adr: "no", finalRelief: "<p></p>" }));
      assert.deepEqual(body, {
        adr_preference: "NO",
        interim_relief: "<p>Pay interim compensation.</p>",
      });
    });

    it("returns null when nothing is written and the preference is the default", () => {
      assert.equal(
        adrPrayerSectionBody(adrPrayer({ adr: "yes", finalRelief: "<p></p>", interimRelief: "" })),
        null,
      );
    });
  });
});
