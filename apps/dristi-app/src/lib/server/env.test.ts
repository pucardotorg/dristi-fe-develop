import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readApiOrigin } from "./env";

describe("readApiOrigin", () => {
  it("accepts an http or https origin and normalises it", () => {
    assert.deepEqual(readApiOrigin("http://localhost:8000"), {
      ok: true,
      origin: "http://localhost:8000",
    });
    assert.deepEqual(readApiOrigin("  https://be.dristi-dev.in/  "), {
      ok: true,
      origin: "https://be.dristi-dev.in",
    });
  });

  it("explains a missing value", () => {
    for (const raw of [undefined, "", "   "]) {
      const result = readApiOrigin(raw);
      assert.equal(result.ok, false);
      assert.match(!result.ok ? result.reason : "", /API_ORIGIN is not set/);
    }
  });

  it("rejects values that are not an origin", () => {
    for (const raw of [
      "localhost:8000/x", // parses as scheme "localhost:" — not http(s)
      "not a url",
      "ftp://example.com",
      "http://localhost:8000/api/v1",
      "http://localhost:8000/?a=1",
      "http://localhost:8000/#x",
    ]) {
      assert.equal(readApiOrigin(raw).ok, false, raw);
    }
  });
});
