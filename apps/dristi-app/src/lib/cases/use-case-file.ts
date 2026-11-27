"use client";

import * as React from "react";

import { isNotIntegratedError } from "@/lib/data/source";

import { getCasesRepository } from "./data";
import type { CaseFileDocument } from "./types";

export type CaseFileState =
  | { status: "loading" }
  | { status: "ready"; documents: CaseFileDocument[] }
  /** The backend doesn't answer `getCaseFile` yet: a known state, not a failure. */
  | { status: "not-connected" }
  | { status: "error" };

/** A case's case file documents, read through the cases repository. */
export function useCaseFile(caseId: string): CaseFileState {
  /* The last answer and the case it was for, so a new case reads as loading until its
     own answer arrives, without resetting state inside the effect. */
  const [answer, setAnswer] = React.useState<{ caseId: string; state: CaseFileState } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getCasesRepository()
      .getCaseFile(caseId)
      .then((documents) => {
        if (!cancelled) setAnswer({ caseId, state: { status: "ready", documents } });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isNotIntegratedError(error)) {
          // The missing method goes to the console for whoever connects it.
          console.warn(String(error));
          setAnswer({ caseId, state: { status: "not-connected" } });
        } else {
          setAnswer({ caseId, state: { status: "error" } });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  return answer?.caseId === caseId ? answer.state : { status: "loading" };
}
