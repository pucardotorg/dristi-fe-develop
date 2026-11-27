"use client";

/**
 * Saves the demand-notice section to the backend case when the filer clicks Continue.
 *
 * Each demand notice becomes one `LEGAL_DEMAND_NOTICE` evidence row, matched to its cheque
 * by the order rows are created (spec 0021 §5.1). Whatever is filled is saved: the builder
 * in `evidence.ts` sends only the well-formed fields. A row is created once the notice
 * carries something — a field or a linked scan — and updated in place after that, by the id
 * kept on the notice, so Continue again never adds a second. The notice's scan
 * is linked from the row (`case_document_id`); its proof of dispatch, proof of delivery and
 * reply are linked to the row (`case_evidence_id`) once it is saved. Opening the step reads
 * the case's notices back (`noticesFromCase`).
 *
 * A draft without a `caseId` (sample and batch drafts, older drafts) is never sent anywhere.
 */

import * as React from "react";

import { awaitKeyedSave } from "./autosave-queue";
import { noticesFromCase } from "./case-details-read";
import { getCaseFilingRepository, type CaseFilingRepository } from "./data";
import { caseFilingErrorMessage, isEvidenceGone } from "./data/cases-api";
import { demandNoticeEvidenceInfo, demandNoticeHasContent } from "./evidence";
import { noticeSourceSlot } from "./selectors";
import { useFiling } from "./store";
import { onBlurAutosave, useKeyedSerialSave, type SaveResult } from "./use-autosave";
import { linkSavedDocuments } from "./use-case-documents";
import type { DemandNotice, FilingDraft } from "./types";
import { useLoadFromCase } from "./use-load-from-case";

export type { SaveResult };

type Update = (recipe: (draft: FilingDraft) => void) => void;

/** The save queue's key for a case's demand-notice step — shared by the hook and removal. */
const noticeSaveKey = (caseId: string) => `${caseId}:notice`;

/**
 * Evidence ids created for each case's notices, by the notice's local id, kept at module
 * scope so it outlives the step unmounting: a follow-up save — before the draft catches up,
 * or one started after the filer left the step and returned — sees the id and updates the row
 * rather than creating it again (mirrors the parties' module-level `lastSaved`).
 */
const noticeEvidenceStates = new Map<string, NoticeEvidenceIds>();

export function noticeEvidenceStateFor(caseId: string): NoticeEvidenceIds {
  let state = noticeEvidenceStates.get(caseId);
  if (!state) {
    state = new Map();
    noticeEvidenceStates.set(caseId, state);
  }
  return state;
}

/**
 * Save one demand notice's evidence row; creates on first save, updates after. Resolves
 * to the row's id, which the draft may not hold yet.
 *
 * `createdIds` remembers a row's id the moment it is created, by the notice's local id — read
 * before the `update` that writes it onto the draft has re-rendered. Autosave can fire a
 * second save before that render, and without this it would create the row again (mirrors the
 * parties' `lastSaved` map).
 */
export type NoticeEvidenceIds = Map<string, string>;

export async function saveOneNotice(
  caseId: string,
  draft: FilingDraft,
  index: number,
  update: Update,
  createdIds: NoticeEvidenceIds,
  api: Pick<CaseFilingRepository, "addEvidence" | "updateEvidence"> = getCaseFilingRepository(),
): Promise<string | undefined> {
  const notice = draft.notices[index];
  const evidenceInfo = demandNoticeEvidenceInfo(notice);
  // `null` unlinks a scan that was removed; a new one is linked as it finishes uploading.
  const caseDocumentId = noticeSourceSlot(draft, index, "demand-notice")?.caseDocumentId ?? null;

  const existingId = notice.noticeEvidenceId ?? createdIds.get(notice.id);
  if (existingId) {
    try {
      await api.updateEvidence(existingId, { evidenceInfo, caseDocumentId });
      return existingId;
    } catch (error) {
      if (!isEvidenceGone(error)) throw error;
      // The row was removed on the case: forget its id and recreate it below.
      createdIds.delete(notice.id);
      update((d) => {
        const n = d.notices.find((x) => x.id === notice.id);
        if (n) n.noticeEvidenceId = undefined;
      });
    }
  }
  // An untouched notice carries only its default yes/no answers: add no empty row for it.
  if (!demandNoticeHasContent(notice) && caseDocumentId == null) return undefined;
  const saved = await api.addEvidence(caseId, {
    evidenceType: "LEGAL_DEMAND_NOTICE",
    evidenceInfo,
    caseDocumentId,
  });
  createdIds.set(notice.id, saved.caseEvidenceId);
  update((d) => {
    const n = d.notices.find((x) => x.id === notice.id);
    if (n) n.noticeEvidenceId = saved.caseEvidenceId;
  });
  return saved.caseEvidenceId;
}

