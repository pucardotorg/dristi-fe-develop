import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blankAccused,
  blankAddressBlock,
  blankComplainant,
  blankContact,
  blankRepresentative,
  blankWitness,
} from "./blank";
import type { ParticipantPatch, PartyInput, PartyRole, WitnessInput } from "./data/cases-api";
import {
  accusedBodies,
  complainantBodies,
  missingFields,
  missingFieldsMessage,
  partyChanged,
  patchFor,
  poaHolderBody,
  poaHolderMissing,
  saveParty,
  savePoaHolder,
  selfComplainantId,
  witnessBodies,
} from "./parties";

const addr = {
  line1: "12 MG Road",
  city: "Kollam",
  pin: "691001",
  district: "Kollam",
  state: "Kerala",
};

function complainant() {
  const c = blankComplainant();
  c.name = " Asha Menon ";
  c.mobile = "9876543210";
  c.email = "asha@example.com";
  c.age = "42";
  c.gender = "female";
  c.res = { ...addr };
  return c;
}

function accused() {
  const a = blankAccused();
  a.name = "Ravi Kumar";
  a.contacts = [{ mobile: "9123456780", email: "" }];
  a.addresses = [{ addr: { ...addr }, police: "Kollam East" }];
  a.jurisdiction = "yes";
  return a;
}

describe("complainantBodies", () => {
  it("sends an individual as a person, with a +91 mobile and the residence address", () => {
    const [body] = complainantBodies(complainant());
    assert.deepEqual(body.person, {
      name: "Asha Menon",
      phone_number: "+919876543210",
      email_address: "asha@example.com",
      age: 42,
      gender: "FEMALE",
    });
    assert.deepEqual(body.address, {
      line1: "12 MG Road",
      city: "Kollam",
      pincode: "691001",
      district: "Kollam",
      state: "Kerala",
    });
    assert.equal(body.is_party_in_person, false);
    assert.equal(body.institution, undefined);
  });

  it("keeps a different permanent address in additional details", () => {
    const c = complainant();
    c.permSame = "no";
    c.perm = { ...addr, line1: "4 Beach Road" };
    const [body] = complainantBodies(c);
    assert.equal(
      (body.additional_details.permanent_address as { line1: string }).line1,
      "4 Beach Road"
    );
  });

  it("keeps disability on the person as yes or no, not in additional details", () => {
    const c = complainant();
    c.differentlyAbled = "yes";
    const [body] = complainantBodies(c);
    assert.equal(body.person?.disability_status, true);
    assert.deepEqual(body.additional_details, {});
    c.differentlyAbled = "no";
    assert.equal(complainantBodies(c)[0].person?.disability_status, false);
  });

  it("marks a party in person", () => {
    const c = complainant();
    c.pip = "yes";
    assert.equal(complainantBodies(c)[0].is_party_in_person, true);
  });

  it("sends an institution with its PAN, and its representative as the person", () => {
    const c = blankComplainant();
    c.type = "institution";
    c.entType = "private-limited";
    c.entName = "Kollam Traders Pvt Ltd";
    c.entCinPan = "abcde1234f";
    c.entAddr = { ...addr };
    c.rep = { ...blankRepresentative(), name: "Meera Nair", designation: "Director", mobile: "9000000001" };
    const [body] = complainantBodies(c);
    assert.deepEqual(body.institution, {
      entity_type: "PRIVATE_LIMITED_COMPANY",
      entity_name: "Kollam Traders Pvt Ltd",
      pan: "ABCDE1234F",
    });
    assert.equal(body.person?.name, "Meera Nair");
    assert.equal(body.designation, "Director");
  });
});

