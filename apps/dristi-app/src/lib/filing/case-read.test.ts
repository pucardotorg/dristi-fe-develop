import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankAccused, blankAdvocate, blankComplainant } from "./blank";
import { accusedFromCase, advocatesFromCase, complainantsFromCase } from "./case-read";
import type {
  AddressRead,
  CaseRead,
  ParticipantRead,
  RepresentationRead,
} from "./data/cases-api";
import {
  accusedBodies,
  complainantBodies,
  partyChanged,
  poaHolderBody,
} from "./parties";
import type { Accused, Complainant } from "./types";

const ADDRESS: AddressRead = {
  line1: "12 MG Road",
  city: "Kollam",
  district: "Kollam",
  state: "Kerala",
  pincode: "691001",
  police_station: null,
};

/** `ADDRESS` as the form holds it. */
const FORM_ADDRESS = {
  line1: "12 MG Road",
  city: "Kollam",
  pin: "691001",
  district: "Kollam",
  state: "Kerala",
};

function participant(overrides: Partial<ParticipantRead>): ParticipantRead {
  return {
    case_participant_id: "p1",
    person_id: "person-1",
    institution_id: null,
    role: "COMPLAINANT",
    ordinal: 1,
    name_at_filing: "Asha Menon",
    gender_at_filing: "FEMALE",
    age_at_filing: 42,
    designation_at_filing: null,
    mobile_numbers: ["+919876543210"],
    email_addresses: ["asha@example.com"],
    addresses: [ADDRESS],
    institution: null,
    disability_status: null,
    permanent_address: null,
    is_party_in_person: false,
    resides_within_jurisdiction: null,
    contact_details_unknown_declared: false,
    party_in_person_affidavit: null,
    additional_details: {},
    updated_at: "2026-11-08T10:00:00Z",
    ...overrides,
  };
}

function caseOf(read: Partial<CaseRead>): CaseRead {
  return { participants: [], representations: [], poa_mandates: [], ...read };
}

/** A complainant as this browser last saved it, as participant `p1`. */
function savedComplainant(): Complainant {
  const c = blankComplainant();
  c.name = "Asha Menon";
  c.mobile = "9876543210";
  c.email = "asha@example.com";
  c.age = "42";
  c.gender = "female";
  c.res = { ...FORM_ADDRESS };
  c.caseParticipantIds = ["p1"];
  c.savedBodies = complainantBodies(c).map((b) => JSON.stringify(b));
  return c;
}

