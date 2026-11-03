import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankComplainant } from "./blank";
import { complainantComplete } from "./selectors";
import type { Complainant } from "./types";

function institution(): Complainant {
  const c = blankComplainant();
  c.type = "institution";
  c.entType = "private-limited";
  c.entName = "Acme Traders Pvt Ltd";
  c.entCinPan = "ABCDE1234F";
  c.entAddr.line1 = "12 MG Road";
  c.rep.name = "Rohan Shah";
  c.rep.mobile = "9876543210";
  return c;
}

describe("complainantComplete", () => {
  it("counts an institution reached through its representative's mobile", () => {
    // The institution form has no complainant mobile; it must not be required.
    assert.equal(complainantComplete(institution()), true);
  });

  it("holds back an institution whose representative has no mobile", () => {
    const c = institution();
    c.rep.mobile = "";
    assert.equal(complainantComplete(c), false);
  });

  it("still requires an individual's own mobile", () => {
    const c = blankComplainant();
    c.name = "Asha Menon";
    c.res.line1 = "4 Beach Road";
    assert.equal(complainantComplete(c), false);
    c.mobile = "9876543210";
    assert.equal(complainantComplete(c), true);
  });
});
