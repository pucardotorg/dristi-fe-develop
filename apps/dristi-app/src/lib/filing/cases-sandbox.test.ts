import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isApiError } from "@/lib/api";

import { blankAccused, blankComplainant, blankRepresentative, blankWitness } from "./blank";
import { accusedFromCase, complainantsFromCase, witnessesFromCase } from "./case-read";
import { caseFilingCopy } from "./content";
import { caseFilingSource } from "./data";
import { caseFilingErrorMessage } from "./data/cases-api";
import { SANDBOX_ADVOCATES, SandboxCaseFiling, memoryCaseStore } from "./data/indexeddb";
import { accusedBodies, complainantBodies, saveParty, witnessBodies } from "./parties";

const addr = {
  line1: "12 MG Road",
  city: "Kollam",
  pin: "691001",
  district: "Kollam",
  state: "Kerala",
};

function sandbox() {
  return new SandboxCaseFiling(memoryCaseStore(), async () => ({
    name: "Anjali Nair",
    mobile: "8009460966",
  }));
}

/** JSON as it goes over the wire: fields left `undefined` are not sent. */
const wire = (value: unknown) => JSON.parse(JSON.stringify(value));

async function rejectsWith(promise: Promise<unknown>, status: number, code?: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(isApiError(error), "an ApiError, as the backend's client throws");
    assert.equal(error.status, status);
    if (code) assert.ok(error.hasCode(code), `code ${code}`);
    return true;
  });
}

function complainant() {
  const c = blankComplainant();
  c.name = "Asha Menon";
  c.mobile = "9876543210";
  c.email = "asha@example.com";
  c.age = "42";
  c.gender = "female";
  c.differentlyAbled = "no";
  c.res = { ...addr };
  c.permSame = "no";
  c.perm = { ...addr, line1: "4 Beach Road" };
  return c;
}

function companyAccused() {
  const a = blankAccused();
  a.type = "institution";
  a.entType = "partnership";
  a.name = "Ravi & Sons";
  a.contacts = [{ mobile: "0474 2233445", email: "legal@ravisons.in" }];
  a.addresses = [{ addr: { ...addr }, police: "Kollam East" }];
  a.jurisdiction = "no";
  const partner = (name: string, mobile: string) => ({
    ...blankRepresentative(),
    name,
    designation: "Partner",
    mobile,
    addr: { ...addr },
    police: "Kollam West",
  });
  a.reps = [partner("Ravi Kumar", "9123456780"), partner("Sunil Kumar", "9123456781")];
  return a;
}

function witness() {
  const w = blankWitness();
  w.fullName = "Latha R.";
  w.designation = "Branch manager";
  w.age = "51";
  w.prove = "The cheque was presented and returned.";
  w.contacts = [{ mobile: "9447000001", email: "" }];
  w.addresses = [{ addr: { ...addr }, police: "Kollam East" }];
  return w;
}

describe("caseFilingSource", () => {
  it("uses the sandbox only when sign-in is in the sandbox too", () => {
    assert.equal(caseFilingSource("sandbox", "sandbox"), "sandbox");
    // `npm run dev` and staging: sandbox drafts, real sign-in, cases on the backend.
    assert.equal(caseFilingSource("sandbox", "api"), "api");
    assert.equal(caseFilingSource("api", "api"), "api");
    assert.equal(caseFilingSource("api", "sandbox"), "api");
  });
});