describe("complainantsFromCase", () => {
  it("shows the case's copy of a saved complainant, keeping the form's id", () => {
    const local = savedComplainant();
    const read = caseOf({ participants: [participant({ name_at_filing: "Asha R. Menon" })] });
    const { parties, replaced } = complainantsFromCase(read, [local], null);
    assert.equal(parties.length, 1);
    assert.equal(parties[0].id, local.id);
    assert.equal(parties[0].name, "Asha R. Menon");
    assert.equal(parties[0].verified, true);
    assert.deepEqual(replaced, [local.id]);
  });

  it("records the case's copy as saved, so the step sends nothing back", () => {
    const read = caseOf({ participants: [participant({ disability_status: true })] });
    const [c] = complainantsFromCase(read, [savedComplainant()], null).parties;
    assert.equal(c.differentlyAbled, "yes");
    assert.equal(partyChanged(complainantBodies(c), c), false);
  });

  it("keeps this browser's copy of a complainant with edits not saved yet", () => {
    const local = savedComplainant();
    local.name = "Asha M.";
    const read = caseOf({ participants: [participant({})] });
    const { parties, replaced } = complainantsFromCase(read, [local], null);
    assert.equal(parties[0].name, "Asha M.");
    assert.deepEqual(replaced, []);
  });

  it("keeps a complainant whose save failed", () => {
    const local = { ...savedComplainant(), syncError: "Something went wrong." };
    const read = caseOf({ participants: [participant({})] });
    const { parties } = complainantsFromCase(read, [local], null);
    assert.equal(parties[0], local);
  });

  it("keeps a complainant never saved, and adds one only the case has", () => {
    const typed = { ...blankComplainant(), name: "Ravi" };
    const read = caseOf({ participants: [participant({ case_participant_id: "p9" })] });
    const { parties } = complainantsFromCase(read, [typed], null);
    assert.equal(parties.length, 2);
    assert.equal(parties[0], typed);
    assert.equal(parties[1].id, "cp-p9");
    assert.deepEqual(parties[1].caseParticipantIds, ["p9"]);
    assert.equal(partyChanged(complainantBodies(parties[1]), parties[1]), false);
  });

  it("marks a complainant the case no longer has as unsaved, so it is added again", () => {
    const local = savedComplainant();
    const { parties, unsaved } = complainantsFromCase(caseOf({}), [local], null);
    assert.equal(parties[0].name, "Asha Menon");
    assert.deepEqual(parties[0].caseParticipantIds, []);
    assert.deepEqual(unsaved, [local.id]);
  });

  it("reads a different permanent address, and the affidavit of one appearing in person", () => {
    const read = caseOf({
      participants: [
        participant({
          permanent_address: { ...ADDRESS, line1: "4 Beach Road" },
          is_party_in_person: true,
          party_in_person_affidavit: "<p>I appear in person.</p>",
        }),
      ],
    });
    const [c] = complainantsFromCase(read, [savedComplainant()], null).parties;
    assert.equal(c.permSame, "no");
    assert.equal(c.perm.line1, "4 Beach Road");
    assert.equal(c.pip, "yes");
    assert.equal(c.affidavit, "<p>I appear in person.</p>");
  });

  it("reads an institution with its PAN, contact and representative", () => {
    const read = caseOf({
      participants: [
        participant({
          institution_id: "inst-1",
          institution: {
            entity_name: "Kollam Traders Pvt Ltd",
            entity_type: "PRIVATE_LIMITED_COMPANY",
            pan: "ABCDE1234F",
            cin: null,
            pan_cin_skip_declared: false,
            mobile_numbers: ["0474 2233445"],
            email_addresses: ["office@kollamtraders.in"],
            addresses: [ADDRESS],
          },
          name_at_filing: "Meera Nair",
          designation_at_filing: "Director",
          // The representative's own.
          addresses: [{ ...ADDRESS, line1: "8 Lake View" }],
        }),
      ],
    });
    const [c] = complainantsFromCase(read, [], null).parties;
    assert.equal(c.type, "institution");
    assert.equal(c.entType, "private-limited");
    assert.equal(c.entName, "Kollam Traders Pvt Ltd");
    assert.equal(c.entCinPan, "ABCDE1234F");
    assert.equal(c.entCinPanSkippedAt, null);
    assert.equal(c.entPhone, "0474 2233445");
    assert.equal(c.entEmail, "office@kollamtraders.in");
    assert.equal(c.entAddr.line1, "12 MG Road");
    assert.equal(c.rep.name, "Meera Nair");
    assert.equal(c.rep.mobile, "9876543210");
    assert.equal(c.rep.designation, "Director");
    assert.equal(c.rep.addr.line1, "8 Lake View");
    assert.equal(partyChanged(complainantBodies(c), c), false);
  });

  it("dates a CIN/PAN skip it did not see made from the case's last change", () => {
    const read = caseOf({
      participants: [
        participant({
          person_id: null,
          institution_id: "inst-1",
          institution: {
            entity_name: "Kollam Traders",
            entity_type: "PARTNERSHIP_FIRM",
            pan: null,
            cin: null,
            pan_cin_skip_declared: true,
            mobile_numbers: [],
            email_addresses: [],
            addresses: [ADDRESS],
          },
          mobile_numbers: [],
          email_addresses: [],
          addresses: [],
        }),
      ],
    });
    const [c] = complainantsFromCase(read, [], null).parties;
    assert.equal(c.entCinPanSkippedAt, "2026-11-08T10:00:00Z");
    assert.equal(c.rep.name, "");
  });

  it("reads the complainant's PoA holder, recorded as saved", () => {
    const read = caseOf({
      participants: [
        participant({}),
        participant({
          case_participant_id: "h1",
          role: "POA_HOLDER",
          name_at_filing: "Vinod Pillai",
          mobile_numbers: ["+919000000002"],
          email_addresses: [],
          age_at_filing: 50,
        }),
      ],
      poa_mandates: [
        { poa_mandate_id: "m1", poa_participant_id: "h1", represented_participant_id: "p1" },
      ],
    });
    const [c] = complainantsFromCase(read, [savedComplainant()], null).parties;
    assert.equal(c.poa, "yes");
    assert.equal(c.poaHolder.name, "Vinod Pillai");
    assert.equal(c.poaHolder.mobile, "9000000002");
    assert.deepEqual(c.savedPoaHolder?.mandateIds, ["m1"]);
    assert.equal(c.savedPoaHolder?.forParticipantId, "p1");
    assert.equal(c.savedPoaHolder?.body, JSON.stringify(poaHolderBody(c)));
  });
});