describe("accusedBodies", () => {
  it("sends an individual with the first contact and the address's police station", () => {
    const [body] = accusedBodies(accused());
    assert.deepEqual(body.person, { name: "Ravi Kumar", phone_number: "+919123456780" });
    assert.equal(body.address.police_station, "Kollam East");
    assert.equal(body.resides_within_jurisdiction, true);
    assert.deepEqual(body.additional_details, {});
  });

  it("sends whether the accused resides within the jurisdiction, and patches it", () => {
    const a = accused();
    a.jurisdiction = "no";
    const [body] = accusedBodies(a);
    assert.equal(body.resides_within_jurisdiction, false);
    assert.equal(patchFor(body).resides_within_jurisdiction, false);
  });

  it("does not send the jurisdiction answer for a complainant", () => {
    const [body] = complainantBodies(complainant());
    assert.equal("resides_within_jurisdiction" in body, false);
    assert.equal("resides_within_jurisdiction" in patchFor(body), false);
  });

  it("keeps further contacts and addresses in additional details", () => {
    const a = accused();
    a.contacts.push({ mobile: "", email: "ravi@example.com" });
    a.addresses.push({ addr: { ...addr, line1: "Shop 3, Main Bazaar" }, police: "Kollam West" });
    const [body] = accusedBodies(a);
    assert.deepEqual(body.additional_details.other_contacts, [{ email_address: "ravi@example.com" }]);
    assert.equal(
      (body.additional_details.other_addresses as Array<{ police_station: string }>)[0]
        .police_station,
      "Kollam West"
    );
  });

  it("skips empty contact rows and blank address blocks", () => {
    const a = accused();
    a.contacts.unshift(blankContact());
    a.addresses.unshift(blankAddressBlock());
    const [body] = accusedBodies(a);
    assert.equal(body.person?.phone_number, "+919123456780");
    assert.equal(body.address.line1, "12 MG Road");
    assert.equal(body.additional_details.other_addresses, undefined);
  });

  it("saves an institution once per person summoned for it (S-141)", () => {
    const a = accused();
    a.type = "institution";
    a.entType = "partnership";
    a.name = "Ravi & Sons";
    a.reps = [
      { ...blankRepresentative(), name: "Ravi Kumar", designation: "Partner" },
      { ...blankRepresentative(), name: "Sunil Kumar", designation: "Partner" },
      blankRepresentative(),
    ];
    const bodies = accusedBodies(a);
    assert.equal(bodies.length, 2);
    for (const body of bodies) {
      assert.equal(body.institution?.entity_name, "Ravi & Sons");
      assert.equal(body.institution?.entity_type, "PARTNERSHIP_FIRM");
      assert.equal(body.designation, "Partner");
    }
    assert.deepEqual(
      bodies.map((b) => b.person?.name),
      ["Ravi Kumar", "Sunil Kumar"]
    );
  });

  it("sends an institution alone when nobody is named for it", () => {
    const a = accused();
    a.type = "institution";
    a.entType = "llp";
    const [body] = accusedBodies(a);
    assert.equal(body.person, undefined);
    assert.equal(body.institution?.entity_type, "LLP");
  });
});

describe("witnessBodies", () => {
  function witness() {
    const w = blankWitness();
    w.fullName = "Suresh Pillai";
    w.designation = "Branch manager";
    w.age = "51";
    w.prove = "The cheque was presented and returned unpaid.";
    w.contacts = [{ mobile: "9000000002", email: "" }];
    w.addresses = [{ addr: { ...addr }, police: "Kollam East" }];
    return w;
  }

  it("sends the witness as the complainant's, with their designation", () => {
    const [body] = witnessBodies(witness());
    assert.deepEqual(body.person, {
      name: "Suresh Pillai",
      phone_number: "+919000000002",
      age: 51,
    });
    assert.equal(body.side, "COMPLAINANT");
    assert.equal(body.designation, "Branch manager");
    assert.equal(body.what_will_witness_prove, "The cheque was presented and returned unpaid.");
    assert.equal(body.address?.police_station, "Kollam East");
    assert.deepEqual(body.additional_details, {});
  });

  it("names a witness known only by designation, and leaves out a missing address", () => {
    const w = witness();
    w.fullName = "";
    w.addresses = [blankAddressBlock()];
    const [body] = witnessBodies(w);
    assert.equal(body.person.name, "Branch manager");
    assert.equal("address" in body, false);
    assert.deepEqual(missingFields(body, "witnesses"), []);
  });

  it("saves a witness without what they will prove, still as the complainant's", () => {
    const w = witness();
    w.prove = "  ";
    const [body] = witnessBodies(w);
    assert.equal(body.side, "COMPLAINANT");
    assert.equal("what_will_witness_prove" in body, false);
    assert.deepEqual(missingFields(body, "witnesses"), []);
  });

  it("patches a witness with its own fields, not a party in person's", () => {
    const patch = patchFor(witnessBodies(witness())[0]);
    assert.equal("is_party_in_person" in patch, false);
    assert.equal(patch.designation_at_filing, "Branch manager");
    assert.equal(patch.side, "COMPLAINANT");
    assert.equal(patch.what_will_witness_prove, "The cheque was presented and returned unpaid.");
  });

  it("patches, rather than replaces, a witness whose statement changed", async () => {
    const { api, calls } = fakeApi();
    const w = witness();
    const saved = {
      caseParticipantIds: ["w1"],
      savedBodies: witnessBodies(w).map((b) => JSON.stringify(b)),
    };
    w.prove = "The notice was served.";
    await saveParty(api, "case-1", "witnesses", witnessBodies(w), saved);
    assert.deepEqual(calls.map((x) => x.op), ["update"]);
  });
});

