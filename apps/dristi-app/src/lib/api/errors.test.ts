import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readCookie } from "./csrf";
import { unwrapEnvelope } from "./envelope";
import { ApiError, parseErrorBody, parseRetryAfter } from "./errors";

const META = { timestamp: "2026-10-14T10:00:00+05:30", app_version: "abc", spec_version: "1.0" };

describe("parseErrorBody", () => {
  it("uses DRF's detail as the message", () => {
    assert.deepEqual(parseErrorBody({ detail: "Registration is not complete.", meta: META }), {
      message: "Registration is not complete.",
      code: null,
      codes: [],
      fieldErrors: {},
    });
  });

  it("keeps a machine-readable code", () => {
    assert.equal(parseErrorBody({ detail: "x", code: "upstream_timeout" }).code, "upstream_timeout");
  });

  it("flattens nested field errors to dotted paths and skips meta", () => {
    const parsed = parseErrorBody({
      mobile_number: ["Enter a valid mobile number."],
      address: { pincode: ["Enter 6 digits."] },
      witnesses: [{}, { name: ["This field is required."] }],
      meta: META,
    });
    assert.deepEqual(parsed.fieldErrors, {
      mobile_number: ["Enter a valid mobile number."],
      "address.pincode": ["Enter 6 digits."],
      "witnesses.1.name": ["This field is required."],
    });
  });

  it("falls back to the first non-field error, then a generic sentence", () => {
    assert.equal(
      parseErrorBody({ non_field_errors: ["Invalid OTP."] }).message,
      "Invalid OTP.",
    );
    assert.equal(parseErrorBody("<html>Bad gateway</html>").message, "Something went wrong. Please try again.");
    assert.equal(parseErrorBody(null).message, "Something went wrong. Please try again.");
  });
});

describe("parseErrorBody — the standard errors[] shape", () => {
  it("prefers the request-level message and keeps every code", () => {
    const parsed = parseErrorBody({
      errors: [
        { code: "E01003", message: "Invalid credentials." },
        { code: "E00002", message: "This field is required.", field: "mobile_number" },
      ],
      meta: META,
    });
    assert.equal(parsed.message, "Invalid credentials.");
    assert.equal(parsed.code, "E01003");
    assert.deepEqual(parsed.codes, ["E01003", "E00002"]);
    assert.deepEqual(parsed.fieldErrors, { mobile_number: ["This field is required."] });
  });

  it("maps dotted and indexed field paths to the flattened keys", () => {
    const parsed = parseErrorBody({
      errors: [
        { code: "E00002", message: "This field is required.", field: "profile.bar_registration_id" },
        { code: "E00001", message: "Unsupported type.", field: "documents[0].file" },
        { code: "E01011", message: "Too short.", field: "password" },
        { code: "E01011", message: "Too common.", field: "password" },
      ],
    });
    assert.deepEqual(parsed.fieldErrors, {
      "profile.bar_registration_id": ["This field is required."],
      "documents.0.file": ["Unsupported type."],
      password: ["Too short.", "Too common."],
    });
    // No request-level message: the first field's message stands in.
    assert.equal(parsed.message, "This field is required.");
  });

  it("survives malformed items", () => {
    const parsed = parseErrorBody({ errors: [null, "x", { message: 3 }] });
    assert.equal(parsed.message, "Something went wrong. Please try again.");
    assert.deepEqual(parsed.codes, []);
  });
});

describe("ApiError", () => {
  it("exposes the first message for a field", () => {
    const error = new ApiError({
      kind: "http",
      status: 400,
      message: "x",
      fieldErrors: { otp: ["Invalid OTP.", "Second"] },
    });
    assert.equal(error.fieldError("otp"), "Invalid OTP.");
    assert.equal(error.fieldError("missing"), undefined);
    assert.equal(error.hasCode("E01013"), false);
    assert.equal(
      new ApiError({ kind: "http", status: 403, message: "x", codes: ["E01013"] }).hasCode("E01013"),
      true,
    );
    assert.equal(error.name, "ApiError");
    assert.ok(error instanceof Error);
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds and HTTP dates", () => {
    assert.equal(parseRetryAfter("30"), 30);
    const now = Date.parse("2026-10-14T10:00:00Z");
    assert.equal(parseRetryAfter("Wed, 14 Oct 2026 10:00:45 GMT", now), 45);
    assert.equal(parseRetryAfter("Wed, 14 Oct 2026 09:00:00 GMT", now), 0);
    assert.equal(parseRetryAfter(null), null);
    assert.equal(parseRetryAfter("soon"), null);
  });
});

describe("unwrapEnvelope", () => {
  it("strips meta from an object", () => {
    assert.deepEqual(unwrapEnvelope({ id: "1", name: "Kochi", meta: META }), {
      data: { id: "1", name: "Kochi" },
      meta: META,
    });
  });

  it("unwraps a wrapped list or scalar", () => {
    assert.deepEqual(unwrapEnvelope({ data: [1, 2], meta: META }), { data: [1, 2], meta: META });
    assert.deepEqual(unwrapEnvelope({ data: "ok", meta: META }), { data: "ok", meta: META });
  });

  it("keeps a paginated page intact", () => {
    const page = { count: 1, next: null, previous: null, results: [{ id: "1" }] };
    assert.deepEqual(unwrapEnvelope({ ...page, meta: META }), { data: page, meta: META });
  });

  it("passes through bodies without an envelope", () => {
    assert.deepEqual(unwrapEnvelope({ status: "ok" }), { data: { status: "ok" }, meta: null });
    assert.deepEqual(unwrapEnvelope(null), { data: null, meta: null });
  });
});

describe("readCookie", () => {
  it("finds a cookie by exact name", () => {
    const jar = "sessionid=abc; csrftoken=t%3D1; xcsrftoken=wrong";
    assert.equal(readCookie("csrftoken", jar), "t=1");
    assert.equal(readCookie("sessionid", jar), "abc");
    assert.equal(readCookie("missing", jar), null);
    assert.equal(readCookie("csrftoken", ""), null);
  });
});
