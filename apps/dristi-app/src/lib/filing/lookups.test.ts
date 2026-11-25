import assert from "node:assert/strict";
import { test } from "node:test";

import { pinLookupFill } from "./lookups";

const STATES = ["Karnataka", "Delhi", "Tamil Nadu"] as const;
const hit = (pin: string, district: string, state: string) => ({ pin, district, state });

test("fills both district and state when they are blank", () => {
  const fill = pinLookupFill(
    hit("560001", "Bengaluru", "Karnataka"),
    { district: "", state: "" },
    null,
    STATES,
  );
  assert.deepEqual(fill, {
    district: "Bengaluru",
    state: "Karnataka",
    filled: { district: true, state: true },
  });
});

test("leaves saved values alone when the PIN has not changed (first load)", () => {
  // appliedPin equals the lookup's PIN: a revisit's own lookup must not overwrite.
  const fill = pinLookupFill(
    hit("560001", "Bengaluru", "Karnataka"),
    { district: "Bengaluru", state: "Karnataka" },
    "560001",
    STATES,
  );
  assert.equal(fill, null);
});

test("refreshes district and state when the PIN changes (issue #58)", () => {
  // The old area was saved under 560001; the person now types a Delhi PIN.
  const fill = pinLookupFill(
    hit("110001", "New Delhi", "Delhi"),
    { district: "Bengaluru", state: "Karnataka" },
    "560001",
    STATES,
  );
  assert.deepEqual(fill, {
    district: "New Delhi",
    state: "Delhi",
    filled: { district: true, state: true },
  });
});

test("still fills a blank field on first load even when the PIN has not changed", () => {
  const fill = pinLookupFill(
    hit("560001", "Bengaluru", "Karnataka"),
    { district: "", state: "Karnataka" },
    "560001",
    STATES,
  );
  assert.deepEqual(fill, {
    district: "Bengaluru",
    state: "Karnataka",
    filled: { district: true, state: false },
  });
});

test("keeps the old state when the lookup's spelling is not an offered option", () => {
  const fill = pinLookupFill(
    hit("110001", "New Delhi", "NCT of Delhi"),
    { district: "Bengaluru", state: "Karnataka" },
    "560001",
    STATES,
  );
  assert.deepEqual(fill, {
    district: "New Delhi",
    state: "Karnataka",
    filled: { district: true, state: false },
  });
});

test("matches the state spelling case- and space-insensitively", () => {
  const fill = pinLookupFill(
    hit("600001", "Chennai", "  tamil nadu "),
    { district: "", state: "" },
    null,
    STATES,
  );
  assert.equal(fill?.state, "Tamil Nadu");
});