describe("missingFields", () => {
  it("asks an accused for the whole address and its police station", () => {
    const a = accused();
    a.addresses = [{ addr: { ...addr, city: "", pin: "" }, police: "" }];
    const missing = missingFields(accusedBodies(a)[0], "accused");
    assert.deepEqual(missing, ["city", "pincode", "police station"]);
    assert.equal(
      missingFieldsMessage(missing),
      "Add the city, pincode and police station to save this to your case."
    );
  });

  it("does not ask a complainant for a police station", () => {
    assert.deepEqual(missingFields(complainantBodies(complainant())[0], "complainants"), []);
  });

  it("asks for the type of entity and each summoned person's designation", () => {
    const a = accused();
    a.type = "institution";
    a.entType = "";
    a.reps = [{ ...blankRepresentative(), name: "Ravi" }];
    assert.deepEqual(missingFields(accusedBodies(a)[0], "accused"), [
      "type of entity",
      "designation",
    ]);
  });

  it("asks a witness with an address for its police station", () => {
    const w = blankWitness();
    w.fullName = "Suresh";
    w.prove = "x";
    w.addresses = [{ addr: { ...addr }, police: "" }];
    assert.deepEqual(missingFields(witnessBodies(w)[0], "witnesses"), ["police station"]);
  });
});

describe("phone numbers", () => {
  it("sends a mobile typed with its country code and spaces in E.164", () => {
    const c = complainant();
    c.mobile = "+91 98765 43210";
    assert.equal(complainantBodies(c)[0].person?.phone_number, "+919876543210");
  });

  it("sends a landline as typed, for the backend to judge", () => {
    const a = accused();
    a.type = "institution";
    a.entType = "llp";
    a.contacts = [{ mobile: "0474 2233445", email: "" }];
    assert.equal(accusedBodies(a)[0].institution?.contact_number, "0474 2233445");
  });
});

describe("patchFor", () => {
  it("names an institution alone by its entity name, without a designation", () => {
    const patch = patchFor({
      institution: { entity_name: "Kollam Traders", contact_number: "0474 2233445" },
      address: {},
      is_party_in_person: false,
      additional_details: {},
    });
    assert.equal(patch.name_at_filing, "Kollam Traders");
    assert.equal(patch.phone_number_at_filing, "0474 2233445");
    assert.equal("designation_at_filing" in patch, false);
  });
});

/* ── saveParty ──────────────────────────────────────────────────────────────── */

type Call =
  | { op: "add"; role: PartyRole; body: PartyInput | WitnessInput }
  | { op: "update"; id: string; patch: ParticipantPatch }
  | { op: "remove"; id: string };

function fakeApi(failOn?: Call["op"]) {
  const calls: Call[] = [];
  let next = 0;
  return {
    calls,
    api: {
      async addParty(_caseId: string, role: PartyRole, body: PartyInput | WitnessInput) {
        calls.push({ op: "add", role, body });
        if (failOn === "add") throw new Error("refused");
        return `p${++next}`;
      },
      async updateParticipant(id: string, patch: ParticipantPatch) {
        calls.push({ op: "update", id, patch });
        if (failOn === "update") throw new Error("refused");
      },
      async removeParticipant(id: string) {
        calls.push({ op: "remove", id });
        if (failOn === "remove") throw new Error("refused");
      },
    },
  };
}

