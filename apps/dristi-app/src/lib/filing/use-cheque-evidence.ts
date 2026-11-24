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
import { getCaseFilingRepository } from "./data";
import { caseFilingErrorMessage } from "./data/cases-api";
import { chequeEvidenceInfo, returnMemoEvidenceInfo } from "./evidence";
import { chequeSourceSlot } from "./selectors";
import { useFiling } from "./store";
import type { ChequeDetails, FilingDraft } from "./types";
import { onBlurAutosave, useSerialSave, type SaveResult } from "./use-autosave";
import { useLoadFromCase } from "./use-load-from-case";

export type { SaveResult };

type Update = (recipe: (draft: FilingDraft) => void) => void;
type EvidenceApi = Pick<typeof caseFilingApi, "addEvidence" | "updateEvidence">;

/**
 * What a cheque's two rows are saved as, by the cheque's local id. `id` is remembered the
 * moment a row is created — read before the `update` that writes it onto the draft has
 * re-rendered, so a second autosave never creates the row twice (mirrors the parties'
 * `lastSaved` map). `sig` is what was last sent, so a row whose fields did not change is not
 * PATCHed again: editing a cheque field saves only the CHEQUE row, a return-memo field only
 * the RETURN_MEMO row.
 */
export type ChequeRowState = { id?: string; sig?: string };
export type ChequeEvidenceState = Map<string, { cheque: ChequeRowState; memo: ChequeRowState }>;

function rowEntry(state: ChequeEvidenceState, chequeId: string) {
  let entry = state.get(chequeId);
  if (!entry) {
    entry = { cheque: {}, memo: {} };
    state.set(chequeId, entry);
  }
  return entry;
}

/** What is sent for one row — its fields and its linked scan — as a string to compare on. */
function rowSignature(evidenceInfo: Record<string, unknown>, caseDocumentId: string | null) {
  return JSON.stringify({ evidenceInfo, caseDocumentId });
}

/**
 * Seed each existing row's baseline from the case as the step opens, so the first edit PATCHes
 * only the row it changed rather than both. Rows not yet on the case keep an empty baseline.
 */
export function seedChequeEvidenceState(draft: FilingDraft, state: ChequeEvidenceState) {
  draft.cheques.forEach((cheque, index) => {
    const entry = rowEntry(state, cheque.id);
    if (cheque.chequeEvidenceId) {
      const docId = chequeSourceSlot(draft, index, "cheque-front")?.caseDocumentId ?? null;
      entry.cheque = {
        id: cheque.chequeEvidenceId,
        sig: rowSignature(chequeEvidenceInfo(draft.cheques, index), docId),
      };
    }
    if (cheque.returnMemoEvidenceId) {
      const docId = chequeSourceSlot(draft, index, "return-memo")?.caseDocumentId ?? null;
      entry.memo = {
        id: cheque.returnMemoEvidenceId,
        sig: rowSignature(returnMemoEvidenceInfo(cheque), docId),
      };
    }
  });
}

/**
 * Save one cheque's CHEQUE and RETURN_MEMO rows. An existing row is updated with whatever
 * is now filled (so clearing a field clears it on the case too) — but only when its fields
 * actually changed since the last save; a row is created only once the cheque carries
 * something — a well-formed field, or a linked scan — so an untouched cheque adds no rows.
 */
export async function saveOneCheque(
  caseId: string,
  draft: FilingDraft,
  index: number,
  update: Update,
  state: ChequeEvidenceState,
  api: EvidenceApi = caseFilingApi,
) {
  const cheque = draft.cheques[index];
  const entry = rowEntry(state, cheque.id);

  {
    const evidenceInfo = chequeEvidenceInfo(draft.cheques, index);
    const caseDocumentId = chequeSourceSlot(draft, index, "cheque-front")?.caseDocumentId ?? null;
    if (cheque.chequeEvidenceId) {
      await getCaseFilingRepository().updateEvidence(cheque.chequeEvidenceId, {
        evidenceInfo,
        caseDocumentId,
      });
    } else if (Object.keys(evidenceInfo).length > 0 || caseDocumentId != null) {
      const saved = await getCaseFilingRepository().addEvidence(caseId, {
        evidenceType: "CHEQUE",
        evidenceInfo,
        caseDocumentId,
      });
      entry.cheque = { id: saved.caseEvidenceId, sig };
      update((d) => {
        const c = d.cheques.find((x) => x.id === cheque.id);
        if (c) c.chequeEvidenceId = saved.caseEvidenceId;
      });
    }
  }

  {
    const evidenceInfo = returnMemoEvidenceInfo(cheque);
    const caseDocumentId = chequeSourceSlot(draft, index, "return-memo")?.caseDocumentId ?? null;
    if (cheque.returnMemoEvidenceId) {
      await getCaseFilingRepository().updateEvidence(cheque.returnMemoEvidenceId, {
        evidenceInfo,
        caseDocumentId,
      });
    } else if (Object.keys(evidenceInfo).length > 0 || caseDocumentId != null) {
      const saved = await getCaseFilingRepository().addEvidence(caseId, {
        evidenceType: "RETURN_MEMO",
        evidenceInfo,
        caseDocumentId,
      });
      entry.memo = { id: saved.caseEvidenceId, sig };
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
    getCaseFilingRepository()
      .deleteEvidence(id)
      .catch((error) => {
        console.warn("[filing] couldn't remove cheque evidence from the case", id, error);
      });
  }
}

export function useChequeEvidence() {
  const { update, latest, flush } = useFiling();
  const [saving, setSaving] = React.useState(false);
  // What each row is saved as, kept across renders (see `saveOneCheque`).
  const evidenceState = React.useRef<ChequeEvidenceState>(new Map());
  useLoadFromCase((read, d) => {
    d.cheques = chequesFromCase(read, d.cheques);
    // Seed baselines from the case so the first edit only PATCHes the row it changed.
    seedChequeEvidenceState(d, evidenceState.current);
  });
  const [error, setError] = React.useState<string | null>(null);

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
        await saveOneCheque(caseId, current, i, update, evidenceState.current);
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
  // `evidenceState` carries each row's id across. The step signature below is everything the
  // step would send, so clicking through without editing re-sends nothing (per-row skipping
  // inside `saveOneCheque` then keeps an edit to one row from PATCHing the other).
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
