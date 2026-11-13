"use client";

/**
 * Read the backend case once as a step opens and put its copy on the draft.
 *
 * `apply` decides what to take (see `case-details-read.ts`). A read that fails leaves the
 * browser's copy as it was — Continue still saves it — and a case not created yet (nothing
 * saved so far) has nothing to read.
 *
 * A draft without a `caseId` (sample and batch drafts, older drafts) is never read.
 */

import * as React from "react";

import { isApiError } from "@/lib/api";

import { caseFilingApi, type CaseRead } from "./data/cases-api";
import { useFiling } from "./store";
import type { FilingDraft } from "./types";

export function useLoadFromCase(apply: (read: CaseRead, draft: FilingDraft) => void) {
  const { draft, update } = useFiling();
  const caseId = draft.caseId;

  const applyRef = React.useRef(apply);
  React.useEffect(() => {
    applyRef.current = apply;
  });

  React.useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    caseFilingApi
      .getCase(caseId)
      .then((read) => {
        if (!cancelled) update((d) => applyRef.current(read, d));
      })
      .catch((error) => {
        if (isApiError(error) && (error.kind === "aborted" || error.status === 404)) return;
        console.warn("[filing] couldn't read the step from the case", error);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, update]);
}