describe("the filer as complainant", () => {
  const litigant = {
    role: "LITIGANT" as const,
    name: "Asha Menon",
    mobile: "9876543210",
    email: "",
    barNumber: "",
  };

  it("is the litigant's own complainant, by their account's mobile", () => {
    const other = { ...complainant(), mobile: "9000000001" };
    const self = { ...complainant(), mobile: "+91 98765 43210" };
    assert.equal(selfComplainantId([other, self], litigant), self.id);
  });

  it("is nobody for an advocate, an institution or a different number", () => {
    const c = complainant();
    assert.equal(selfComplainantId([c], { ...litigant, role: "ADVOCATE" }), undefined);
    assert.equal(selfComplainantId([{ ...c, type: "institution" }], litigant), undefined);
    assert.equal(selfComplainantId([c], { ...litigant, mobile: "9111111111" }), undefined);
  });

  it("adds the filer as self, without a person, then writes what they typed to the case", async () => {
    const { api, calls } = fakeApi();
    const bodies = complainantBodies(complainant(), true);
    const result = await saveParty(api, "case-1", "complainants", bodies, {});
    assert.deepEqual(calls.map((x) => x.op), ["add", "update"]);
    const sent = JSON.parse(JSON.stringify((calls[0] as { body: PartyInput }).body));
    assert.equal(sent.self, true);
    assert.equal("person" in sent, false);
    const patch = (calls[1] as { patch: ParticipantPatch }).patch;
    assert.equal(patch.age_at_filing, 42);
    assert.equal(patch.gender_at_filing, "FEMALE");
    assert.deepEqual(result.caseParticipantIds, ["p1"]);
  });

  it("re-adds a complainant saved as a named person once they turn out to be the filer", async () => {
    const { api, calls } = fakeApi();
    const c = complainant();
    const saved = {
      caseParticipantIds: ["p9"],
      savedBodies: complainantBodies(c).map((b) => JSON.stringify(b)),
    };
    await saveParty(api, "case-1", "complainants", complainantBodies(c, true), saved);
    assert.deepEqual(calls.map((x) => x.op), ["remove", "add", "update"]);
  });
});

