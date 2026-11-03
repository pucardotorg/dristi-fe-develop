import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isIndianMobile, toBackendMobile, toNationalMobile } from "./mobile";

describe("toNationalMobile", () => {
  it("keeps a ten-digit number as it is", () => {
    assert.equal(toNationalMobile("9876543210"), "9876543210");
  });

  it("drops the country code, however it is written", () => {
    assert.equal(toNationalMobile("+91 98765 43210"), "9876543210");
    assert.equal(toNationalMobile("+919876543210"), "9876543210");
    assert.equal(toNationalMobile("919876543210"), "9876543210");
  });

  it("drops the country code from a number still being pasted or filled in", () => {
    assert.equal(toNationalMobile("+91 9876"), "9876");
  });

  it("drops the trunk 0, from a mobile or a landline", () => {
    assert.equal(toNationalMobile("09876543210"), "9876543210");
    assert.equal(toNationalMobile("04742233445"), "4742233445");
  });

  it("never gives more than ten digits", () => {
    assert.equal(toNationalMobile("98765432109"), "9876543210");
  });

  it("keeps a number that starts 91 without a country code", () => {
    assert.equal(toNationalMobile("9198765432"), "9198765432");
  });

  it("ignores anything that is not a digit", () => {
    assert.equal(toNationalMobile("98765-abc-43210"), "9876543210");
    assert.equal(toNationalMobile(""), "");
  });
});

describe("isIndianMobile and toBackendMobile", () => {
  it("accepts a ten-digit number starting 6 to 9 and adds +91 for the backend", () => {
    assert.equal(isIndianMobile("9876543210"), true);
    assert.equal(isIndianMobile("4742233445"), false);
    assert.equal(toBackendMobile("9876543210"), "+919876543210");
  });
});
