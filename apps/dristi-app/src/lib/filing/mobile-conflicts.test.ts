import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankAccused, blankComplainant, blankWitness, createBlankDraft } from "./blank";
import {
  advocateMobileClashes,
  firstAccusedClash,
  firstComplainantClash,
  firstWitnessClash,
  mobileConflicts,
} from "./mobile-conflicts";
import type { Complainant, FilingDraft } from "./types";

function person(mobile: string, poaHolderMobile?: string): Complainant {
  const c = blankComplainant();
  c.type = "individual";
  c.pip = "no";
  c.mobile = mobile;
  if (poaHolderMobile !== undefined) {
    c.poa = "yes";
    c.poaHolder.mobile = poaHolderMobile;
  }
  return c;
}

function draftWith(
  complainants: Complainant[],
  accusedMobiles: string[][] = [],
  witnessMobiles: string[][] = [],
): FilingDraft {
  const d = createBlankDraft("draft-mobiles");
  d.complainants = complainants;
  d.accused = accusedMobiles.map((mobiles) => {
    const a = blankAccused();
    a.contacts = mobiles.map((mobile) => ({ mobile, email: "" }));
    return a;
  });
  d.witnesses = witnessMobiles.map((mobiles) => {
    const w = blankWitness();
    w.contacts = mobiles.map((mobile) => ({ mobile, email: "" }));
    return w;
  });
  return d;
}

describe("mobileConflicts", () => {
  it("stops two complainants sharing a number, however it was typed, on the later one", () => {
    const c = mobileConflicts(draftWith([person("9876543210"), person("+91 98765 43210")]));
    assert.deepEqual(c.complainant, [undefined, { role: "complainant", complainant: 0 }]);
    assert.equal(firstComplainantClash(c), 1);
  });

  it("stops an accused using a complainant's number, on the accused's field only", () => {
    const c = mobileConflicts(draftWith([person("9876543210")], [["9000000001", "9876543210"]]));
    assert.deepEqual(c.accused[0], [undefined, { role: "complainant", complainant: 0 }]);
    assert.equal(c.complainant[0], undefined);
    assert.equal(firstAccusedClash(c), 0);
    assert.equal(firstComplainantClash(c), undefined);
  });

  it("stops a PoA holder using their own complainant's number, on the PoA field only", () => {
    const c = mobileConflicts(draftWith([person("9876543210", "9876543210")]));
    assert.deepEqual(c.poaHolder[0], { role: "complainant", complainant: 0 });
    assert.equal(c.complainant[0], undefined);
    assert.equal(firstComplainantClash(c), 0, "the PoA field is on the complainant step");
  });

  it("lets a complainant be another complainant's PoA holder", () => {
    const c = mobileConflicts(
      draftWith([person("9876543210"), person("9000000002", "9876543210")]),
    );
    assert.deepEqual(c.complainant, [undefined, undefined]);
    assert.deepEqual(c.poaHolder, [undefined, undefined]);
    assert.equal(firstComplainantClash(c), undefined);
  });

  it("ignores a PoA holder once the complainant has no PoA or appears in person", () => {
    const noPoa = person("9876543210", "9876543210");
    noPoa.poa = "no";
    const inPerson = person("9000000002", "9000000002");
    inPerson.pip = "yes";
    const c = mobileConflicts(draftWith([noPoa, inPerson]));
    assert.equal(firstComplainantClash(c), undefined);
  });

  it("leaves half-typed numbers alone", () => {
    const c = mobileConflicts(
      draftWith([person("98765"), person("98765")], [["98765"], ["98765"]]),
    );
    assert.equal(firstComplainantClash(c), undefined);
    assert.equal(firstAccusedClash(c), undefined);
  });

  it("stops two accused sharing a number, on the later accused only", () => {
    const c = mobileConflicts(draftWith([person("9000000001")], [["9876543210"], ["9876543210"]]));
    assert.deepEqual(c.accused[0], [undefined]);
    assert.deepEqual(c.accused[1], [{ role: "accused", accused: 0, contact: 0 }]);
    assert.equal(firstAccusedClash(c), 1);
  });

  it("lets one accused repeat a number across their own contact rows", () => {
    const c = mobileConflicts(draftWith([person("9000000001")], [["9876543210", "9876543210"]]));
    assert.equal(firstAccusedClash(c), undefined);
  });

  it("stops an accused using a PoA holder's number, on the accused's field only", () => {
    const c = mobileConflicts(
      draftWith([person("9000000001", "9876543210")], [["9000000002", "9876543210"]]),
    );
    assert.deepEqual(c.accused[0], [undefined, { role: "poa-holder", complainant: 0 }]);
    assert.equal(c.poaHolder[0], undefined);
    assert.equal(firstAccusedClash(c), 0);
    assert.equal(firstComplainantClash(c), undefined);
  });

  it("stops two PoA holders sharing a number, on the later one only", () => {
    const c = mobileConflicts(
      draftWith([person("9000000001", "9876543210"), person("9000000002", "9876543210")]),
    );
    assert.deepEqual(c.poaHolder, [undefined, { role: "poa-holder", complainant: 0 }]);
    assert.equal(firstComplainantClash(c), 1);
  });

  it("stops a witness using a complainant's number, on the witness's field only", () => {
    const c = mobileConflicts(draftWith([person("9876543210")], [], [["9876543210"]]));
    assert.deepEqual(c.witness[0], [{ role: "complainant", complainant: 0 }]);
    assert.equal(c.complainant[0], undefined);
    assert.equal(firstWitnessClash(c), 0);
    assert.equal(firstComplainantClash(c), undefined);
  });

  it("stops a witness using an accused's number, on any contact row, on the witness only", () => {
    const c = mobileConflicts(
      draftWith([person("9000000001")], [["9876543210"]], [[""], ["9000000003", "9876543210"]]),
    );
    assert.deepEqual(c.witness[1], [undefined, { role: "accused", accused: 0, contact: 0 }]);
    assert.deepEqual(c.accused[0], [undefined]);
    assert.equal(firstWitnessClash(c), 1);
    assert.equal(firstAccusedClash(c), undefined);
  });

  it("stops two witnesses sharing a number, on the later witness only", () => {
    const c = mobileConflicts(
      draftWith([person("9000000001")], [], [["9876543210"], ["+91 98765 43210"]]),
    );
    assert.deepEqual(c.witness[0], [undefined]);
    assert.deepEqual(c.witness[1], [{ role: "witness", witness: 0, contact: 0 }]);
    assert.equal(firstWitnessClash(c), 1);
  });

  it("lets one witness repeat a number across their own contact rows", () => {
    const c = mobileConflicts(
      draftWith([person("9000000001")], [], [["9876543210", "9876543210"]]),
    );
    assert.equal(firstWitnessClash(c), undefined);
  });

  it("lets a witness and a PoA holder share a number", () => {
    const c = mobileConflicts(
      draftWith([person("9000000001", "9876543210")], [], [["9876543210"]]),
    );
    assert.equal(firstWitnessClash(c), undefined);
    assert.equal(firstComplainantClash(c), undefined);
  });
});

