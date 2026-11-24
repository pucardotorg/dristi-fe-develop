import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBlankDraft } from "./blank";
import type { SavedEvidence } from "./data/cases-api";
import { saveOneNotice, type NoticeEvidenceIds } from "./use-demand-notice-evidence";

/** A stand-in evidence API that records whether each call created or updated a row. */
function fakeApi() {
  const calls: Array<{ method: "add" | "update"; id?: string }> = [];
  let seq = 0;
  const api = {
    async addEvidence(): Promise<SavedEvidence> {
      seq += 1;
      calls.push({ method: "add" });
      return { caseEvidenceId: `ev-${seq}`, evidenceType: "LEGAL_DEMAND_NOTICE", ordinal: seq };
    },
    async updateEvidence(id: string): Promise<SavedEvidence> {
      calls.push({ method: "update", id });
      return { caseEvidenceId: id, evidenceType: "LEGAL_DEMAND_NOTICE", ordinal: 1 };
    },
  };
  return { api, calls };
}

describe("saveOneNotice", () => {
  it("creates the row once, then updates it even before the draft holds the new id", async () => {
    const draft = createBlankDraft("draft-1");
    draft.caseId = "case-1";
    // Give the notice something worth saving, so the first save creates a row.
    draft.notices[0].tracking = "RX123456789IN";
    const createdIds: NoticeEvidenceIds = new Map();
    const { api, calls } = fakeApi();
    // A no-op update simulates a second autosave firing before the draft caught up with the id.
    const noop = () => {};

    const first = await saveOneNotice("case-1", draft, 0, noop, createdIds, api);
    assert.equal(first, "ev-1");
    assert.deepEqual(calls, [{ method: "add" }], "first save creates the row");

    const second = await saveOneNotice("case-1", draft, 0, noop, createdIds, api);
    assert.equal(second, "ev-1", "the id is remembered across saves");
    assert.deepEqual(
      calls,
      [{ method: "add" }, { method: "update", id: "ev-1" }],
      "the second save updates the same row rather than creating a duplicate",
    );
  });

  it("adds no row for an untouched notice", async () => {
    const draft = createBlankDraft("draft-2");
    draft.caseId = "case-2";
    const createdIds: NoticeEvidenceIds = new Map();
    const { api, calls } = fakeApi();

    const result = await saveOneNotice("case-2", draft, 0, () => {}, createdIds, api);
    assert.equal(result, undefined);
    assert.deepEqual(calls, []);
  });
});
