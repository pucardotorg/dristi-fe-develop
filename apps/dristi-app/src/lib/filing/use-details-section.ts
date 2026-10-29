"use client";

/**
 * Saves a case-details section to the backend when the filer clicks Continue.
 *
 * Shared by the details sections (jurisdiction & limitation, ADR/other/prayer): each PUTs
 * its whole section object, which replaces what was stored, so saving is idempotent and
 * there is no per-row id to track. `build` returns the section body, or `null` when the
 * section is not complete enough for the backend to accept — then nothing is sent and the
 * draft stays the working copy. Nothing is read back yet, so clearing this browser still
 * loses the draft.
 *
 * A draft without a `caseId` (sample and batch drafts, older drafts) is never sent anywhere.
 */

import * as React from "react";

import { caseFilingApi, caseFilingErrorMessage } from "./data/cases-api";
import type { DetailsSectionBody } from "./details";
import { useFiling } from "./store";
import type { FilingDraft } from "./types";

export type SaveResult = { ok: boolean; error?: string };

export function useDetailsSection(
  section: string,
  build: (draft: FilingDraft) => DetailsSectionBody | null
) {
  const { draft } = useFiling();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /** PUT the section if it is complete. `ok` is false on a failure. */
  const save = React.useCallback(async (): Promise<SaveResult> => {
    const caseId = draft.caseId;
    if (!caseId) return { ok: true };
    const body = build(draft);
    // Not complete enough to accept — leave it in the browser; the final check catches it.
    if (!body) return { ok: true };
    setSaving(true);
    setError(null);
    try {
      await caseFilingApi.saveDetails(caseId, section, body);
      return { ok: true };
    } catch (err) {
      const message = caseFilingErrorMessage(err);
      setError(message);
      return { ok: false, error: message };
    } finally {
      setSaving(false);
    }
  }, [draft, section, build]);

  return { save, saving, error, clearError: () => setError(null) };
}
