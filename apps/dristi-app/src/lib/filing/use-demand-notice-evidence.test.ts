import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "@/lib/api";

import { runKeyedSave, type SaveResult } from "./autosave-queue";
import { createBlankDraft } from "./blank";
import type { SavedEvidence } from "./data/cases-api";
import {
  noticeEvidenceStateFor,
  removeNoticeEvidence,
  saveOneNotice,
  type NoticeEvidenceIds,
} from "./use-demand-notice-evidence";

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

  it("recreates a notice whose row was removed on the case, instead of PATCHing it forever", async () => {
    const draft = createBlankDraft("draft-gone");
    draft.caseId = "case-gone";
    draft.notices[0].tracking = "RX123456789IN";
    // A stale id for a row the case no longer has: updating it 404s.
    draft.notices[0].noticeEvidenceId = "stale-id";
    const createdIds: NoticeEvidenceIds = new Map();
    const calls: string[] = [];
    const api = {
      async addEvidence(): Promise<SavedEvidence> {
        calls.push("add");
        return { caseEvidenceId: "ev-new", evidenceType: "LEGAL_DEMAND_NOTICE", ordinal: 1 };
      },
      async updateEvidence(id: string): Promise<SavedEvidence> {
        calls.push(`update:${id}`);
        throw new ApiError({ kind: "http", status: 404, message: "gone" });
      },
    };

    const result = await saveOneNotice("case-gone", draft, 0, () => {}, createdIds, api);
    assert.equal(result, "ev-new", "the row is recreated and its new id returned");
    assert.deepEqual(calls, ["update:stale-id", "add"]);
    assert.equal(createdIds.get(draft.notices[0].id), "ev-new");
  });
});

describe("removeNoticeEvidence", () => {
  it("deletes the row an in-flight save created, even before the draft holds its id", async () => {
    const caseId = "case-remove-notice-1";
    const draft = createBlankDraft("draft-remove-notice-1");
    draft.caseId = caseId;
    draft.notices[0].tracking = "RX123456789IN";
    const { api } = fakeApi();

    // The save records the created id into the case's module-level state.
    await saveOneNotice(caseId, draft, 0, () => {}, noticeEvidenceStateFor(caseId), api);

    const deleted: string[] = [];
    const delApi = {
      async deleteEvidence(id: string) {
        deleted.push(id);
      },
    };
    // The notice passed in carries no id; removal must find the created one in module state.
    removeNoticeEvidence(caseId, { id: draft.notices[0].id, noticeEvidenceId: undefined }, delApi);
    await settle(() => deleted.length > 0);
    assert.deepEqual(deleted, ["ev-1"]);
  });

  it("waits for a save still running before deleting", async () => {
    const caseId = "case-remove-notice-2";
    const c = controllable();
    void runKeyedSave(`${caseId}:notice`, c.perform, () => "sig");

    const deleted: string[] = [];
    const delApi = {
      async deleteEvidence(id: string) {
        deleted.push(id);
      },
    };
    removeNoticeEvidence(caseId, { id: "notice-x", noticeEvidenceId: "ev-9" }, delApi);

    await settle(() => false);
    assert.equal(deleted.length, 0, "nothing is deleted while the save is still running");

    c.finish(0, { ok: true });
    await settle(() => deleted.length > 0);
    assert.deepEqual(deleted, ["ev-9"], "the row is deleted once the save has settled");
  });
});
