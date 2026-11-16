import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError, parseErrorBody } from "@/lib/api/errors";

import { caseFilingErrorMessage } from "./data/cases-api";
import { partyFieldMessage } from "./data/party-field-errors";

/** A 400 from the backend with these `{ code, field }` errors, parsed as the client does. */
function refused(...errors: Array<{ code: string; field: string }>): ApiError {
  const parsed = parseErrorBody({
    errors: errors.map((e) => ({ ...e, message: "Backend wording." })),
  });
  return new ApiError({ kind: "http", status: 400, ...parsed });
}

describe("partyFieldMessage", () => {
  it("names a repeated mobile or email rather than calling it invalid", () => {
    assert.equal(
      partyFieldMessage(refused({ code: "E07033", field: "mobile_numbers[1]" })),
      "The same mobile number is entered twice. Remove the repeat."
    );
    assert.equal(
      partyFieldMessage(refused({ code: "E07033", field: "email_addresses[1]" })),
      "The same email is entered twice. Remove the repeat."
    );
  });

  it("names which mobile number or email is not valid", () => {
    assert.equal(
      partyFieldMessage(refused({ code: "E00001", field: "mobile_numbers[0]" })),
      "The mobile number isn't valid. Enter a 10-digit Indian mobile number."
    );
    assert.equal(
      partyFieldMessage(refused({ code: "E00001", field: "email_addresses[1]" })),
      "The second email isn't a valid email address."
    );
  });

  it("asks for an address, and for what one address is missing", () => {
    assert.equal(
      partyFieldMessage(refused({ code: "E00002", field: "addresses" })),
      "Add an address to save this to your case."
    );
    assert.equal(
      partyFieldMessage(refused({ code: "E00002", field: "addresses[1].police_station" })),
      "Add the police station to the second address to save this to your case."
    );
  });

  it("says when it is the company's own contact, however it was sent", () => {
    const station = "institution.addresses[0].police_station";
    assert.equal(
      partyFieldMessage(refused({ code: "E00002", field: station })),
      "Add the police station to the company's address to save this to your case."
    );
    const phone = "institution_contacts.mobile_numbers[2]";
    assert.equal(
      partyFieldMessage(refused({ code: "E00001", field: phone })),
      "The company's third phone number isn't valid. Check it and try again."
    );
    assert.equal(
      partyFieldMessage(refused({ code: "E00002", field: "institution_contacts.addresses" })),
      "Add the company's address to save this to your case."
    );
  });

  it("explains the no-contact declaration sent alongside a contact", () => {
    const error = refused({ code: "E00001", field: "contact_details_unknown_declared" });
    assert.match(partyFieldMessage(error) ?? "", /withdraw the declaration/);
  });

  it("leaves a field sent in error, or one it does not know, to the backend's wording", () => {
    const sentInError = refused({ code: "E07023", field: "mobile_numbers" });
    assert.equal(partyFieldMessage(sentInError), undefined);
    assert.equal(partyFieldMessage(refused({ code: "E00001", field: "person.age" })), undefined);
  });

  it("is what the case-filing message shows for a refused contact", () => {
    assert.equal(
      caseFilingErrorMessage(refused({ code: "E07033", field: "mobile_numbers[1]" })),
      "The same mobile number is entered twice. Remove the repeat."
    );
    assert.equal(
      caseFilingErrorMessage(refused({ code: "E00001", field: "person.age" })),
      "Backend wording."
    );
  });
});