describe("accusedFromCase", () => {
  function savedAccused(): Accused {
    const a = blankAccused();
    a.name = "Ravi Kumar";
    a.contacts = [{ mobile: "9123456780", email: "" }];
    a.addresses = [
      {
        addr: { ...FORM_ADDRESS },
        police: "Kollam East",
      },
    ];
    a.caseParticipantIds = ["a1"];
    a.savedBodies = accusedBodies(a).map((b) => JSON.stringify(b));
    return a;
  }

  const accusedRow = (overrides: Partial<ParticipantRead>) =>
    participant({
      case_participant_id: "a1",
      role: "ACCUSED",
      name_at_filing: "Ravi Kumar",
      mobile_numbers: ["+919123456780"],
      email_addresses: [],
      gender_at_filing: null,
      age_at_filing: null,
      addresses: [{ ...ADDRESS, police_station: "Kollam East" }],
      resides_within_jurisdiction: true,
      ...overrides,
    });

  it("shows the case's copy, with every contact and address", () => {
    const read = caseOf({
      participants: [
        accusedRow({
          resides_within_jurisdiction: false,
          email_addresses: ["ravi@example.com"],
          addresses: [
            { ...ADDRESS, police_station: "Kollam East" },
            { ...ADDRESS, line1: "3 Station Road", police_station: "Kollam West" },
          ],
        }),
      ],
    });
    const [a] = accusedFromCase(read, [savedAccused()]).parties;
    assert.deepEqual(a.contacts, [{ mobile: "9123456780", email: "ravi@example.com" }]);
    assert.equal(a.addresses[1].addr.line1, "3 Station Road");
    assert.equal(a.addresses[1].police, "Kollam West");
    assert.equal(a.jurisdiction, "no");
    assert.equal(partyChanged(accusedBodies(a), a), false);
  });

  /** A company's people summoned, sharing its institution row. */
  function companyRows() {
    const institution = {
      entity_name: "Kollam Traders",
      entity_type: "PRIVATE_LIMITED_COMPANY",
      pan: null,
      cin: null,
      pan_cin_skip_declared: null,
      mobile_numbers: ["0474 2233445"],
      email_addresses: [],
      addresses: [{ ...ADDRESS, police_station: "Kollam East" }],
    };
    const person = { institution, mobile_numbers: [], email_addresses: [], addresses: [] };
    return [
      accusedRow({
        ...person,
        institution_id: "i1",
        name_at_filing: "Meera",
        designation_at_filing: "Director",
      }),
      accusedRow({
        ...person,
        case_participant_id: "a2",
        ordinal: 2,
        institution_id: "i1",
        name_at_filing: "Arun",
        designation_at_filing: "Manager",
      }),
    ];
  }

  it("makes one accused of an institution's people summoned", () => {
    const read = caseOf({ participants: companyRows() });
    const { parties } = accusedFromCase(read, []);
    assert.equal(parties.length, 1);
    const [a] = parties;
    assert.equal(a.type, "institution");
    assert.equal(a.name, "Kollam Traders");
    assert.equal(a.entType, "private-limited");
    // A company's number may be a landline, so it is kept as stored.
    assert.deepEqual(a.contacts, [{ mobile: "0474 2233445", email: "" }]);
    assert.equal(a.addresses[0].police, "Kollam East");
    assert.deepEqual(a.reps.map((r) => r.name), ["Meera", "Arun"]);
    assert.deepEqual(a.caseParticipantIds, ["a1", "a2"]);
    assert.equal(partyChanged(accusedBodies(a), a), false);
  });

  it("keeps two companies of the same name apart", () => {
    const [meera, arun] = companyRows();
    const read = caseOf({ participants: [meera, { ...arun, institution_id: "i2" }] });
    assert.equal(accusedFromCase(read, []).parties.length, 2);
  });

  it("keeps the time the filer declared they had no contact details", () => {
    const local = { ...savedAccused(), contacts: [{ mobile: "", email: "" }] };
    local.contactUnknownDeclaredAt = "2026-11-01T09:00:00Z";
    local.savedBodies = accusedBodies(local).map((b) => JSON.stringify(b));
    const read = caseOf({
      participants: [
        accusedRow({ mobile_numbers: [], contact_details_unknown_declared: true }),
      ],
    });
    const [a] = accusedFromCase(read, [local]).parties;
    assert.equal(a.contactUnknownDeclaredAt, "2026-11-01T09:00:00Z");
  });
});

