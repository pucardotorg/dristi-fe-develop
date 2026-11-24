"use client";

/**
 * Saves the cheque section to the backend case when the filer clicks Continue.
 *
 * Each cheque on the draft becomes two evidence rows — a `CHEQUE` and a `RETURN_MEMO` —
 * matched to the cheque by the order they are created. Whatever is filled is saved: the
 * builders in `evidence.ts` send only the well-formed fields, so a half-filled cheque still
 * reaches the case. A row is created once the cheque has something worth saving (a field or
 * a linked scan) and updated in place after that, by the id kept on the cheque, so clicking
 * Continue again never adds a second one. Opening the step reads the case's cheques back
 * (`chequesFromCase`).
 *
 * A draft without a `caseId` (sample and batch drafts, older drafts) is never sent anywhere.
 */

import * as React from "react";

import { chequesFromCase } from "./case-details-read";
import { caseFilingApi, caseFilingErrorMessage } from "./data/cases-api";
import { chequeEvidenceInfo, returnMemoEvidenceInfo } from "./evidence";
import { chequeSourceSlot } from "./selectors";
import { useFiling } from "./store";
import type { ChequeDetails, FilingDraft } from "./types";
import { onBlurAutosave, useSerialSave, type SaveResult } from "./use-autosave";
import { useLoadFromCase } from "./use-load-from-case";

export type { SaveResult };

type Update = (recipe: (draft: FilingDraft) => void) => void;

/**
 * Save one cheque's CHEQUE and RETURN_MEMO rows. An existing row is updated with whatever
 * is now filled (so clearing a field clears it on the case too); a row is created only once
 * the cheque carries something — a well-formed field, or a linked scan — so an untouched
 * cheque adds no empty rows.
 *
 * `createdIds` remembers a row's id the moment it is created, by the cheque's local id —
 * read before the `update` that writes it onto the draft has re-rendered. Autosave can fire a
 * second save before that render, and without this it would not see the id yet and would
 * create the row again (mirrors the parties' `lastSaved` map).
 */
export type ChequeEvidenceIds = Map<string, { cheque?: string; memo?: string }>;

export async function saveOneCheque(
  caseId: string,
  draft: FilingDraft,
  index: number,
  update: Update,
  createdIds: ChequeEvidenceIds,
) {
  const cheque = draft.cheques[index];

  {
    const evidenceInfo = chequeEvidenceInfo(draft.cheques, index);
    const caseDocumentId = chequeSourceSlot(draft, index, "cheque-front")?.caseDocumentId ?? null;
    const existingId = cheque.chequeEvidenceId ?? createdIds.get(cheque.id)?.cheque;
    if (existingId) {
      await caseFilingApi.updateEvidence(existingId, { evidenceInfo, caseDocumentId });
    } else if (Object.keys(evidenceInfo).length > 0 || caseDocumentId != null) {
      const saved = await caseFilingApi.addEvidence(caseId, {
        evidenceType: "CHEQUE",
        evidenceInfo,
        caseDocumentId,
      });
      createdIds.set(cheque.id, { ...createdIds.get(cheque.id), cheque: saved.caseEvidenceId });
      update((d) => {
        const c = d.cheques.find((x) => x.id === cheque.id);
        if (c) c.chequeEvidenceId = saved.caseEvidenceId;
      });
    }
  }

  {
    const evidenceInfo = returnMemoEvidenceInfo(cheque);
    const caseDocumentId = chequeSourceSlot(draft, index, "return-memo")?.caseDocumentId ?? null;
    const existingId = cheque.returnMemoEvidenceId ?? createdIds.get(cheque.id)?.memo;
    if (existingId) {
      await caseFilingApi.updateEvidence(existingId, {
        evidenceInfo,
        caseDocumentId,
      });
    } else if (Object.keys(evidenceInfo).length > 0 || caseDocumentId != null) {
      const saved = await caseFilingApi.addEvidence(caseId, {
        evidenceType: "RETURN_MEMO",
        evidenceInfo,
        caseDocumentId,
      });
      createdIds.set(cheque.id, { ...createdIds.get(cheque.id), memo: saved.caseEvidenceId });
      update((d) => {
        const c = d.cheques.find((x) => x.id === cheque.id);
        if (c) c.returnMemoEvidenceId = saved.caseEvidenceId;
      });
    }
  }
}

/** Take a removed cheque's evidence rows off the case. A failure leaves them on it. */
export function removeChequeEvidence(
  cheque: Pick<ChequeDetails, "chequeEvidenceId" | "returnMemoEvidenceId">,
) {
  for (const id of [cheque.chequeEvidenceId, cheque.returnMemoEvidenceId]) {
    if (!id) continue;
    caseFilingApi.deleteEvidence(id).catch((error) => {
      console.warn("[filing] couldn't remove cheque evidence from the case", id, error);
    });
  }
}

export function useChequeEvidence() {
  const { update, latest, flush } = useFiling();
  const [saving, setSaving] = React.useState(false);
  useLoadFromCase((read, d) => {
    d.cheques = chequesFromCase(read, d.cheques);
  });
  const [error, setError] = React.useState<string | null>(null);
  // Evidence ids created this session, kept across renders so a follow-up autosave sees them
  // before the draft catches up (see `saveOneCheque`).
  const createdIds = React.useRef<ChequeEvidenceIds>(new Map());

  /** Push every cheque and return memo to the case, as filled in. `ok` is false on a failure. */
  const runSave = React.useCallback(async (): Promise<SaveResult> => {
    // Read the newest draft, not a render-old copy: an autosave fires right after an edit.
    const current = latest();
    const caseId = current.caseId;
    if (!caseId) return { ok: true };
    setSaving(true);
    setError(null);
    try {
      // In list order, so the cheque and its memo keep the same ordinal on the backend.
      for (let i = 0; i < current.cheques.length; i += 1) {
        await saveOneCheque(caseId, current, i, update, createdIds.current);
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
  }, [update, latest, flush]);

  // Each cheque's first save POSTs its CHEQUE and RETURN_MEMO rows; a second save in flight
  // would POST them again before the id lands, so the engine runs one save at a time and
  // `createdIds` carries the id across. The signature is exactly what `saveOneCheque` would
  // send (its ids excluded), so clicking through the step without editing re-sends nothing.
  const save = useSerialSave(runSave, () => {
    const current = latest();
    if (!current.caseId) return null;
    return JSON.stringify(
      current.cheques.map((cheque, i) => ({
        cheque: chequeEvidenceInfo(current.cheques, i),
        memo: returnMemoEvidenceInfo(cheque),
        chequeDoc: chequeSourceSlot(current, i, "cheque-front")?.caseDocumentId ?? null,
        memoDoc: chequeSourceSlot(current, i, "return-memo")?.caseDocumentId ?? null,
      })),
    );
  });
  const autosaveProps = onBlurAutosave(() => void save());

  return { save, saving, error, clearError: () => setError(null), autosaveProps };
}
