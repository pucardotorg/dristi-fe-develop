import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBlankDraft } from "./blank";
import { participantSteps, stepForValidationField } from "./validation";

describe("participantSteps", () => {
  it("maps each saved participant id to the step it is entered on", () => {
    const base = createBlankDraft("case-1");
    const draft = {
      ...base,
      complainants: [
        {
          ...base.complainants[0],
          caseParticipantIds: ["c-1"],
          savedPoaHolder: {
            participantId: "poa-1",
            mandateIds: ["m-1"],
            forParticipantId: "c-1",
            body: "{}",
          },
        },
      ],
      accused: [{ ...base.accused[0], caseParticipantIds: ["a-1", "a-2"] }],
      witnesses: [{ ...base.witnesses[0], caseParticipantIds: ["w-1"] }],
    };
    const steps = participantSteps(draft);
    assert.equal(steps.get("c-1"), "complainant");
    assert.equal(steps.get("poa-1"), "complainant");
    assert.equal(steps.get("a-1"), "accused");
    assert.equal(steps.get("a-2"), "accused");
    assert.equal(steps.get("w-1"), "witnesses");
    assert.equal(steps.get("unknown"), undefined);
  });
});

describe("stepForValidationField", () => {
  it("maps the affidavit field to the affidavit step", () => {
    assert.equal(stepForValidationField("affidavit"), "affidavit");
  });

  it("maps participant fields to their step", () => {
    assert.equal(stepForValidationField("participants.accused"), "accused");
    assert.equal(stepForValidationField("participants.complainants"), "complainant");
    // A per-participant id with no message (an advocate / party-in-person gap) is fixed
    // from the complainant.
    assert.equal(
      stepForValidationField("participants.3f1c2a9e-7b4d-4e8a-9c61-2d5f8a0b7e14"),
      "complainant",
    );
  });

  it("routes a per-participant error by its saved id when one is known", () => {
    const byId = new Map([
      ["w-uuid", "witnesses" as const],
      ["a-uuid", "accused" as const],
    ]);
    // The id wins over the message, so a mislabelled message cannot send it to the wrong step.
    assert.equal(
      stepForValidationField("participants.w-uuid", "Accused #1 has no name.", byId),
      "witnesses",
    );
    assert.equal(stepForValidationField("participants.a-uuid", undefined, byId), "accused");
  });

  it("falls back to the role named in the message when the id is not on this draft", () => {
    const id = "participants.3f1c2a9e-7b4d-4e8a-9c61-2d5f8a0b7e14";
    assert.equal(stepForValidationField(id, "Witness #1 has no name or designation."), "witnesses");
    assert.equal(stepForValidationField(id, "Witness #2 has no mobile number."), "witnesses");
    assert.equal(stepForValidationField(id, "Accused #2 has no name.", new Map()), "accused");
    assert.equal(stepForValidationField(id, "Complainant #1 has no name."), "complainant");
  });

  it("maps representation fields to the advocate step", () => {
    assert.equal(stepForValidationField("representations.vakalatnama"), "advocate");
  });

  it("maps evidence fields: cheque and return memo to cheque, notice to demand notice", () => {
    assert.equal(stepForValidationField("evidence.cheque"), "cheque");
    assert.equal(stepForValidationField("evidence.return_memo"), "cheque");
    assert.equal(stepForValidationField("evidence.legal_demand_notice"), "demand-notice");
  });

  it("maps document fields to the documents step", () => {
    assert.equal(stepForValidationField("documents.BOUNCED_CHEQUE"), "documents");
    assert.equal(stepForValidationField("documents.VAKALATNAMA"), "documents");
  });

  it("maps details sections to their step", () => {
    assert.equal(stepForValidationField("details.jurisdiction_limitation"), "jurisdiction");
    assert.equal(stepForValidationField("details.adr_other_prayer"), "adr-prayer");
  });

  it("returns null for an unrecognised field", () => {
    assert.equal(stepForValidationField("something.else"), null);
    assert.equal(stepForValidationField(""), null);
  });
});
