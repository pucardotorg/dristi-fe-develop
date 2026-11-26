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

import { awaitKeyedSave } from "./autosave-queue";
import { chequesFromCase } from "./case-details-read";
import { getCaseFilingRepository, type CaseFilingRepository } from "./data";
import { caseFilingErrorMessage } from "./data/cases-api";
import { chequeEvidenceInfo, returnMemoEvidenceInfo } from "./evidence";
import { chequeSourceSlot } from "./selectors";
import { useFiling } from "./store";
import type { ChequeDetails, FilingDraft } from "./types";
import { onBlurAutosave, useKeyedSerialSave, type SaveResult } from "./use-autosave";
import { useLoadFromCase } from "./use-load-from-case";

export type { SaveResult };

type Update = (recipe: (draft: FilingDraft) => void) => void;
type EvidenceApi = Pick<CaseFilingRepository, "addEvidence" | "updateEvidence">;

/** The save queue's key for a case's cheque step — shared by the hook and removal. */
const chequeSaveKey = (caseId: string) => `${caseId}:cheque`;

/**
 * What each cheque's rows are saved as, per case, kept at module scope so it outlives the
 * step unmounting. A row's id is remembered the moment the row is created — read by a
 * follow-up save before the `update` that writes it onto the draft has re-rendered, or by one
 * started after the filer left the step and came back — so the row is never created twice
 * (mirrors the parties' module-level `lastSaved`).
 */
const chequeEvidenceStates = new Map<string, ChequeEvidenceState>();

export function chequeEvidenceStateFor(caseId: string): ChequeEvidenceState {
  let state = chequeEvidenceStates.get(caseId);
  if (!state) {
    state = new Map();
    chequeEvidenceStates.set(caseId, state);
  }
  return state;
}

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
  api: EvidenceApi = getCaseFilingRepository(),
) {
  const cheque = draft.cheques[index];
  const entry = rowEntry(state, cheque.id);

  {
    const evidenceInfo = chequeEvidenceInfo(draft.cheques, index);
    const caseDocumentId = chequeSourceSlot(draft, index, "cheque-front")?.caseDocumentId ?? null;
    const sig = rowSignature(evidenceInfo, caseDocumentId);
    const existingId = cheque.chequeEvidenceId ?? entry.cheque.id;
    if (existingId) {
      if (entry.cheque.sig !== sig) {
        await api.updateEvidence(existingId, { evidenceInfo, caseDocumentId });
        entry.cheque.sig = sig;
      }
    } else if (Object.keys(evidenceInfo).length > 0 || caseDocumentId != null) {
      const saved = await api.addEvidence(caseId, {
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
    const sig = rowSignature(evidenceInfo, caseDocumentId);
    const existingId = cheque.returnMemoEvidenceId ?? entry.memo.id;
    if (existingId) {
      if (entry.memo.sig !== sig) {
        await api.updateEvidence(existingId, { evidenceInfo, caseDocumentId });
        entry.memo.sig = sig;
      }
    } else if (Object.keys(evidenceInfo).length > 0 || caseDocumentId != null) {
      const saved = await api.addEvidence(caseId, {
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

/**
 * Take a removed cheque's evidence rows off the case. A failure leaves them on it.
 *
 * A save started by leaving a field may still be creating these rows when the filer removes
 * the cheque, so it waits for that save first and then reads the ids it recorded (the draft
 * may not carry them yet) — otherwise the save finishes after the removal and leaves a row on
 * the case with nothing in the form.
 */
export function removeChequeEvidence(
  caseId: string,
  cheque: Pick<ChequeDetails, "id" | "chequeEvidenceId" | "returnMemoEvidenceId">,
  api: Pick<CaseFilingRepository, "deleteEvidence"> = getCaseFilingRepository(),
) {
  void (async () => {
    await awaitKeyedSave(chequeSaveKey(caseId));
    const state = chequeEvidenceStates.get(caseId);
    const entry = state?.get(cheque.id);
    state?.delete(cheque.id);
    const ids = [
      cheque.chequeEvidenceId ?? entry?.cheque.id,
      cheque.returnMemoEvidenceId ?? entry?.memo.id,
    ];
    for (const id of ids) {
      if (!id) continue;
      try {
        await api.deleteEvidence(id);
      } catch (error) {
        console.warn("[filing] couldn't remove cheque evidence from the case", id, error);
      }
    }
  })();
}

export function useChequeEvidence() {
  const { update, latest, flush } = useFiling();
  const [saving, setSaving] = React.useState(false);
  useLoadFromCase((read, d) => {
    d.cheques = chequesFromCase(read, d.cheques);
    // Seed baselines from the case so the first edit only PATCHes the row it changed.
    if (d.caseId) seedChequeEvidenceState(d, chequeEvidenceStateFor(d.caseId));
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
        await saveOneCheque(caseId, current, i, update, chequeEvidenceStateFor(caseId));
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
  // would POST them again before the id lands, so the engine runs one save at a time per case
  // and `chequeEvidenceStates` carries each row's id across — even when the filer leaves the
  // step and returns. The step signature below is everything the step would send, so clicking
  // through without editing re-sends nothing (per-row skipping inside `saveOneCheque` then
  // keeps an edit to one row from PATCHing the other).
  const save = useKeyedSerialSave(
    () => {
      const id = latest().caseId;
      return id ? chequeSaveKey(id) : null;
    },
    runSave,
    () => {
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
    },
  );
  const autosaveProps = onBlurAutosave(() => void save());

  return { save, saving, error, clearError: () => setError(null), autosaveProps };
}
