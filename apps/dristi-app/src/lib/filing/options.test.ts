import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NON_DELIVERY_REASON_CODES, NON_DELIVERY_REASONS } from "./options";

describe("NON_DELIVERY_REASON_CODES", () => {
  it("gives every reason the form offers a backend code", () => {
    assert.deepEqual(
      Object.keys(NON_DELIVERY_REASON_CODES).sort(),
      NON_DELIVERY_REASONS.map((o) => o.value).sort()
    );
  });

  it("maps each reason to the backend's code", () => {
    assert.equal(NON_DELIVERY_REASON_CODES["not-available"], "ADDRESSEE_NOT_AVAILABLE");
    assert.equal(NON_DELIVERY_REASON_CODES.incomplete, "ADDRESS_INCOMPLETE_OR_INCORRECT");
    assert.equal(NON_DELIVERY_REASON_CODES.lost, "LOST_IN_TRANSIT");
  });
});
