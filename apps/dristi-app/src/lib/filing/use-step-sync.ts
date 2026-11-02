"use client";

/**
 * Save a step to the backend case when it opens and when it closes.
 *
 * Opening catches up whatever a reload or a failure left behind; closing (Continue, Back
 * or a jump from the rail alike) is the save itself. One save runs at a time per case and
 * step: asking during one queues one more pass rather than a second save in parallel,
 * which could add the same party twice.
 *
 * A draft without a `caseId` (batch drafts, older drafts) is never sent anywhere.
 */

import * as React from "react";

import { useFiling } from "./store";
import type { FilingDraft } from "./types";

type StepSave = () => Promise<void>;

const running = new Map<string, { again: boolean; save: StepSave }>();

/**
 * Run one save of `step` for `caseId`, or, if one is running, have it run once more with
 * this `save` (the newest, so a step opened again is saved with its own edits).
 */
export async function runStepSave(caseId: string, step: string, save: StepSave) {
  const key = `${caseId}:${step}`;
  const current = running.get(key);
  if (current) {
    current.again = true;
    current.save = save;
    return;
  }
  const run = { again: false, save };
  running.set(key, run);
  try {
    do {
      run.again = false;
      await run.save();
    } while (run.again);
  } finally {
    running.delete(key);
  }
}

/**
 * `save` reads the draft through `latest()`, which stays current after the step has
 * closed, and returns once the step is saved. The returned function saves again — the
 * step's "Try again".
 */
export function useStepSync(
  step: string,
  save: (latest: () => FilingDraft, caseId: string) => Promise<void>
) {
  const { latest } = useFiling();

  const saveRef = React.useRef(save);
  React.useEffect(() => {
    saveRef.current = save;
  });

  const sync = React.useCallback(async () => {
    const caseId = latest().caseId;
    if (!caseId) return;
    const current = saveRef.current;
    await runStepSave(caseId, step, () => current(latest, caseId));
  }, [step, latest]);

  React.useEffect(() => {
    void sync();
    return () => {
      void sync();
    };
  }, [sync]);

  return sync;
}
