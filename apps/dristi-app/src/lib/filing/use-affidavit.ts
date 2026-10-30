"use client";

/**
 * Saves the case's sworn affidavit to the backend when the filer clicks Continue.
 *
 * The affidavit has its own endpoint (`PUT /cases/{id}/affidavit`, spec 0021 §5.4), not a
 * details section. The text sent is the effective affidavit — the filer's edit when they
 * have made one, otherwise the standard text composed from the case (`affidavitBody`) — so
 * the passed value is always non-empty, which the backend requires. Nothing is read back
 * yet, so clearing this browser still loses the draft.
 *
 * A draft without a `caseId` (sample and batch drafts, older drafts) is never sent anywhere.
 */

import * as React from "react";

import { caseFilingApi, caseFilingErrorMessage } from "./data/cases-api";
import { richTextHasContent } from "./details";
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
      // The backend refuses a blank affidavit; the standard text is never blank, so this
      // only guards against an empty draft.
      if (!richTextHasContent(affidavit)) return { ok: true };
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
