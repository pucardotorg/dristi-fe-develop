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