/**
 * Take a removed notice's evidence row off the case. A failure leaves it on it.
 *
 * A save started by leaving a field may still be creating the row when the filer removes the
 * notice, so it waits for that save first and then reads the id it recorded (the draft may not
 * carry it yet) — otherwise the save finishes after the removal and leaves a row on the case
 * with nothing in the form.
 */
export function removeNoticeEvidence(
  caseId: string,
  notice: Pick<DemandNotice, "id" | "noticeEvidenceId">,
  api: Pick<CaseFilingRepository, "deleteEvidence"> = getCaseFilingRepository(),
) {
  void (async () => {
    await awaitKeyedSave(noticeSaveKey(caseId));
    const state = noticeEvidenceStates.get(caseId);
    const id = notice.noticeEvidenceId ?? state?.get(notice.id);
    state?.delete(notice.id);
    if (!id) return;
    try {
      await api.deleteEvidence(id);
    } catch (error) {
      console.warn("[filing] couldn't remove demand-notice evidence from the case", id, error);
    }
  })();
}

export function useDemandNoticeEvidence() {
  const { update, latest, flush } = useFiling();
  useLoadFromCase((read, d) => {
    d.notices = noticesFromCase(read, d.notices);
  });
  const [error, setError] = React.useState<string | null>(null);

  /** Push every demand notice to the case, as filled in. `ok` is false on a failure. */
  const runSave = React.useCallback(async (): Promise<SaveResult> => {
    // Read the newest draft, not a render-old copy: an autosave fires right after an edit.
    const current = latest();
    const caseId = current.caseId;
    if (!caseId) return { ok: true };
    setError(null);
    try {
      // In list order, so a notice keeps the same ordinal as its cheque on the backend.
      const savedAs = new Map<string, string | undefined>();
      for (let i = 0; i < current.notices.length; i += 1) {
        savedAs.set(
          current.notices[i].id,
          await saveOneNotice(caseId, current, i, update, noticeEvidenceStateFor(caseId)),
        );
      }
      // Each notice's proof of dispatch, proof of delivery and reply was often uploaded
      // before the notice was on the case; the backend only counts them once linked.
      await linkSavedDocuments(latest, update, {
        evidenceIdOf: (n) => (savedAs.has(n.id) ? savedAs.get(n.id) : n.noticeEvidenceId),
      });
      await flush();
      return { ok: true };
    } catch (err) {
      const message = caseFilingErrorMessage(err);
      setError(message);
      return { ok: false, error: message };
    }
  }, [update, latest, flush]);

  // A notice's first save POSTs its row, so the engine runs one save at a time per case and
  // `noticeEvidenceStates` carries the id across (no double POST before it lands, even across
  // leaving and reopening the step). The signature covers each notice's evidence and scan,
  // plus the document set — a proof of dispatch/delivery/reply that finishes uploading must
  // still get linked, and that lives in `documents`.
  const save = useKeyedSerialSave(
    () => {
      const id = latest().caseId;
      return id ? noticeSaveKey(id) : null;
    },
    runSave,
    () => {
      const current = latest();
      if (!current.caseId) return null;
      return JSON.stringify({
        notices: current.notices.map((notice, i) => ({
          info: demandNoticeEvidenceInfo(notice),
          scan: noticeSourceSlot(current, i, "demand-notice")?.caseDocumentId ?? null,
        })),
        documents: current.documents,
      });
    },
  );
  const autosaveProps = onBlurAutosave(() => void save());

  return { save, error, clearError: () => setError(null), autosaveProps };
}
