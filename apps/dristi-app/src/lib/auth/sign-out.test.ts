import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { signOutCitizen, type SignOutSteps } from "./sign-out";

/**
 * Steps that record the order they run in. `endSession` resolves on a later microtask,
 * so a local step that ran before the session ended would show up ahead of it in the log.
 */
function recordingSteps(overrides: Partial<SignOutSteps> = {}) {
  const log: string[] = [];
  const steps: SignOutSteps = {
    endSession: async () => {
      await Promise.resolve();
      log.push("endSession");
    },
    clearProfile: () => log.push("clearProfile"),
    clearFilingSession: () => log.push("clearFilingSession"),
    leave: () => log.push("leave"),
    ...overrides,
  };
  return { log, steps };
}

describe("signOutCitizen", () => {
  it("ends the backend session first, then clears local state and leaves", async () => {
    const { log, steps } = recordingSteps();
    await signOutCitizen(steps);
    assert.deepEqual(log, ["endSession", "clearProfile", "clearFilingSession", "leave"]);
  });

  it("waits for the backend session to end before clearing local state", async () => {
    // The cookie that authorises DELETE /sessions must still be present when it runs, so
    // the local steps cannot start until endSession has settled.
    const { log, steps } = recordingSteps();
    const done = signOutCitizen(steps);
    assert.deepEqual(log, [], "nothing runs synchronously before the awaited session end");
    await done;
    assert.equal(log[0], "endSession");
  });

  it("still clears local state and leaves when the backend sign-out fails", async () => {
    // A network error, an already-expired cookie, or sandbox mode with no backend must not
    // strand the person on an authed screen.
    const { log, steps } = recordingSteps({
      endSession: async () => {
        throw new Error("network down");
      },
    });
    await signOutCitizen(steps);
    assert.deepEqual(log, ["clearProfile", "clearFilingSession", "leave"]);
  });

  it("does not reject when the backend sign-out rejects", async () => {
    const { steps } = recordingSteps({
      endSession: () => Promise.reject(new Error("boom")),
    });
    await assert.doesNotReject(signOutCitizen(steps));
  });
});
