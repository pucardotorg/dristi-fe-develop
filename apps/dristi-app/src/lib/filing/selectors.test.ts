import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blankAccused,
  blankCheque,
  blankComplainant,
  blankNotice,
  blankWitness,
  createBlankDraft,
} from "./blank";
import {
  accusedComplete,
  chequeFullyComplete,
  chequeNumberIssue,
  complainantComplete,
  jurisdictionComplete,
  mobileIssue,
  noticeComplete,
  poaHolderComplete,
  sectionComplete,
  witnessComplete,
} from "./selectors";
import type {
  Accused,
  Address,
  ChequeDetails,
  Complainant,
  DemandNotice,
  FilingDraft,
  Witness,
} from "./types";

/** A complete postal address (every field the backend's `missing_fields` checks). */
const FULL_ADDR: Address = {
  line1: "12 MG Road",
  city: "Kollam",
  pin: "691001",
  district: "Kollam",
  state: "Kerala",
};

const MOBILE = "9876543210";

function fullWitness(): Witness {
  const w = blankWitness();
  w.fullName = "Suresh Pillai";
  // No police station — the backend no longer asks for one on a witness's address.
  w.addresses = [{ addr: { ...FULL_ADDR }, police: "" }];
  return w;
}

function individualComplainant(): Complainant {
  const c = blankComplainant();
  c.name = "Asha Menon";
  c.mobile = MOBILE;
  c.age = "42";
  c.res = { ...FULL_ADDR };
  return c;
}

function institution(): Complainant {
  const c = blankComplainant();
  c.type = "institution";
  c.entType = "private-limited";
  c.entName = "Acme Traders Pvt Ltd";
  c.entCinPan = "ABCDE1234F";
  c.entAddr = { ...FULL_ADDR };
  c.rep = {
    ...c.rep,
    name: "Rohan Shah",
    mobile: MOBILE,
    age: "40",
    designation: "Director",
    addr: { ...FULL_ADDR },
  };
  return c;
}

function individualAccused(): Accused {
  const a = blankAccused();
  a.name = "Ravi Kumar";
  a.addresses = [{ addr: { ...FULL_ADDR }, police: "Kollam East" }];
  a.contacts = [{ mobile: MOBILE, email: "" }];
  return a;
}

describe("mobileIssue", () => {
  it("says nothing of an empty field or a number that can be an Indian mobile", () => {
    assert.equal(mobileIssue(""), undefined);
    assert.equal(mobileIssue(MOBILE), undefined);
    assert.equal(mobileIssue("+91 98765 43210"), undefined);
  });

  it("flags a number too short or starting with a digit no mobile starts with", () => {
    assert.ok(mobileIssue("98765"));
    assert.ok(mobileIssue("5123456789"));
  });
});

