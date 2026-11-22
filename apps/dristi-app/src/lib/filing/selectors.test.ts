import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankCheque, blankComplainant, blankNotice, blankWitness } from "./blank";
import {
  advocateMobileIssue,
  chequeNumberIssue,
  complainantComplete,
  filingAdvocateMobile,
  mobileIssue,
  natureDebtOtherNeeded,
  natureOfDebtText,
  noticeComplete,
  witnessComplete,
} from "./selectors";
import type { Complainant, DemandNotice, UserProfile, Witness } from "./types";

function profileAs(role: UserProfile["role"]): UserProfile {
  return { role, name: "A. Menon", mobile: "9876543210", email: "", barNumber: "K/123/2010" };
}

describe("filingAdvocateMobile", () => {
  it("is the filer's number only when they file as the advocate", () => {
    assert.equal(filingAdvocateMobile(profileAs("ADVOCATE")), "9876543210");
    assert.equal(filingAdvocateMobile(profileAs("LITIGANT")), undefined);
    assert.equal(filingAdvocateMobile(profileAs("CLERK")), undefined);
    assert.equal(filingAdvocateMobile(null), undefined);
  });
});

describe("advocateMobileIssue", () => {
  it("flags a party's number that is the advocate's, however it is written", () => {
    assert.ok(advocateMobileIssue("9876543210", "9876543210"));
    assert.ok(advocateMobileIssue("+91 98765 43210", "9876543210"));
  });

  it("says nothing of another number, an empty field, or an unknown advocate number", () => {
    assert.equal(advocateMobileIssue("9000000002", "9876543210"), undefined);
    assert.equal(advocateMobileIssue("", "9876543210"), undefined);
    assert.equal(advocateMobileIssue("9876543210", undefined), undefined);
  });
});

function fullWitness(): Witness {
  const w = blankWitness();
  w.fullName = "Suresh Pillai";
  w.contacts = [{ mobile: "9000000002", email: "" }];
  w.addresses = [
    { addr: { ...blankWitness().addresses[0].addr, line1: "12 MG Road" }, police: "Kollam East" },
  ];
  return w;
}

function institution(): Complainant {
  const c = blankComplainant();
  c.type = "institution";
  c.entType = "private-limited";
  c.entName = "Acme Traders Pvt Ltd";
  c.entCinPan = "ABCDE1234F";
  c.entAddr.line1 = "12 MG Road";
  c.rep.name = "Rohan Shah";
  c.rep.mobile = "9876543210";
  return c;
}

describe("mobileIssue", () => {
  it("says nothing of an empty field or a number that can be an Indian mobile", () => {
    assert.equal(mobileIssue(""), undefined);
    assert.equal(mobileIssue("9876543210"), undefined);
    assert.equal(mobileIssue("+91 98765 43210"), undefined);
  });

  it("flags a number too short or starting with a digit no mobile starts with", () => {
    assert.ok(mobileIssue("98765"));
    assert.ok(mobileIssue("5123456789"));
  });
});

describe("witnessComplete", () => {
  it("counts a witness with a name (or designation) and an address with a police station", () => {
    assert.equal(witnessComplete(fullWitness()), true);
    const byDesignation = fullWitness();
    byDesignation.fullName = "";
    byDesignation.designation = "Branch manager, SBI Kottayam";
    assert.equal(witnessComplete(byDesignation), true);
  });

  it("holds back a witness missing a name/designation or the address", () => {
    const noName = fullWitness();
    noName.fullName = "";
    assert.equal(witnessComplete(noName), false);

    const noMobile = fullWitness();
    noMobile.contacts = [{ mobile: "", email: "" }];
    assert.equal(witnessComplete(noMobile), true, "the mobile number is optional");

    const noPolice = fullWitness();
    noPolice.addresses = [{ ...noPolice.addresses[0], police: "" }];
    assert.equal(witnessComplete(noPolice), false);

    assert.equal(witnessComplete(blankWitness()), false);
  });
});

describe("chequeNumberIssue", () => {
  it("passes an empty field (incomplete, not a format error) and a valid six-digit number", () => {
    assert.equal(chequeNumberIssue({ ...blankCheque(), chequeNumber: "" }), undefined);
    assert.equal(chequeNumberIssue({ ...blankCheque(), chequeNumber: "456789" }), undefined);
  });

  it("flags a number that is not exactly six digits", () => {
    assert.ok(chequeNumberIssue({ ...blankCheque(), chequeNumber: "76879990" }));
    assert.ok(chequeNumberIssue({ ...blankCheque(), chequeNumber: "12345" }));
    assert.ok(chequeNumberIssue({ ...blankCheque(), chequeNumber: "12a456" }));
  });
});

describe("complainantComplete", () => {
  it("counts an institution reached through its representative's mobile", () => {
    // The institution form has no complainant mobile; it must not be required.
    assert.equal(complainantComplete(institution()), true);
  });

  it("holds back an institution whose representative has no mobile", () => {
    const c = institution();
    c.rep.mobile = "";
    assert.equal(complainantComplete(c), false);
  });

  it("still requires an individual's own mobile", () => {
    const c = blankComplainant();
    c.name = "Asha Menon";
    c.res.line1 = "4 Beach Road";
    assert.equal(complainantComplete(c), false);
    c.mobile = "9876543210";
    assert.equal(complainantComplete(c), true);
  });
});

describe("the 'other' nature of debt (LDN-1a)", () => {
  function notice(over: Partial<DemandNotice> = {}): DemandNotice {
    return {
      ...blankNotice(),
      natureDebt: "loan",
      dispatchDate: "2026-06-01",
      modeService: "rpad",
      ...over,
    };
  }

  it("asks for a description only when the nature of debt is other", () => {
    assert.equal(natureDebtOtherNeeded(notice()), false);
    assert.equal(natureDebtOtherNeeded(notice({ natureDebt: "other" })), true);
  });

  it("leaves an 'other' notice incomplete until it is described", () => {
    assert.equal(noticeComplete(notice()), true);
    assert.equal(noticeComplete(notice({ natureDebt: "other" })), false);
    assert.equal(noticeComplete(notice({ natureDebt: "other", natureDebtOther: "  " })), false);
    assert.equal(
      noticeComplete(notice({ natureDebt: "other", natureDebtOther: "Unpaid rent" })),
      true,
    );
  });

  it("reads the description after the option, and only for other", () => {
    assert.equal(
      natureOfDebtText(notice({ natureDebt: "other", natureDebtOther: " Unpaid rent " })),
      "Other liability: Unpaid rent",
    );
    assert.equal(natureOfDebtText(notice({ natureDebt: "other" })), "Other liability");
    // A description left behind after switching away is not shown.
    assert.equal(
      natureOfDebtText(notice({ natureDebt: "loan", natureDebtOther: "Unpaid rent" })),
      "Loan / advance repayment",
    );
    assert.equal(natureOfDebtText(undefined), "");
  });
});
