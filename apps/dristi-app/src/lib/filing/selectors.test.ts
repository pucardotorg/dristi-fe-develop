import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankCheque, blankComplainant, blankWitness } from "./blank";
import { chequeNumberIssue, complainantComplete, witnessComplete } from "./selectors";
import type { Complainant, Witness } from "./types";

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