describe("saveParty", () => {
  it("adds a party that was never saved", async () => {
    const { api, calls } = fakeApi();
    const bodies = complainantBodies(complainant());
    const result = await saveParty(api, "case-1", "complainants", bodies, {});
    assert.deepEqual(result.caseParticipantIds, ["p1"]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].op, "add");
    assert.equal(partyChanged(bodies, result), false);
  });

  it("sends nothing for a party saved as it is", async () => {
    const { api, calls } = fakeApi();
    const bodies = complainantBodies(complainant());
    const saved = { caseParticipantIds: ["p9"], savedBodies: bodies.map((b) => JSON.stringify(b)) };
    const result = await saveParty(api, "case-1", "complainants", bodies, saved);
    assert.equal(calls.length, 0);
    assert.deepEqual(result.caseParticipantIds, ["p9"]);
  });

  it("patches the case's copy when only its details changed", async () => {
    const { api, calls } = fakeApi();
    const c = complainant();
    const saved = {
      caseParticipantIds: ["p9"],
      savedBodies: complainantBodies(c).map((b) => JSON.stringify(b)),
    };
    c.name = "Asha M. Menon";
    const result = await saveParty(api, "case-1", "complainants", complainantBodies(c), saved);
    assert.deepEqual(calls.map((x) => x.op), ["update"]);
    assert.equal((calls[0] as { patch: ParticipantPatch }).patch.name_at_filing, "Asha M. Menon");
    assert.deepEqual(result.caseParticipantIds, ["p9"]);
  });

  it("replaces the participant when who the party is changed", async () => {
    const { api, calls } = fakeApi();
    const c = complainant();
    const saved = {
      caseParticipantIds: ["p9"],
      savedBodies: complainantBodies(c).map((b) => JSON.stringify(b)),
    };
    c.email = "asha.menon@example.com";
    const result = await saveParty(api, "case-1", "complainants", complainantBodies(c), saved);
    assert.deepEqual(calls.map((x) => x.op), ["remove", "add"]);
    assert.deepEqual(result.caseParticipantIds, ["p1"]);
  });

  it("replaces the participant when the disability answer changed, as PATCH cannot", async () => {
    const { api, calls } = fakeApi();
    const c = complainant();
    const saved = {
      caseParticipantIds: ["p9"],
      savedBodies: complainantBodies(c).map((b) => JSON.stringify(b)),
    };
    c.differentlyAbled = "yes";
    await saveParty(api, "case-1", "complainants", complainantBodies(c), saved);
    assert.deepEqual(calls.map((x) => x.op), ["remove", "add"]);
  });

  it("removes participants for people no longer summoned", async () => {
    const { api, calls } = fakeApi();
    const a = accused();
    a.type = "institution";
    a.reps = [
      { ...blankRepresentative(), name: "Ravi" },
      { ...blankRepresentative(), name: "Sunil" },
    ];
    const before = accusedBodies(a);
    const saved = { caseParticipantIds: ["p8", "p9"], savedBodies: before.map((b) => JSON.stringify(b)) };
    a.reps = a.reps.slice(0, 1);
    const result = await saveParty(api, "case-1", "accused", accusedBodies(a), saved);
    assert.deepEqual(calls, [{ op: "remove", id: "p9" }]);
    assert.deepEqual(result.caseParticipantIds, ["p8"]);
  });

  it("removing the second person summoned never relabels the third as them", async () => {
    const { api, calls } = fakeApi();
    const a = accused();
    a.type = "institution";
    a.entType = "partnership";
    a.reps = ["Ravi", "Sunil", "Anil"].map((name) => ({
      ...blankRepresentative(),
      name,
      designation: "Partner",
    }));
    const before = accusedBodies(a);
    const saved = {
      caseParticipantIds: ["p1", "p2", "p3"],
      savedBodies: before.map((b) => JSON.stringify(b)),
    };
    a.reps.splice(1, 1);
    const result = await saveParty(api, "case-1", "accused", accusedBodies(a), saved);
    // Sunil (p2) goes; Anil is never written over Sunil's participant.
    assert.ok(!calls.some((c) => c.op === "update" && c.id === "p2"));
    assert.ok(calls.some((c) => c.op === "remove" && c.id === "p2"));
    assert.equal(result.caseParticipantIds[0], "p1");
  });

  it("on failure, records only what is on the case, so a retry does not add twice", async () => {
    const { api } = fakeApi("add");
    const c = complainant();
    const saved = {
      caseParticipantIds: ["p9"],
      savedBodies: complainantBodies(c).map((b) => JSON.stringify(b)),
    };
    c.email = "new@example.com";
    const result = await saveParty(api, "case-1", "complainants", complainantBodies(c), saved);
    assert.ok(result.error);
    // p9 was removed before the add failed, so it is no longer on record.
    assert.deepEqual(result.caseParticipantIds, []);
    assert.equal(partyChanged(complainantBodies(c), result), true);
  });

  it("on a failed patch, keeps the participant and its old body, so a retry patches again", async () => {
    const { api } = fakeApi("update");
    const c = complainant();
    const savedBodies = complainantBodies(c).map((b) => JSON.stringify(b));
    c.age = "43";
    const result = await saveParty(api, "case-1", "complainants", complainantBodies(c), {
      caseParticipantIds: ["p9"],
      savedBodies,
    });
    assert.ok(result.error);
    assert.deepEqual(result.caseParticipantIds, ["p9"]);
    assert.deepEqual(result.savedBodies, savedBodies);
  });
});

