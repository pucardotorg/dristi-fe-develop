import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NotIntegratedError } from "@/lib/data/source";

import { loadFailure } from "./load-failure";

describe("loadFailure", () => {
  it("marks a read the backend doesn't answer yet as not connected", () => {
    assert.deepEqual(
      loadFailure(new NotIntegratedError("tasks.listPeople"), "Could not load tasks"),
      {
        message: "tasks.listPeople is not connected to the backend yet",
        notConnected: true,
      },
    );
  });

  it("keeps any other failure a failure, which a retry may fix", () => {
    assert.deepEqual(loadFailure(new Error("Network request failed"), "Could not load tasks"), {
      message: "Network request failed",
      notConnected: false,
    });
  });

  it("names a failure that isn't an Error", () => {
    assert.deepEqual(loadFailure("boom", "Could not load tasks"), {
      message: "Could not load tasks",
      notConnected: false,
    });
  });
});