describe("the sandbox case", () => {
  it("has nothing to read until the first save creates it", async () => {
    const api = sandbox();
    const { caseId } = await api.startDraft();
    await rejectsWith(api.getCase(caseId), 404);
    await api.saveDetails(caseId, "jurisdiction_limitation", { police_station: "Kollam East" });
    const read = await api.getCase(caseId);
    assert.deepEqual(read.details, { jurisdiction_limitation: { police_station: "Kollam East" } });
  });

  it("refuses a save to a draft session it never opened", async () => {
    await rejectsWith(sandbox().saveAffidavit("no-such-case", "<p>Sworn</p>"), 404);
  });

  it("gives back a complainant exactly as the step sent them", async () => {
    const api = sandbox();
    const { caseId } = await api.startDraft();
    const bodies = complainantBodies(complainant());
    const saved = await saveParty(api, caseId, "complainants", bodies, {});
    assert.equal(saved.error, undefined);
    const [back] = complainantsFromCase(await api.getCase(caseId), [], null).parties;
    assert.deepEqual(wire(complainantBodies(back)), wire(bodies));
  });

  it("gives back a company accused, with everyone summoned for it, as sent", async () => {
    const api = sandbox();
    const { caseId } = await api.startDraft();
    const bodies = accusedBodies(companyAccused());
    const saved = await saveParty(api, caseId, "accused", bodies, {});
    assert.equal(saved.error, undefined);
    const read = await api.getCase(caseId);
    // One institution on the case, whoever is summoned for it.
    assert.equal(new Set(read.participants.map((p) => p.institution_id)).size, 1);
    const [back] = accusedFromCase(read, []).parties;
    assert.deepEqual(wire(accusedBodies(back)), wire(bodies));
  });

  it("gives back a witness as sent, and refuses the same witness twice", async () => {
    const api = sandbox();
    const { caseId } = await api.startDraft();
    const [body] = witnessBodies(witness());
    await api.addParty(caseId, "witnesses", body);
    const [back] = witnessesFromCase(await api.getCase(caseId), []).parties;
    assert.deepEqual(wire(witnessBodies(back)), wire([body]));
    await rejectsWith(api.addParty(caseId, "witnesses", body), 400, "E07032");
    assert.equal(
      caseFilingErrorMessage(await api.addParty(caseId, "witnesses", body).catch((e) => e)),
      caseFilingCopy.witnessExists
    );
  });

  it("adds the filer as themselves, from their account", async () => {
    const api = sandbox();
    const { caseId } = await api.startDraft();
    const [body] = complainantBodies(complainant(), true);
    await api.addParty(caseId, "complainants", { ...body, person: undefined, self: true });
    const [p] = (await api.getCase(caseId)).participants;
    assert.equal(p.name_at_filing, "Anjali Nair");
  });

  it("refuses a complainant company with no PAN, CIN or declaration", async () => {
    const api = sandbox();
    const { caseId } = await api.startDraft();
    await rejectsWith(
      api.addParty(caseId, "complainants", {
        institution: { entity_name: "Kollam Traders" },
        is_party_in_person: false,
        additional_details: {},
      }),
      400
    );
  });

  it("takes a removed complainant's PoA holder and advocate off, and renumbers", async () => {
    const api = sandbox();
    const { caseId } = await api.startDraft();
    const [body] = complainantBodies(complainant());
    const first = await api.addParty(caseId, "complainants", body);
    const second = await api.addParty(caseId, "complainants", {
      ...body,
      person: { name: "Rajan K. Nair" },
      mobile_numbers: ["+919000000001"],
    });
    const advocate = SANDBOX_ADVOCATES[0];
    await api.addAdvocate(caseId, advocate.id, [first.participantId, second.participantId]);
    await api.addPoaHolder(caseId, {
      person: { name: "Mini Joseph" },
      addresses: [
        {
          line1: "1 Hill Road",
          city: "Kollam",
          pincode: "691001",
          district: "Kollam",
          state: "Kerala",
        },
      ],
      represented_participant_ids: [first.participantId],
      additional_details: {},
    });

    await api.removeParticipant(first.participantId);
    const read = await api.getCase(caseId);
    assert.deepEqual(
      read.participants.map((p) => [p.role, p.ordinal, p.name_at_filing]),
      [["COMPLAINANT", 1, "Rajan K. Nair"]]
    );
    assert.deepEqual(
      read.representations.map((r) => r.client_participant_id),
      [second.participantId]
    );
    assert.deepEqual(read.poa_mandates, []);
  });

  it("takes a PoA holder off when their last mandate is revoked", async () => {
    const api = sandbox();
    const { caseId } = await api.startDraft();
    const [body] = complainantBodies(complainant());
    const c = await api.addParty(caseId, "complainants", body);
    const holder = await api.addPoaHolder(caseId, {
      person: { name: "Mini Joseph" },
      represented_participant_ids: [c.participantId],
      additional_details: {},
    });
    await api.revokePoaMandate(holder.mandateIds[0]);
    const read = await api.getCase(caseId);
    assert.equal(read.participants.some((p) => p.role === "POA_HOLDER"), false);
  });

  it("numbers evidence per type and never reuses a removed row's number", async () => {
    const api = sandbox();
    const { caseId } = await api.startDraft();
    const cheque = (cheque_number: string) =>
      api.addEvidence(caseId, { evidenceType: "CHEQUE", evidenceInfo: { cheque_number } });
    const one = await cheque("000101");
    await api.addEvidence(caseId, { evidenceType: "RETURN_MEMO", evidenceInfo: {} });
    const two = await cheque("000102");
    assert.deepEqual([one.ordinal, two.ordinal], [1, 2]);
    await api.deleteEvidence(one.caseEvidenceId);
    const three = await cheque("000103");
    assert.equal(three.ordinal, 3);
  });

  it("links a scan from its evidence row, and refuses links the backend refuses", async () => {
    const api = sandbox();
    const { caseId } = await api.startDraft();
    const file = new Blob(["scan"], { type: "image/png" });
    const cheque = await api.addEvidence(caseId, { evidenceType: "CHEQUE", evidenceInfo: {} });
    // A scan never carries its evidence id (E07030).
    await rejectsWith(
      api.uploadDocument(caseId, file, "cheque.png", "BOUNCED_CHEQUE", {
        caseEvidenceId: cheque.caseEvidenceId,
      }),
      400,
      "E07030"
    );
    // A notice paper links only to a demand notice (E07029).
    const paper = api.uploadDocument(caseId, file, "dispatch.png", "PROOF_OF_DISPATCH", {
      caseEvidenceId: cheque.caseEvidenceId,
    });
    const refusedPaper: unknown = await paper.catch((e: unknown) => e);
    assert.equal(caseFilingErrorMessage(refusedPaper), caseFilingCopy.noticeLinkFailed);

    const scan = await api.uploadDocument(caseId, file, "cheque.png", "BOUNCED_CHEQUE");
    await api.updateEvidence(cheque.caseEvidenceId, { caseDocumentId: scan.caseDocumentId });
    assert.equal((await api.getCase(caseId)).evidence[0].case_document_id, scan.caseDocumentId);
    await api.deleteDocument(scan.caseDocumentId);
    assert.equal((await api.getCase(caseId)).evidence[0].case_document_id, null);
  });

  it("refuses a file over 10 MB and an empty affidavit", async () => {
    const api = sandbox();
    const { caseId } = await api.startDraft();
    const big = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]);
    await rejectsWith(api.uploadDocument(caseId, big, "big.pdf", "AFFIDAVIT"), 413);
    await rejectsWith(api.saveAffidavit(caseId, "<p>&nbsp;</p>"), 400);
  });

  it("finds approved advocates by name or Bar number, from two characters", async () => {
    const api = sandbox();
    assert.deepEqual(await api.searchAdvocates("K"), []);
    assert.deepEqual(
      (await api.searchAdvocates("k/2204")).map((a) => a.name),
      ["Thomas Kurian"]
    );
  });

  it("names every missing piece, then passes a complete case", async () => {
    const api = sandbox();
    const { caseId } = await api.startDraft();
    const [body] = complainantBodies(complainant());
    const c = await api.addParty(caseId, "complainants", body);
    let result = await api.validateCase(caseId);
    assert.equal(result.isValid, false);
    assert.deepEqual(
      result.errors.map((e) => e.field),
      [
        `participants.${c.participantId}`,
        "participants.accused",
        "evidence.cheque",
        "evidence.return_memo",
        "evidence.legal_demand_notice",
        "details.jurisdiction_limitation",
        "details.adr_other_prayer",
        "affidavit",
      ]
    );

    await api.addAdvocate(caseId, SANDBOX_ADVOCATES[0].id, [c.participantId]);
    await saveParty(api, caseId, "accused", accusedBodies(companyAccused()), {});
    for (const evidenceType of ["CHEQUE", "RETURN_MEMO", "LEGAL_DEMAND_NOTICE"] as const) {
      await api.addEvidence(caseId, { evidenceType, evidenceInfo: {} });
    }
    await api.saveDetails(caseId, "jurisdiction_limitation", {});
    await api.saveDetails(caseId, "adr_other_prayer", {});
    await api.saveAffidavit(caseId, "<p>I solemnly affirm.</p>");
    result = await api.validateCase(caseId);
    assert.deepEqual(result, { isValid: true, errors: [] });
  });
});
