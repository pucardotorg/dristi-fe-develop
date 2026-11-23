import { test } from "node:test";
import assert from "node:assert/strict";

import { blankComplainant, blankNotice, createBlankDraft } from "@/lib/filing/blank";

import { complainantSummaries, noticeSummaries } from "./derive";

/**
 * Preview must list every complainant and every demand notice, not just the first — a
 * filing can carry co-complainants and more than one notice (issue #60).
 */

test("complainantSummaries returns one entry per complainant, labelled in order", () => {
  const draft = createBlankDraft("draft-complainants");
  draft.complainants = [
    { ...blankComplainant(), id: "c1", type: "individual", name: "Asha" },
    { ...blankComplainant(), id: "c2", type: "individual", name: "Biju" },
  ];

  const summaries = complainantSummaries(draft);

  assert.equal(summaries.length, 2);
  assert.deepEqual(
    summaries.map((c) => c.key),
    ["c1", "c2"],
  );
  assert.deepEqual(
    summaries.map((c) => c.label),
    ["Complainant 1", "Complainant 2"],
  );
  assert.deepEqual(
    summaries.map((c) => c.name),
    ["Asha", "Biju"],
  );
});

test("noticeSummaries returns one entry per demand notice, labelled in order", () => {
  const draft = createBlankDraft("draft-notices");
  draft.notices = [
    { ...blankNotice(), id: "n1" },
    { ...blankNotice(), id: "n2" },
  ];

  const summaries = noticeSummaries(draft);

  assert.equal(summaries.length, 2);
  assert.deepEqual(
    summaries.map((n) => n.key),
    ["n1", "n2"],
  );
  assert.deepEqual(
    summaries.map((n) => n.label),
    ["Demand notice 1", "Demand notice 2"],
  );
});