describe("witnessComplete", () => {
  it("counts a witness with a name (or designation) and a complete address — no police station", () => {
    assert.equal(witnessComplete(fullWitness()), true);
    const byDesignation = fullWitness();
    byDesignation.fullName = "";
    byDesignation.designation = "Branch manager, SBI Kottayam";
    assert.equal(witnessComplete(byDesignation), true);
  });

  it("holds back a witness missing a name/designation or a complete address", () => {
    const noName = fullWitness();
    noName.fullName = "";
    assert.equal(witnessComplete(noName), false);

    const partialAddress = fullWitness();
    partialAddress.addresses = [{ addr: { ...FULL_ADDR, city: "" }, police: "" }];
    assert.equal(witnessComplete(partialAddress), false);

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

describe("complainantComplete (individual)", () => {
  it("needs a name, a valid mobile, an age and a complete address", () => {
    assert.equal(complainantComplete(individualComplainant()), true);

    const noMobile = individualComplainant();
    noMobile.mobile = "";
    assert.equal(complainantComplete(noMobile), false);

    const badMobile = individualComplainant();
    badMobile.mobile = "5123456789";
    assert.equal(complainantComplete(badMobile), false, "a number the backend would reject");

    const noAge = individualComplainant();
    noAge.age = "";
    assert.equal(complainantComplete(noAge), false);

    const noName = individualComplainant();
    noName.name = "";
    assert.equal(complainantComplete(noName), false);

    const partialAddress = individualComplainant();
    partialAddress.res = { ...FULL_ADDR, pin: "" };
    assert.equal(complainantComplete(partialAddress), false);
  });

  it("needs a complete permanent address only when one is used", () => {
    const c = individualComplainant();
    c.permSame = "no";
    c.perm = { ...FULL_ADDR, state: "" };
    assert.equal(complainantComplete(c), false);
    c.perm = { ...FULL_ADDR };
    assert.equal(complainantComplete(c), true);
  });

  it("needs a complete PoA holder when Power of Attorney was given", () => {
    const c = individualComplainant();
    c.poa = "yes";
    assert.equal(complainantComplete(c), false);
    c.poaHolder = {
      mobile: MOBILE,
      name: "Priya",
      age: "55",
      res: { ...FULL_ADDR },
      permSame: "yes",
      perm: { ...FULL_ADDR },
    };
    assert.equal(complainantComplete(c), true);
  });
});

describe("poaHolderComplete", () => {
  it("is true when no PoA was given, false when the holder is incomplete", () => {
    assert.equal(poaHolderComplete(individualComplainant()), true);
    const c = individualComplainant();
    c.poa = "yes";
    assert.equal(poaHolderComplete(c), false);
    c.poaHolder = {
      mobile: MOBILE,
      name: "Priya",
      age: "55",
      res: { ...FULL_ADDR },
      permSame: "yes",
      perm: { ...FULL_ADDR },
    };
    assert.equal(poaHolderComplete(c), true);
  });
});

describe("complainantComplete (institution)", () => {
  it("needs type, name, CIN/PAN, a complete address and a complete authorised representative", () => {
    assert.equal(complainantComplete(institution()), true);

    for (const mutate of [
      (c: Complainant) => (c.entType = ""),
      (c: Complainant) => (c.entName = ""),
      (c: Complainant) => ((c.entCinPan = ""), (c.entCinPanSkippedAt = null)),
      (c: Complainant) => (c.entAddr = { ...FULL_ADDR, district: "" }),
      (c: Complainant) => (c.rep = { ...c.rep, name: "" }),
      (c: Complainant) => (c.rep = { ...c.rep, mobile: "" }),
      (c: Complainant) => (c.rep = { ...c.rep, age: "" }),
      (c: Complainant) => (c.rep = { ...c.rep, designation: "" }),
      (c: Complainant) => (c.rep = { ...c.rep, addr: { ...FULL_ADDR, line1: "" } }),
    ]) {
      const c = institution();
      mutate(c);
      assert.equal(complainantComplete(c), false);
    }
  });
});

describe("accusedComplete (individual)", () => {
  it("needs a name, a complete address with police, and a contact or the unknown declaration", () => {
    assert.equal(accusedComplete(individualAccused()), true);

    const noName = individualAccused();
    noName.name = "";
    assert.equal(accusedComplete(noName), false);

    const partialAddress = individualAccused();
    partialAddress.addresses = [{ addr: { ...FULL_ADDR, line1: "" }, police: "Kollam East" }];
    assert.equal(accusedComplete(partialAddress), false);

    const noPolice = individualAccused();
    noPolice.addresses = [{ addr: { ...FULL_ADDR }, police: "" }];
    assert.equal(accusedComplete(noPolice), false);
  });

  it("needs a contact, unless the filer declared the contacts unknown", () => {
    const noContact = individualAccused();
    noContact.contacts = [{ mobile: "", email: "" }];
    assert.equal(accusedComplete(noContact), false);

    const declared = individualAccused();
    declared.contacts = [{ mobile: "", email: "" }];
    declared.contactUnknownDeclaredAt = "2026-11-19T10:00:00.000Z";
    assert.equal(accusedComplete(declared), true);

    const emailOnly = individualAccused();
    emailOnly.contacts = [{ mobile: "", email: "ravi@example.com" }];
    assert.equal(accusedComplete(emailOnly), true);
  });
});

describe("accusedComplete (institution)", () => {
  function rep(over: Partial<Accused["reps"][number]> = {}): Accused["reps"][number] {
    return {
      ...blankAccused().reps[0],
      name: "Ravi Kumar",
      mobile: MOBILE,
      addr: { ...FULL_ADDR },
      police: "Kollam East",
      ...over,
    };
  }

  function accusedInstitution(): Accused {
    const a = individualAccused();
    a.type = "institution";
    a.entType = "private-limited";
    a.name = "Ravi & Sons LLP";
    a.reps = [rep()];
    return a;
  }

  it("needs type, name, complete address with police, a named responsible person and reachability", () => {
    assert.equal(accusedComplete(accusedInstitution()), true);

    const noPerson = accusedInstitution();
    noPerson.reps = [rep({ name: "" })];
    assert.equal(accusedComplete(noPerson), false);

    const repNoPolice = accusedInstitution();
    repNoPolice.reps = [rep({ police: "" })];
    assert.equal(accusedComplete(repNoPolice), false);

    const notReachable = accusedInstitution();
    notReachable.contacts = [{ mobile: "", email: "" }];
    assert.equal(accusedComplete(notReachable), false);
  });

  it("needs each person responsible to be reachable, or the contacts declared unknown (ACC-16/17)", () => {
    const repNoContact = accusedInstitution();
    repNoContact.reps = [rep({ mobile: "", email: "" })];
    assert.equal(accusedComplete(repNoContact), false);

    // One declaration covers the institution and its people when none has a contact.
    const declared = accusedInstitution();
    declared.contacts = [{ mobile: "", email: "" }];
    declared.reps = [rep({ mobile: "", email: "" })];
    declared.contactUnknownDeclaredAt = "2026-11-19T10:00:00.000Z";
    assert.equal(accusedComplete(declared), true);
  });

  it("does not require a designation for a person responsible (ACC-15 is optional)", () => {
    const a = accusedInstitution();
    a.reps = [rep({ designation: "" })];
    assert.equal(accusedComplete(a), true);
  });
});

/* ── Case details: cheque, demand notice, jurisdiction, ADR ─────────────────── */

function fullCheque(): ChequeDetails {
  return {
    ...blankCheque(),
    dateOnCheque: "2026-05-15",
    amount: "50000",
    chequeNumber: "000123",
    ifsc: "SBIN0000001",
    bankName: "State Bank of India",
    bankBranch: "MG Road",
    presentDate: "2026-05-20",
    returnDate: "2026-05-22",
    returnReason: "funds-insufficient",
  };
}

describe("chequeFullyComplete", () => {
  it("needs the cheque leaf, the drawer's bank (incl. branch) and the return memo", () => {
    assert.equal(chequeFullyComplete(fullCheque(), 0), true);

    assert.equal(chequeFullyComplete({ ...fullCheque(), bankBranch: "" }, 0), false);
    assert.equal(chequeFullyComplete({ ...fullCheque(), chequeNumber: "12345" }, 0), false);
    assert.equal(chequeFullyComplete({ ...fullCheque(), ifsc: "BADCODE" }, 0), false);
    assert.equal(chequeFullyComplete({ ...fullCheque(), amount: "0" }, 0), false);
    assert.equal(chequeFullyComplete({ ...fullCheque(), returnReason: "" }, 0), false);
  });

  it("inherits the bank for a 'same as previous' cheque", () => {
    const second = {
      ...fullCheque(),
      sameAsPrev: "yes" as const,
      ifsc: "",
      bankName: "",
      bankBranch: "",
    };
    assert.equal(chequeFullyComplete(second, 1), true);
  });
});

function deliveredNotice(): DemandNotice {
  return {
    ...blankNotice(),
    natureDebt: "loan",
    dispatchDate: "2026-08-10",
    modeService: "rpad",
    delivered: "yes",
    deliveryDate: "2026-08-14",
    paymentStatus: "none",
  };
}

describe("noticeComplete", () => {
  it("needs nature, dispatch, mode, payment status and the delivery date when delivered", () => {
    assert.equal(noticeComplete(deliveredNotice()), true);
    assert.equal(noticeComplete({ ...deliveredNotice(), paymentStatus: "" }), false);
    assert.equal(noticeComplete({ ...deliveredNotice(), modeService: "" }), false);
    assert.equal(noticeComplete({ ...deliveredNotice(), deliveryDate: "" }), false);
  });

  it("needs the return date and reason when undelivered", () => {
    const undelivered: DemandNotice = {
      ...deliveredNotice(),
      delivered: "no",
      deliveryDate: "",
      returnDate: "2026-08-20",
      nonDeliveryReason: "unclaimed",
    };
    assert.equal(noticeComplete(undelivered), true);
    assert.equal(noticeComplete({ ...undelivered, returnDate: "" }), false);
    assert.equal(noticeComplete({ ...undelivered, nonDeliveryReason: "" }), false);
  });

  it("needs a positive amount for a part payment", () => {
    assert.equal(
      noticeComplete({ ...deliveredNotice(), paymentStatus: "part", partAmount: "0" }),
      false,
    );
    assert.equal(
      noticeComplete({ ...deliveredNotice(), paymentStatus: "part", partAmount: "500" }),
      true,
    );
  });
});

function jurisdictionDraft(): FilingDraft {
  const d = createBlankDraft("jur");
  d.jurisdiction.causeDate = "2026-08-01";
  d.jurisdiction.filingDate = "2026-08-20";
  d.jurisdiction.deposited = "yes";
  d.jurisdiction.ifsc = "SBIN0000001";
  d.jurisdiction.payeeBankName = "State Bank of India";
  d.jurisdiction.payeeBankBranch = "MG Road";
  d.jurisdiction.payeePolice = "Kollam East";
  return d;
}

describe("jurisdictionComplete", () => {
  it("needs the dates and the payee bank block with its police station when deposited", () => {
    assert.equal(jurisdictionComplete(jurisdictionDraft()), true);

    const noPolice = jurisdictionDraft();
    noPolice.jurisdiction.payeePolice = "";
    assert.equal(jurisdictionComplete(noPolice), false);

    const badIfsc = jurisdictionDraft();
    badIfsc.jurisdiction.ifsc = "BADCODE";
    assert.equal(jurisdictionComplete(badIfsc), false);
  });

  it("needs only the drawer's police station when the payee did not deposit", () => {
    const d = jurisdictionDraft();
    d.jurisdiction.deposited = "no";
    assert.equal(jurisdictionComplete(d), false);
    d.jurisdiction.drawerPolice = "Fort";
    assert.equal(jurisdictionComplete(d), true);
  });

  it("needs a condonation reason when filed late", () => {
    const d = jurisdictionDraft();
    d.jurisdiction.filingDate = "2026-10-15";
    assert.equal(jurisdictionComplete(d), false);
    d.jurisdiction.condonationReason = "Abroad.";
    assert.equal(jurisdictionComplete(d), true);
  });

  it("needs a complete other-complaint row when another complaint is pending", () => {
    const d = jurisdictionDraft();
    d.jurisdiction.otherPending = "yes";
    assert.equal(jurisdictionComplete(d), false);
    d.jurisdiction.otherCases = [{ court: "Munsiff", caseNumber: "CC/12/2026" }];
    assert.equal(jurisdictionComplete(d), true);
  });
});

describe("sectionComplete('adr-prayer')", () => {
  it("needs both the final relief and the interim relief with real text", () => {
    const d = createBlankDraft("adr");
    d.adr.finalRelief = "<p>Take cognizance under S-138.</p>";
    d.adr.interimRelief = "";
    assert.equal(sectionComplete(d, "adr-prayer"), false);
    d.adr.interimRelief = "<p><br></p>";
    assert.equal(sectionComplete(d, "adr-prayer"), false);
    d.adr.interimRelief = "<p>Pay interim compensation.</p>";
    assert.equal(sectionComplete(d, "adr-prayer"), true);
  });
});