describe("advocatesFromCase", () => {
  const complainants = [
    { ...blankComplainant(), caseParticipantIds: ["p1"] },
    { ...blankComplainant(), caseParticipantIds: ["p2"] },
  ];
  const idOf = (c: Complainant) => c.caseParticipantIds?.[0];
  const rep = (overrides: Partial<RepresentationRead>): RepresentationRead => ({
    representation_id: "r1",
    advocate_id: "adv-a",
    advocate_name: "K. Raman",
    bar_registration_id: "K/123/2010",
    client_participant_id: "p1",
    ...overrides,
  });

  it("makes one row per advocate, acting for the complainants they represent", () => {
    const read = caseOf({
      representations: [rep({}), rep({ representation_id: "r2", client_participant_id: "p2" })],
    });
    const [a] = advocatesFromCase(read, [], complainants, idOf).parties;
    assert.equal(a.name, "K. Raman");
    assert.equal(a.barNumber, "K/123/2010");
    assert.equal(a.advocateId, "adv-a");
    assert.deepEqual(a.forComplainants, [0, 1]);
    assert.deepEqual(a.representations, { p1: "r1", p2: "r2" });
  });

  it("replaces a saved row with the case's, and keeps a row typed in by hand", () => {
    const saved = {
      ...blankAdvocate(),
      name: "Raman",
      advocateId: "adv-a",
      savedAdvocateId: "adv-a",
      forComplainants: [0],
      representations: { p1: "r1" },
    };
    const byHand = { ...blankAdvocate(), name: "S. Iyer", forComplainants: [1] };
    const read = caseOf({ representations: [rep({})] });
    const { parties, replaced } = advocatesFromCase(read, [saved, byHand], complainants, idOf);
    assert.equal(parties[0].id, saved.id);
    assert.equal(parties[0].name, "K. Raman");
    assert.equal(parties[1], byHand);
    assert.deepEqual(replaced, [saved.id]);
  });

  it("keeps a row whose clients changed and are not saved yet", () => {
    const changed = {
      ...blankAdvocate(),
      advocateId: "adv-a",
      savedAdvocateId: "adv-a",
      forComplainants: [0, 1],
      representations: { p1: "r1" },
    };
    const read = caseOf({ representations: [rep({})] });
    const { parties } = advocatesFromCase(read, [changed], complainants, idOf);
    assert.equal(parties.length, 1);
    assert.equal(parties[0], changed);
  });
});
