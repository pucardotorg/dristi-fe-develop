import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runKeyedSave, type SaveResult } from "./autosave-queue";
import { createBlankDraft } from "./blank";
import type { SavedEvidence } from "./data/cases-api";
import {
  chequeEvidenceStateFor,
  removeChequeEvidence,
  saveOneCheque,
  type ChequeEvidenceState,
} from "./use-cheque-evidence";

/** Let queued microtasks run until `done` holds, or give up after a bound. */
async function settle(done: () => boolean) {
  for (let i = 0; i < 50 && !done(); i += 1) await Promise.resolve();
}

/** A save pass that resolves only when the test hands it a result. */
function controllable() {
  const resolvers: Array<(result: SaveResult) => void> = [];
  const perform = () => new Promise<SaveResult>((resolve) => resolvers.push(resolve));
  return { perform, finish: (i: number, r: SaveResult) => resolvers[i](r) };
}

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

describe("removeChequeEvidence", () => {
  it("deletes the rows an in-flight save created, even before the draft holds their ids", async () => {
    // A unique case id per test: the module-level state is keyed by case and never cleared.
    const caseId = "case-remove-1";
    const draft = createBlankDraft("draft-remove-1");
    draft.caseId = caseId;
    draft.cheques[0].amount = "1000"; // a CHEQUE-row field, so one row is created
    const { api } = fakeApi();
    const noop = () => {}; // the draft never catches up with the created id

    // The save records the created id into the case's module-level state.
    await saveOneCheque(caseId, draft, 0, noop, chequeEvidenceStateFor(caseId), api);

    const deleted: string[] = [];
    const delApi = {
      async deleteEvidence(id: string) {
        deleted.push(id);
      },
    };
    // The cheque passed in carries no ids (the draft has not caught up); removal must still
    // find the created id in the module state and take the row off the case.
    removeChequeEvidence(
      caseId,
      { id: draft.cheques[0].id, chequeEvidenceId: undefined, returnMemoEvidenceId: undefined },
      delApi,
    );
    await settle(() => deleted.length > 0);
    assert.deepEqual(deleted, ["CHEQUE-1"]);
  });

  it("waits for a save still running before deleting", async () => {
    const caseId = "case-remove-2";
    const c = controllable();
    // A save is in flight on this case's cheque queue.
    void runKeyedSave(`${caseId}:cheque`, c.perform, () => "sig");

    const deleted: string[] = [];
    const delApi = {
      async deleteEvidence(id: string) {
        deleted.push(id);
      },
    };
    removeChequeEvidence(
      caseId,
      { id: "cheque-x", chequeEvidenceId: "CHEQUE-9", returnMemoEvidenceId: undefined },
      delApi,
    );

    await settle(() => false);
    assert.equal(deleted.length, 0, "nothing is deleted while the save is still running");

    c.finish(0, { ok: true });
    await settle(() => deleted.length > 0);
    assert.deepEqual(deleted, ["CHEQUE-9"], "the row is deleted once the save has settled");
  });
});
