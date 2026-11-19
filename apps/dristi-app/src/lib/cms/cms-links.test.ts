import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cmsLinkKind } from "./cms-links";

describe("cmsLinkKind", () => {
  it("treats paths in this app as internal", () => {
    assert.equal(cmsLinkKind("/citizen"), "internal");
    assert.equal(cmsLinkKind("/support?topic=filing"), "internal");
  });

  it("treats other sites as external, including protocol-relative links", () => {
    assert.equal(cmsLinkKind("https://example.com"), "external");
    assert.equal(cmsLinkKind("HTTP://example.com"), "external");
    assert.equal(cmsLinkKind("//example.com/page"), "external");
  });

  it("leaves mail, phone and in-page links to the browser", () => {
    assert.equal(cmsLinkKind("mailto:help@example.com"), "other");
    assert.equal(cmsLinkKind("tel:+911234567890"), "other");
    assert.equal(cmsLinkKind("#contact"), "other");
  });
});
