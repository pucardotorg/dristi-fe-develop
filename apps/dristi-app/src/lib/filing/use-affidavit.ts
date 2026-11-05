"use client";

/**
 * Saves the case's sworn affidavit to the backend when the filer clicks Continue.
 *
 * The affidavit has its own endpoint (`PUT /cases/{id}/affidavit`, spec 0021 §5.4), not a
 * details section. Whatever the editor holds is sent as-is — including an affidavit the
 * filer has cleared: the backend is the one gate on emptiness (it refuses text that renders
 * as nothing), and its error is surfaced to the filer rather than the save being skipped
 * here. Nothing is read back yet, so clearing this browser still loses the draft.
 *
 * A draft without a `caseId` (sample and batch drafts, older drafts) is never sent anywhere.
 */

import * as React from "react";

import { caseFilingApi, caseFilingErrorMessage } from "./data/cases-api";
import { useFiling } from "./store";

export type SaveResult = { ok: boolean; error?: string };

export function useAffidavit() {
  const { draft } = useFiling();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /** PUT the affidavit text. `ok` is false on a failure. */
  const save = React.useCallback(
    async (affidavit: string): Promise<SaveResult> => {
      const caseId = draft.caseId;
      if (!caseId) return { ok: true };
      setSaving(true);
      setError(null);
      try {
        await caseFilingApi.saveAffidavit(caseId, affidavit);
        return { ok: true };
      } catch (err) {
        const message = caseFilingErrorMessage(err);
        setError(message);
        return { ok: false, error: message };
      } finally {
        setSaving(false);
      }
    },
    [draft]
  );

  return { save, saving, error, clearError: () => setError(null) };
}
