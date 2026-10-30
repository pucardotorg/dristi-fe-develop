import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankJurisdiction } from "./blank";
import {
  adrPrayerReady,
  adrPrayerSectionBody,
  jurisdictionReady,
  jurisdictionSectionBody,
} from "./details";
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

describe("jurisdictionReady", () => {
  it("needs a cause-of-action date", () => {
    assert.equal(jurisdictionReady(filledJurisdiction(), ""), false);
    assert.equal(jurisdictionReady(filledJurisdiction(), CAUSE), true);
  });

  it("needs the payee bank block when the payee deposited the cheque", () => {
    assert.equal(jurisdictionReady(filledJurisdiction({ ifsc: "" }), CAUSE), false);
    assert.equal(jurisdictionReady(filledJurisdiction({ ifsc: "BADCODE" }), CAUSE), false);
    assert.equal(jurisdictionReady(filledJurisdiction({ payeeBankName: "" }), CAUSE), false);
    assert.equal(jurisdictionReady(filledJurisdiction({ payeePolice: "" }), CAUSE), false);
  });

  it("does not need the payee bank block when the payee did not deposit", () => {
    assert.equal(
      jurisdictionReady(
        filledJurisdiction({ deposited: "no", ifsc: "", payeeBankName: "", payeeBankBranch: "", payeePolice: "" }),
        CAUSE
      ),
      true
    );
  });
});

describe("jurisdictionSectionBody", () => {
  it("builds the full section when the payee deposited the cheque", () => {
    assert.deepEqual(jurisdictionSectionBody(filledJurisdiction({ otherPending: "yes" }), CAUSE), {
      cheque_deposited_by_payee: true,
      other_complaints_pending: true,
      cause_of_action_date: CAUSE,
      payee_ifsc_code: "HDFC0000512",
      payee_bank_name: "HDFC Bank",
      payee_bank_branch: "Kochi",
      bank_police_station: "Ernakulam Central",
    });
  });

  it("omits the payee bank block when the payee did not deposit", () => {
    const body = jurisdictionSectionBody(
      filledJurisdiction({ deposited: "no", ifsc: "", payeeBankName: "", payeeBankBranch: "", payeePolice: "" }),
      CAUSE
    );
    assert.deepEqual(body, {
      cheque_deposited_by_payee: false,
      other_complaints_pending: false,
      cause_of_action_date: CAUSE,
    });
  });

  it("does not send the drawer police station, condonation reason or other cases", () => {
    const body = jurisdictionSectionBody(
      filledJurisdiction({ drawerPolice: "Fort", condonationReason: "late", otherCases: [{ court: "X", caseNumber: "Y" }] }),
      CAUSE
    );
    assert.ok(body);
    for (const key of ["drawer_police_station", "condonation_reason", "other_cases", "filing_date"]) {
      assert.ok(!(key in body), `${key} should not be sent`);
    }
  });

  it("returns null when the section is not complete", () => {
    assert.equal(jurisdictionSectionBody(filledJurisdiction(), ""), null);
    assert.equal(jurisdictionSectionBody(filledJurisdiction({ payeePolice: "" }), CAUSE), null);
  });
});

function adrPrayer(over: Partial<AdrPrayer> = {}): AdrPrayer {
  return {
    adr: "maybe",
    otherDetails: "",
    interimRelief: "<p>Pay interim compensation.</p>",
    finalRelief: "<p>Take cognizance under S-138.</p>",
    ...over,
  };
}

describe("adrPrayerReady", () => {
  it("needs a final relief with real content", () => {
    assert.equal(adrPrayerReady(adrPrayer()), true);
    assert.equal(adrPrayerReady(adrPrayer({ finalRelief: "" })), false);
    assert.equal(adrPrayerReady(adrPrayer({ finalRelief: "<p></p>" })), false);
    assert.equal(adrPrayerReady(adrPrayer({ finalRelief: "<p>&nbsp;</p>" })), false);
  });
});

describe("adrPrayerSectionBody", () => {
  it("uppercases the ADR choice and sends the relief fields that have content", () => {
    assert.deepEqual(adrPrayerSectionBody(adrPrayer({ adr: "no", otherDetails: "<p>Note.</p>" })), {
      adr_preference: "NO",
      final_relief: "<p>Take cognizance under S-138.</p>",
      other_details: "<p>Note.</p>",
      interim_relief: "<p>Pay interim compensation.</p>",
    });
  });

  it("omits empty optional rich-text fields", () => {
    const body = adrPrayerSectionBody(adrPrayer({ otherDetails: "", interimRelief: "<p></p>" }));
    assert.ok(body);
    assert.ok(!("other_details" in body));
    assert.ok(!("interim_relief" in body));
    assert.equal(body.adr_preference, "MAYBE");
  });

  it("returns null when the final relief is empty", () => {
    assert.equal(adrPrayerSectionBody(adrPrayer({ finalRelief: "<p></p>" })), null);
  });
});
