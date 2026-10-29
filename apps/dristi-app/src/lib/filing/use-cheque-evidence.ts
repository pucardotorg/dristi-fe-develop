"use client";

/**
 * Saves the cheque section to the backend case when the filer clicks Continue.
 *
 * Each cheque on the draft becomes two evidence rows — a `CHEQUE` and a `RETURN_MEMO` —
 * matched to the cheque by the order they are created. A row is sent only once it is
 * complete (`evidence.ts`), because the backend rejects a half-filled one; the draft stays
 * the browser's working copy until then. The id each row is given is kept on the cheque, so
 * clicking Continue again updates the row instead of adding a second one. Nothing is read
 * back from the backend yet — clearing this browser still loses the draft.
 *
 * A draft without a `caseId` (sample and batch drafts, older drafts) is never sent anywhere.
 */

import * as React from "react";

import { caseFilingApi, caseFilingErrorMessage } from "./data/cases-api";
import {
  chequeEvidenceInfo,
  chequeReady,
  returnMemoEvidenceInfo,
  returnMemoReady,
} from "./evidence";
import { chequeSourceSlot } from "./selectors";
import { useFiling } from "./store";
import type { ChequeDetails, FilingDraft } from "./types";

export type SaveResult = { ok: boolean; error?: string };

type Update = (recipe: (draft: FilingDraft) => void) => void;

/** Save one cheque's CHEQUE and RETURN_MEMO rows; creates on first save, updates after. */
async function saveOneCheque(caseId: string, draft: FilingDraft, index: number, update: Update) {
  const cheque = draft.cheques[index];

  if (chequeReady(draft.cheques, index)) {
    const evidenceInfo = chequeEvidenceInfo(draft.cheques, index);
    const caseDocumentId = chequeSourceSlot(draft, index, "cheque-front")?.caseDocumentId;
    if (cheque.chequeEvidenceId) {
      await caseFilingApi.updateEvidence(cheque.chequeEvidenceId, { evidenceInfo, caseDocumentId });
    } else {
      const saved = await caseFilingApi.addEvidence(caseId, {
        evidenceType: "CHEQUE",
        evidenceInfo,
        caseDocumentId,
      });
      update((d) => {
        const c = d.cheques.find((x) => x.id === cheque.id);
        if (c) c.chequeEvidenceId = saved.caseEvidenceId;
      });
    }
  }

  if (returnMemoReady(cheque)) {
    const evidenceInfo = returnMemoEvidenceInfo(cheque);
    const caseDocumentId = chequeSourceSlot(draft, index, "return-memo")?.caseDocumentId;
    if (cheque.returnMemoEvidenceId) {
      await caseFilingApi.updateEvidence(cheque.returnMemoEvidenceId, { evidenceInfo, caseDocumentId });
    } else {
      const saved = await caseFilingApi.addEvidence(caseId, {
        evidenceType: "RETURN_MEMO",
        evidenceInfo,
        caseDocumentId,
      });
      update((d) => {
        const c = d.cheques.find((x) => x.id === cheque.id);
        if (c) c.returnMemoEvidenceId = saved.caseEvidenceId;
      });
    }
  }
}

/** Take a removed cheque's evidence rows off the case. A failure leaves them on it. */
export function removeChequeEvidence(cheque: Pick<ChequeDetails, "chequeEvidenceId" | "returnMemoEvidenceId">) {
  for (const id of [cheque.chequeEvidenceId, cheque.returnMemoEvidenceId]) {
    if (!id) continue;
    caseFilingApi.deleteEvidence(id).catch((error) => {
      console.warn("[filing] couldn't remove cheque evidence from the case", id, error);
    });
  }
}

export function useChequeEvidence() {
  const { draft, update, flush } = useFiling();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /** Push every complete cheque and return memo to the case. `ok` is false on a failure. */
  const save = React.useCallback(async (): Promise<SaveResult> => {
    const caseId = draft.caseId;
    if (!caseId) return { ok: true };
    setSaving(true);
    setError(null);
    try {
      // In list order, so the cheque and its memo keep the same ordinal on the backend.
      for (let i = 0; i < draft.cheques.length; i += 1) {
        await saveOneCheque(caseId, draft, i, update);
      }
      // Commit the stored evidence ids to the local draft before we navigate away.
      await flush();
      return { ok: true };
    } catch (err) {
      const message = caseFilingErrorMessage(err);
      setError(message);
      return { ok: false, error: message };
    } finally {
      setSaving(false);
    }
  }, [draft, update, flush]);

  return { save, saving, error, clearError: () => setError(null) };
}
