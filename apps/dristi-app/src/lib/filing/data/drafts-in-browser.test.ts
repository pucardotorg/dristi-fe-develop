/**
 * Filing drafts stay in this browser in every build until they have a backend (#52). Before
 * the fix, an `api` build handed them to the empty `HttpFilingRepository`, so "Start a new
 * filing" stopped at "Drafts aren't connected yet" although each step saves to the backend
 * case. Each test file runs in its own process, so the settings below reach only this file.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

test("an api build keeps filing drafts in the browser", async () => {
  process.env.NEXT_PUBLIC_DATA_SOURCE = "api";
  process.env.NEXT_PUBLIC_AUTH_SOURCE = "api";
  // The browser store refuses to start without a window; it opens IndexedDB only when used.
  Object.assign(globalThis, { window: globalThis });

  const { DATA_SOURCE } = await import("../../data/source");
  const { getRepository, getCaseFilingRepository } = await import("./index");
  const { IndexedDbCaseFilingRepository, IndexedDbFilingRepository } = await import("./indexeddb");

  assert.equal(DATA_SOURCE, "api");
  assert.ok(getRepository() instanceof IndexedDbFilingRepository);
  assert.equal(getRepository(), getRepository(), "one store for the whole page");
  // The backend case is unchanged: with real sign-in it is the backend, not the sandbox.
  assert.ok(!(getCaseFilingRepository() instanceof IndexedDbCaseFilingRepository));
});
