import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readApiBaseUrl } from "./env";

describe("readApiBaseUrl", () => {
  it("accepts an http or https URL and drops the trailing slash", () => {
    assert.deepEqual(readApiBaseUrl("http://localhost:8000/api/v1"), {
      ok: true,
      baseUrl: "http://localhost:8000/api/v1",
    });
    assert.deepEqual(readApiBaseUrl("  https://be.dristi-dev.in/api/v1/  "), {
      ok: true,
      baseUrl: "https://be.dristi-dev.in/api/v1",
    });
    // A bare origin is legal: the API then lives at the root.
    assert.deepEqual(readApiBaseUrl("https://api.example.org/"), {
      ok: true,
      baseUrl: "https://api.example.org",
    });
  });

  it("explains a missing value", () => {
    for (const raw of [undefined, "", "   "]) {
      const result = readApiBaseUrl(raw);
      assert.equal(result.ok, false);
      assert.match(!result.ok ? result.reason : "", /API_BASE_URL is not set/);
    }
  });

  it("rejects values that are not a plain http(s) URL", () => {
    for (const raw of [
      "localhost:8000/api/v1", // parses as scheme "localhost:" — not http(s)
      "not a url",
      "ftp://example.com/api",
      "http://localhost:8000/api/v1?a=1",
      "http://localhost:8000/api/v1#x",
      "http://user:pass@localhost:8000/api/v1",
    ]) {
      assert.equal(readApiBaseUrl(raw).ok, false, raw);
    }
  });
});
