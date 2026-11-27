"use client";

import * as React from "react";

import { getCaseFilingRepository } from "./data";
import type { SigningPackage } from "./types";

export type SigningPackageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; pkg: SigningPackage | null }
  | { status: "failed"; error: unknown };

/**
 * The case's open signing package, read when the Sign step opens. `null` in `ready` means
 * there is none: the case is not frozen for signing. Nothing is read without a case id
 * (a draft that never reached the backend). Only this tab needs it: other signers' progress
 * is read again on the next visit.
 */
export function useSigningPackage(caseId: string | undefined): {
  state: SigningPackageState;
  reload: () => void;
  /** The case went back to draft: there is no package any more, without asking again. */
  clear: () => void;
} {
  const [state, setState] = React.useState<SigningPackageState>(
    caseId ? { status: "loading" } : { status: "idle" },
  );
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!caseId) return;
    const controller = new AbortController();
    getCaseFilingRepository()
      .getSigningPackage(caseId, controller.signal)
      .then(
        (pkg) => {
          if (!controller.signal.aborted) setState({ status: "ready", pkg });
        },
        (error: unknown) => {
          if (!controller.signal.aborted) setState({ status: "failed", error });
        },
      );
    return () => controller.abort();
  }, [caseId, attempt]);

  const reload = React.useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const clear = React.useCallback(() => setState({ status: "ready", pkg: null }), []);

  return { state, reload, clear };
}
