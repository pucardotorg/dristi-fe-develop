import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankAccused, blankComplainant, blankWitness, createBlankDraft } from "./blank";
import {
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

  it("leaves pairs the rules do not name, and half-typed numbers, alone", () => {
    const c = mobileConflicts(
      draftWith([person("98765"), person("98765")], [["9000000001"], ["9000000001"]]),
    );
    assert.equal(firstComplainantClash(c), undefined);
    assert.equal(firstAccusedClash(c), undefined, "two accused may share a number");
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

  it("lets two witnesses, or a witness and a PoA holder, share a number", () => {
    const c = mobileConflicts(
      draftWith([person("9000000001", "9876543210")], [], [["9876543210"], ["9876543210"]]),
    );
    assert.equal(firstWitnessClash(c), undefined);
    assert.equal(firstComplainantClash(c), undefined);
  });
});
