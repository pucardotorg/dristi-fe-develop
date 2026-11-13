import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "@/lib/api";

import { advocateChanged, endAdvocate, saveAdvocate, withoutComplainant } from "./advocates";

type Call = { op: "add"; advocateId: string; clients: string[] } | { op: "end"; id: string };

function fakeApi(opts: { failAdd?: boolean; goneIds?: string[] } = {}) {
  const calls: Call[] = [];
  let next = 0;
  return {
    calls,
    api: {
      async addAdvocate(_caseId: string, advocateId: string, clients: string[]) {
        calls.push({ op: "add", advocateId, clients });
        if (opts.failAdd) throw new Error("refused");
        return clients.map(() => `r${++next}`);
      },
      async endRepresentation(id: string) {
        calls.push({ op: "end", id });
        if (opts.goneIds?.includes(id)) {
          throw new ApiError({ kind: "http", status: 404, message: "Not found" });
        }
      },
    },
  };
}

describe("saveAdvocate", () => {
  it("adds one representation per client the first time", async () => {
    const { api, calls } = fakeApi();
    const result = await saveAdvocate(api, "case-1", "adv-1", ["c1", "c2"], {});
    assert.deepEqual(calls, [{ op: "add", advocateId: "adv-1", clients: ["c1", "c2"] }]);
    assert.deepEqual(result.representations, { c1: "r1", c2: "r2" });
    assert.equal(advocateChanged("adv-1", ["c2", "c1"], result), false);
  });

  it("ends the representation of a client dropped and adds one for a client added", async () => {
    const { api, calls } = fakeApi();
    const saved = { savedAdvocateId: "adv-1", representations: { c1: "r8", c2: "r9" } };
    const result = await saveAdvocate(api, "case-1", "adv-1", ["c1", "c3"], saved);
    assert.deepEqual(calls, [
      { op: "end", id: "r9" },
      { op: "add", advocateId: "adv-1", clients: ["c3"] },
    ]);
    assert.deepEqual(result.representations, { c1: "r8", c3: "r1" });
  });

  it("replaces every representation when another advocate is chosen", async () => {
    const { api, calls } = fakeApi();
    const saved = { savedAdvocateId: "adv-1", representations: { c1: "r8" } };
    const result = await saveAdvocate(api, "case-1", "adv-2", ["c1"], saved);
    assert.deepEqual(calls, [
      { op: "end", id: "r8" },
      { op: "add", advocateId: "adv-2", clients: ["c1"] },
    ]);
    assert.deepEqual(result, { savedAdvocateId: "adv-2", representations: { c1: "r1" } });
  });

  it("treats a representation the backend no longer has as already ended", async () => {
    const { api } = fakeApi({ goneIds: ["r9"] });
    const saved = { savedAdvocateId: "adv-1", representations: { c1: "r8", c2: "r9" } };
    const result = await saveAdvocate(api, "case-1", "adv-1", ["c1"], saved);
    assert.equal(result.error, undefined);
    assert.deepEqual(result.representations, { c1: "r8" });
  });

  it("on a failed add, records only what is on the case", async () => {
    const { api } = fakeApi({ failAdd: true });
    const saved = { savedAdvocateId: "adv-1", representations: { c1: "r8" } };
    const result = await saveAdvocate(api, "case-1", "adv-1", ["c1", "c2"], saved);
    assert.ok(result.error);
    assert.deepEqual(result.representations, { c1: "r8" });
    assert.equal(advocateChanged("adv-1", ["c1", "c2"], result), true);
  });
});

describe("endAdvocate", () => {
  it("ends every representation the advocate holds", async () => {
    const { api, calls } = fakeApi();
    await endAdvocate(api, { representations: { c1: "r1", c2: "r2" } });
    assert.deepEqual(calls, [
      { op: "end", id: "r1" },
      { op: "end", id: "r2" },
    ]);
  });
});

describe("withoutComplainant", () => {
  it("drops the removed complainant and moves the later ones up", () => {
    const advocates = [
      { id: "x", name: "", barNumber: "", forComplainants: [0, 1, 2] },
      { id: "y", name: "", barNumber: "", forComplainants: [2] },
      { id: "z", name: "", barNumber: "", forComplainants: [1] },
    ];
    withoutComplainant(advocates, 1);
    assert.deepEqual(
      advocates.map((a) => a.forComplainants),
      [[0, 1], [1], []]
    );
  });
});