describe("advocateMobileClashes", () => {
  const ADVOCATE = "9123456789";

  it("finds the first complainant, accused and witness with the advocate's number", () => {
    const d = draftWith(
      [person("9000000001"), person("+91 91234 56789")],
      [["9000000002"], ["9000000003", ADVOCATE]],
      [[ADVOCATE]],
    );
    assert.deepEqual(advocateMobileClashes(d, ADVOCATE), {
      complainant: 1,
      accused: 1,
      witness: 0,
    });
  });

  it("lets a PoA holder have the advocate's number (issue #64)", () => {
    const d = draftWith([person("9000000001", ADVOCATE)]);
    assert.equal(advocateMobileClashes(d, ADVOCATE).complainant, undefined);
  });

  it("checks an institution's representative and the people summoned for an accused entity", () => {
    const institution = blankComplainant();
    institution.type = "institution";
    institution.rep.mobile = ADVOCATE;
    const d = draftWith([institution], [["9000000002"]]);
    d.accused[0].type = "institution";
    d.accused[0].reps = [{ ...d.accused[0].reps[0], mobile: ADVOCATE }];
    assert.deepEqual(advocateMobileClashes(d, ADVOCATE), {
      complainant: 0,
      accused: 0,
      witness: undefined,
    });
  });

  it("checks nothing when the advocate's number is unknown", () => {
    const d = draftWith([person(ADVOCATE)], [[ADVOCATE]], [[ADVOCATE]]);
    assert.deepEqual(advocateMobileClashes(d, undefined), {});
  });
});