describe("PoA holder", () => {
  function withHolder() {
    const c = complainant();
    c.poa = "yes";
    c.poaHolder = {
      mobile: "9000000003",
      name: " Suresh Patel ",
      age: "60",
      res: { ...addr },
      permSame: "yes",
      perm: { ...addr },
    };
    return c;
  }

  type PoaCall =
    | { op: "add"; body: unknown }
    | { op: "update"; id: string; patch: ParticipantPatch }
    | { op: "revoke"; id: string };

  function poaApi() {
    const calls: PoaCall[] = [];
    let next = 0;
    return {
      calls,
      api: {
        async addPoaHolder(_caseId: string, body: unknown) {
          calls.push({ op: "add", body: JSON.parse(JSON.stringify(body)) });
          next += 1;
          return { participantId: `h${next}`, mandateIds: [`m${next}`] };
        },
        async updateParticipant(id: string, patch: ParticipantPatch) {
          calls.push({ op: "update", id, patch });
        },
        async revokePoaMandate(id: string) {
          calls.push({ op: "revoke", id });
        },
      },
    };
  }

  it("is sent only for a complainant who named one, and not when appearing in person", () => {
    assert.equal(poaHolderBody(complainant()), null);
    const c = withHolder();
    assert.deepEqual(poaHolderBody(c)?.person, {
      name: "Suresh Patel",
      phone_number: "+919000000003",
      age: 60,
    });
    c.pip = "yes";
    assert.equal(poaHolderBody(c), null);
  });

  it("needs a full address before it is sent", () => {
    const c = withHolder();
    c.poaHolder.res = { ...addr, city: "" };
    const body = poaHolderBody(c);
    assert.ok(body);
    assert.deepEqual(poaHolderMissing(body), ["city"]);
  });

  it("is added for the complainant's participant, after the complainant", async () => {
    const { api, calls } = poaApi();
    const result = await savePoaHolder(api, "case-1", poaHolderBody(withHolder()), "p1", undefined);
    assert.equal(calls.length, 1);
    const sent = (calls[0] as { body: { represented_participant_ids: string[] } }).body;
    assert.deepEqual(sent.represented_participant_ids, ["p1"]);
    assert.equal(result.saved?.participantId, "h1");
    assert.deepEqual(result.saved?.mandateIds, ["m1"]);
  });

  it("waits while its complainant is not on the case", async () => {
    const { api, calls } = poaApi();
    const result = await savePoaHolder(api, "case-1", poaHolderBody(withHolder()), undefined, undefined);
    assert.equal(calls.length, 0);
    assert.equal(result.saved, undefined);
  });

  it("patches a holder whose details changed", async () => {
    const { api, calls } = poaApi();
    const c = withHolder();
    const first = await savePoaHolder(api, "case-1", poaHolderBody(c), "p1", undefined);
    c.poaHolder.age = "61";
    await savePoaHolder(api, "case-1", poaHolderBody(c), "p1", first.saved);
    assert.deepEqual(calls.map((x) => x.op), ["add", "update"]);
    const patch = (calls[1] as { patch: ParticipantPatch }).patch;
    assert.equal(patch.age_at_filing, 61);
    assert.equal("is_party_in_person" in patch, false);
  });

  it("revokes the mandate when the complainant no longer has a holder", async () => {
    const { api, calls } = poaApi();
    const c = withHolder();
    const first = await savePoaHolder(api, "case-1", poaHolderBody(c), "p1", undefined);
    c.poa = "no";
    const result = await savePoaHolder(api, "case-1", poaHolderBody(c), "p1", first.saved);
    assert.deepEqual(calls.map((x) => x.op), ["add", "revoke"]);
    assert.equal(result.saved, undefined);
  });

  it("is added again for a complainant who was added again", async () => {
    const { api, calls } = poaApi();
    const body = poaHolderBody(withHolder());
    const first = await savePoaHolder(api, "case-1", body, "p1", undefined);
    const result = await savePoaHolder(api, "case-1", body, "p2", first.saved);
    assert.deepEqual(calls.map((x) => x.op), ["add", "revoke", "add"]);
    assert.equal(result.saved?.forParticipantId, "p2");
  });

  it("PATCHes a holder added as self on the next save when the first PATCH failed", async () => {
    const calls: string[] = [];
    let failUpdate = true;
    const api = {
      async addPoaHolder() {
        calls.push("add");
        return { participantId: "h1", mandateIds: ["m1"] };
      },
      async updateParticipant() {
        calls.push("update");
        if (failUpdate) throw new Error("timeout");
      },
      async revokePoaMandate() {
        calls.push("revoke");
      },
    };
    const body = poaHolderBody(withHolder(), true);
    const first = await savePoaHolder(api, "case-1", body, "p1", undefined);
    assert.ok(first.error);
    assert.equal(first.saved?.participantId, "h1");

    failUpdate = false;
    calls.length = 0;
    const second = await savePoaHolder(api, "case-1", body, "p1", first.saved);
    assert.deepEqual(calls, ["update"]);
    assert.equal(second.saved?.body, JSON.stringify(body));
  });

  it("adds the filer as self, without a person, then writes what they typed", async () => {
    const { api, calls } = poaApi();
    await savePoaHolder(api, "case-1", poaHolderBody(withHolder(), true), "p1", undefined);
    assert.deepEqual(calls.map((x) => x.op), ["add", "update"]);
    const sent = (calls[0] as { body: Record<string, unknown> }).body;
    assert.equal(sent.self, true);
    assert.equal("person" in sent, false);
  });
});

