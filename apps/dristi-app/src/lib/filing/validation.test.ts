import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { stepForValidationField } from "./validation";

describe("stepForValidationField", () => {
  it("maps the affidavit field to the affidavit step", () => {
    assert.equal(stepForValidationField("affidavit"), "affidavit");
  });

  it("maps participant fields to their step", () => {
    assert.equal(stepForValidationField("participants.accused"), "accused");
    assert.equal(stepForValidationField("participants.complainants"), "complainant");
    // A per-participant id (an advocate / party-in-person gap) is fixed from the complainant.
    assert.equal(
      stepForValidationField("participants.3f1c2a9e-7b4d-4e8a-9c61-2d5f8a0b7e14"),
      "complainant"
    );
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
