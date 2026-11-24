import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBlankDraft } from "./blank";
import type { SavedEvidence } from "./data/cases-api";
import { saveOneCheque, type ChequeEvidenceState } from "./use-cheque-evidence";

/** A stand-in evidence API recording which evidence type was created and which id updated. */
function fakeApi() {
  const calls: Array<{ method: "add" | "update"; type?: string; id?: string }> = [];
  const api = {
    async addEvidence(_caseId: string, input: { evidenceType: string }): Promise<SavedEvidence> {
      calls.push({ method: "add", type: input.evidenceType });
      return {
        caseEvidenceId: `${input.evidenceType}-1`,
        evidenceType: input.evidenceType,
        ordinal: 1,
      };
    },
    async updateEvidence(id: string): Promise<SavedEvidence> {
      calls.push({ method: "update", id });
      return { caseEvidenceId: id, evidenceType: "x", ordinal: 1 };
    },
  };
  return { api, calls };
}

describe("saveOneCheque", () => {
  it("creates both rows once, then PATCHes only the row whose fields changed", async () => {
    const draft = createBlankDraft("draft-1");
    draft.caseId = "case-1";
    // A field for the CHEQUE row and one for the RETURN_MEMO row, so both get created.
    draft.cheques[0].amount = "1000";
    draft.cheques[0].returnDate = "2026-01-10";
    const state: ChequeEvidenceState = new Map();
    const { api, calls } = fakeApi();
    const noop = () => {}; // the draft never catches up with the created ids

    await saveOneCheque("case-1", draft, 0, noop, state, api);
    assert.deepEqual(
      calls,
      [
        { method: "add", type: "CHEQUE" },
        { method: "add", type: "RETURN_MEMO" },
      ],
      "first save creates both rows",
    );

    // Change only a CHEQUE-row field: the RETURN_MEMO row must not be touched.
    calls.length = 0;
    draft.cheques[0].amount = "2000";
    await saveOneCheque("case-1", draft, 0, noop, state, api);
    assert.deepEqual(calls, [{ method: "update", id: "CHEQUE-1" }]);

    // Change only a RETURN_MEMO-row field: now only that row is PATCHed.
    calls.length = 0;
    draft.cheques[0].returnDate = "2026-01-11";
    await saveOneCheque("case-1", draft, 0, noop, state, api);
    assert.deepEqual(calls, [{ method: "update", id: "RETURN_MEMO-1" }]);

    // Nothing changed: no call at all.
    calls.length = 0;
    await saveOneCheque("case-1", draft, 0, noop, state, api);
    assert.deepEqual(calls, []);
  });
});
