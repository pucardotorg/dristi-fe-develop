import assert from "node:assert/strict";
import { test } from "node:test";

import {
  awaitKeyedSave,
  createCoalescingSave,
  runKeyedSave,
  type SaveResult,
} from "./autosave-queue";

/** Let queued microtasks run until `done` holds, or give up after a bound. */
async function settle(done: () => boolean) {
  for (let i = 0; i < 50 && !done(); i += 1) await Promise.resolve();
}

/** A `perform` whose each pass resolves only when the test hands it a result. */
function controllable() {
  const resolvers: Array<(result: SaveResult) => void> = [];
  let calls = 0;
  const perform = () => {
    calls += 1;
    return new Promise<SaveResult>((resolve) => resolvers.push(resolve));
  };
  return {
    perform,
    get calls() {
      return calls;
    },
    finish: (index: number, result: SaveResult) => resolvers[index](result),
  };
}

test("runs one save at a time and collapses overlapping calls into one trailing pass", async () => {
  const c = controllable();
  const save = createCoalescingSave(c.perform);

  const first = save();
  assert.equal(c.calls, 1, "the first call starts a pass");

  // Two more calls arrive while the first pass is still running.
  const second = save();
  const third = save();
  assert.equal(c.calls, 1, "no second pass starts while the first is in flight");

  c.finish(0, { ok: true });
  await settle(() => c.calls === 2);
  assert.equal(c.calls, 2, "exactly one trailing pass runs for the calls made mid-save");

  c.finish(1, { ok: false, error: "nope" });

  assert.deepEqual(await first, { ok: true }, "the first caller gets the first pass");
  assert.deepEqual(
    await second,
    { ok: false, error: "nope" },
    "later callers get the trailing pass",
  );
  assert.deepEqual(await third, { ok: false, error: "nope" });
});

test("a call after the queue drains starts a fresh pass", async () => {
  const c = controllable();
  const save = createCoalescingSave(c.perform);

  const first = save();
  c.finish(0, { ok: true });
  assert.deepEqual(await first, { ok: true });

  const second = save();
  await settle(() => c.calls === 2);
  assert.equal(c.calls, 2, "nothing was pending, so this is a new pass");
  c.finish(1, { ok: true });
  assert.deepEqual(await second, { ok: true });
});

test("serial awaited calls each run their own pass", async () => {
  const c = controllable();
  const save = createCoalescingSave(c.perform);

  for (let i = 0; i < 3; i += 1) {
    const pass = save();
    c.finish(i, { ok: true });
    await pass;
  }
  assert.equal(c.calls, 3);
});

// Each test below uses its own key, so the module-level registry never carries state between
// them (the registry is keyed by case + step and is never cleared, as in the real app).

test("runKeyedSave runs one pass at a time per key, even as the driving step is replaced", async () => {
  const key = "case-keyed-1:cheque";
  const first = controllable();
  const second = controllable();

  // A save started by one mount of the step.
  const a = runKeyedSave(key, first.perform, () => "sig-1");
  assert.equal(first.calls, 1, "the first save starts a pass");

  // The step unmounts and mounts again; its newest save is registered and asked for while the
  // first is still in flight. It must not start a parallel pass (which would POST a row twice).
  const b = runKeyedSave(key, second.perform, () => "sig-2");
  assert.equal(second.calls, 0, "no second pass starts while the first is in flight");

  first.finish(0, { ok: true });
  await settle(() => second.calls === 1);
  assert.equal(second.calls, 1, "the newest save runs only once the first has finished");
  second.finish(0, { ok: true });
  await Promise.all([a, b]);
});

test("runKeyedSave skips a pass whose signature is unchanged since the last that stuck", async () => {
  const key = "case-keyed-2:notice";
  const c = controllable();

  const first = runKeyedSave(key, c.perform, () => "same");
  c.finish(0, { ok: true });
  assert.deepEqual(await first, { ok: true });
  assert.equal(c.calls, 1);

  // Same signature: nothing to send, so no pass runs.
  assert.deepEqual(await runKeyedSave(key, c.perform, () => "same"), { ok: true });
  assert.equal(c.calls, 1, "an unchanged step is not saved again");
});

test("awaitKeyedSave waits for a save in flight, and returns at once when none is", async () => {
  const key = "case-keyed-3:cheque";

  // Nothing running yet.
  let idleResolved = false;
  await awaitKeyedSave(key).then(() => {
    idleResolved = true;
  });
  assert.equal(idleResolved, true, "an idle key resolves immediately");

  const c = controllable();
  runKeyedSave(key, c.perform, () => "sig");
  let waited = false;
  void awaitKeyedSave(key).then(() => {
    waited = true;
  });
  await settle(() => false);
  assert.equal(waited, false, "it does not resolve while the save is still running");

  c.finish(0, { ok: true });
  await settle(() => waited);
  assert.equal(waited, true, "it resolves once the save has settled");
});
