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
const FILING = "2024-03-01";

describe("jurisdictionReady", () => {
  it("needs both the cause-of-action and complaint filing dates", () => {
    assert.equal(jurisdictionReady(filledJurisdiction(), "", FILING), false);
    assert.equal(jurisdictionReady(filledJurisdiction(), CAUSE, ""), false);
    assert.equal(jurisdictionReady(filledJurisdiction(), CAUSE, FILING), true);
  });

  it("needs the payee bank block and police station when the payee deposited", () => {
    assert.equal(jurisdictionReady(filledJurisdiction({ ifsc: "" }), CAUSE, FILING), false);
    assert.equal(jurisdictionReady(filledJurisdiction({ ifsc: "BADCODE" }), CAUSE, FILING), false);
    assert.equal(jurisdictionReady(filledJurisdiction({ payeeBankName: "" }), CAUSE, FILING), false);
    assert.equal(jurisdictionReady(filledJurisdiction({ payeePolice: "" }), CAUSE, FILING), false);
  });

  it("needs only the drawer's police station when the payee did not deposit", () => {
    const notDeposited = {
      deposited: "no" as const,
      ifsc: "",
      payeeBankName: "",
      payeeBankBranch: "",
      payeePolice: "",
    };
    assert.equal(jurisdictionReady(filledJurisdiction({ ...notDeposited, drawerPolice: "Fort" }), CAUSE, FILING), true);
    assert.equal(jurisdictionReady(filledJurisdiction({ ...notDeposited, drawerPolice: "" }), CAUSE, FILING), false);
  });
});

describe("jurisdictionSectionBody", () => {
  it("builds the full section with the payee's police station when the payee deposited", () => {
    assert.deepEqual(jurisdictionSectionBody(filledJurisdiction({ otherPending: "yes" }), CAUSE, FILING, false), {
      cheque_deposited_by_payee: true,
      other_complaints_pending: true,
      cause_of_action_date: CAUSE,
      complaint_filing_date: FILING,
      payee_ifsc_code: "HDFC0000512",
      payee_bank_name: "HDFC Bank",
      payee_bank_branch: "Kochi",
      payee_bank_police_station: "Ernakulam Central",
    });
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
      false
    );
    assert.deepEqual(body, {
      cheque_deposited_by_payee: false,
      other_complaints_pending: false,
      cause_of_action_date: CAUSE,
      complaint_filing_date: FILING,
      drawer_bank_police_station: "Fort",
    });
  });

  it("sends the condonation reason only when the complaint is filed late", () => {
    const onTime = jurisdictionSectionBody(filledJurisdiction({ condonationReason: "late" }), CAUSE, FILING, false);
    assert.ok(onTime);
    assert.ok(!("condonation_reason" in onTime));

    const late = jurisdictionSectionBody(filledJurisdiction({ condonationReason: "Hospitalised" }), CAUSE, FILING, true);
    assert.ok(late);
    assert.equal(late.condonation_reason, "Hospitalised");
  });

  it("does not send the old single police-station key or other cases", () => {
    const body = jurisdictionSectionBody(
      filledJurisdiction({ otherCases: [{ court: "X", caseNumber: "Y" }] }),
      CAUSE,
      FILING,
      false
    );
    assert.ok(body);
    for (const key of ["bank_police_station", "other_cases"]) {
      assert.ok(!(key in body), `${key} should not be sent`);
    }
  });

  it("returns null when the section is not complete", () => {
    assert.equal(jurisdictionSectionBody(filledJurisdiction(), "", FILING, false), null);
    assert.equal(jurisdictionSectionBody(filledJurisdiction(), CAUSE, "", false), null);
    assert.equal(jurisdictionSectionBody(filledJurisdiction({ payeePolice: "" }), CAUSE, FILING, false), null);
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

  it("omits adr_preference for the 'maybe' choice (backend accepts only YES/NO)", () => {
    const body = adrPrayerSectionBody(adrPrayer({ adr: "maybe" }));
    assert.ok(body);
    assert.ok(!("adr_preference" in body));
    assert.equal(body.final_relief, "<p>Take cognizance under S-138.</p>");
  });

  it("omits empty optional rich-text fields", () => {
    const body = adrPrayerSectionBody(adrPrayer({ adr: "yes", otherDetails: "", interimRelief: "<p></p>" }));
    assert.ok(body);
    assert.ok(!("other_details" in body));
    assert.ok(!("interim_relief" in body));
    assert.equal(body.adr_preference, "YES");
  });

  it("returns null when the final relief is empty", () => {
    assert.equal(adrPrayerSectionBody(adrPrayer({ finalRelief: "<p></p>" })), null);
  });
});
