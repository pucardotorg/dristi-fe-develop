import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isLocale, LOCALE_COOKIE, parseLocale, serializeLocaleCookie } from "./cookie";

describe("locale cookie", () => {
  it("accepts every supported locale", () => {
    for (const locale of ["en", "ml", "hi", "gu", "pa"]) assert.equal(isLocale(locale), true);
  });

  it("rejects unknown, empty and non-string values", () => {
    for (const value of ["fr", "", "EN", "hi-IN", undefined, 42]) assert.equal(isLocale(value), false);
  });

  it("falls back to English for a missing or stale cookie", () => {
    assert.equal(parseLocale(undefined), "en");
    assert.equal(parseLocale("xx"), "en");
    assert.equal(parseLocale("hi"), "hi");
  });

  it("writes a site-wide, year-long cookie", () => {
    assert.equal(
      serializeLocaleCookie("hi"),
      `${LOCALE_COOKIE}=hi; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
  });
});