describe("saveParty — matching by who, not by position", () => {
  function institutionAccused(names: string[]) {
    const a = accused();
    a.type = "institution";
    a.entType = "private-limited";
    a.reps = names.map((name) => ({ ...blankRepresentative(), name, designation: "Director" }));
    return a;
  }

  it("keeps the people still summoned when one before them is removed", async () => {
    const { api, calls } = fakeApi();
    const before = accusedBodies(institutionAccused(["A", "B", "C"]));
    const saved = {
      caseParticipantIds: ["pA", "pB", "pC"],
      savedBodies: before.map((b) => JSON.stringify(b)),
    };
    const result = await saveParty(
      api,
      "case-1",
      "accused",
      accusedBodies(institutionAccused(["A", "C"])),
      saved
    );
    assert.deepEqual(calls, [{ op: "remove", id: "pB" }]);
    assert.deepEqual(result.caseParticipantIds, ["pA", "pC"]);
  });

  it("after a failed add, the next save touches only the one that failed", async () => {
    const before = accusedBodies(institutionAccused(["A", "B", "C"]));
    const saved = {
      caseParticipantIds: ["pA", "pB", "pC"],
      savedBodies: before.map((b) => JSON.stringify(b)),
    };
    const changed = institutionAccused(["A", "B", "C"]);
    changed.reps[0].email = "a@example.com";
    const bodies = accusedBodies(changed);

    const failing = fakeApi("add");
    const first = await saveParty(failing.api, "case-1", "accused", bodies, saved);
    assert.ok(first.error);
    assert.deepEqual(first.caseParticipantIds, ["pB", "pC"]);

    const { api, calls } = fakeApi();
    const second = await saveParty(api, "case-1", "accused", bodies, first);
    assert.deepEqual(calls.map((x) => x.op), ["add"]);
    assert.deepEqual(second.caseParticipantIds, ["p1", "pB", "pC"]);
  });

  it("keeps the filer added as self when the follow-up PATCH fails, and PATCHes on retry", async () => {
    const calls: string[] = [];
    let failUpdate = true;
    const api = {
      async addParty() {
        calls.push("add");
        return "p1";
      },
      async updateParticipant() {
        calls.push("update");
        if (failUpdate) throw new Error("timeout");
      },
      async removeParticipant() {
        calls.push("remove");
      },
    };
    const bodies = complainantBodies(complainant(), true);
    const first = await saveParty(api, "case-1", "complainants", bodies, {});
    assert.ok(first.error);
    assert.deepEqual(first.caseParticipantIds, ["p1"]);
    assert.equal(partyChanged(bodies, first), true);

    failUpdate = false;
    calls.length = 0;
    const second = await saveParty(api, "case-1", "complainants", bodies, first);
    assert.deepEqual(calls, ["update"]);
    assert.equal(second.error, undefined);
    assert.equal(partyChanged(bodies, second), false);
  });
});
