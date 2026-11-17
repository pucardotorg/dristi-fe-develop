import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankAccused, blankComplainant, createBlankDraft } from "./blank";
import { firstAccusedClash, firstComplainantClash, mobileConflicts } from "./mobile-conflicts";
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

function draftWith(complainants: Complainant[], accusedMobiles: string[][] = []): FilingDraft {
  const d = createBlankDraft("draft-mobiles");
  d.complainants = complainants;
  d.accused = accusedMobiles.map((mobiles) => {
    const a = blankAccused();
    a.contacts = mobiles.map((mobile) => ({ mobile, email: "" }));
    return a;
  });
  return d;
}

describe("mobileConflicts", () => {
  it("stops two complainants sharing a number, however it was typed", () => {
    const c = mobileConflicts(draftWith([person("9876543210"), person("+91 98765 43210")]));
    assert.deepEqual(c.complainant, [
      { role: "complainant", complainant: 1 },
      { role: "complainant", complainant: 0 },
    ]);
    assert.equal(firstComplainantClash(c), 0);
  });

  it("stops a complainant and an accused sharing a number, on both sides", () => {
    const c = mobileConflicts(draftWith([person("9876543210")], [["9000000001", "9876543210"]]));
    assert.deepEqual(c.complainant[0], { role: "accused", accused: 0, contact: 1 });
    assert.deepEqual(c.accused[0], [undefined, { role: "complainant", complainant: 0 }]);
    assert.equal(firstAccusedClash(c), 0);
  });

  it("stops a complainant sharing a number with their own PoA holder", () => {
    const c = mobileConflicts(draftWith([person("9876543210", "9876543210")]));
    assert.deepEqual(c.complainant[0], { role: "poa-holder", complainant: 0 });
    assert.deepEqual(c.poaHolder[0], { role: "complainant", complainant: 0 });
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
});
