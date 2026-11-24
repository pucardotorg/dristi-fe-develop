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

import { noticesFromCase } from "./case-details-read";
import { getCaseFilingRepository } from "./data";
import { caseFilingErrorMessage } from "./data/cases-api";
import { demandNoticeEvidenceInfo, demandNoticeHasContent } from "./evidence";
import { noticeSourceSlot } from "./selectors";
import { useFiling } from "./store";
import { onBlurAutosave, useSerialSave, type SaveResult } from "./use-autosave";
import { linkSavedDocuments } from "./use-case-documents";
import type { DemandNotice, FilingDraft } from "./types";
import { useLoadFromCase } from "./use-load-from-case";

export type { SaveResult };

type Update = (recipe: (draft: FilingDraft) => void) => void;

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
  api: Pick<typeof caseFilingApi, "addEvidence" | "updateEvidence"> = caseFilingApi,
): Promise<string | undefined> {
  const notice = draft.notices[index];
  const evidenceInfo = demandNoticeEvidenceInfo(notice);
  // `null` unlinks a scan that was removed; a new one is linked as it finishes uploading.
  const caseDocumentId = noticeSourceSlot(draft, index, "demand-notice")?.caseDocumentId ?? null;

  if (notice.noticeEvidenceId) {
    await getCaseFilingRepository().updateEvidence(notice.noticeEvidenceId, {
      evidenceInfo,
      caseDocumentId,
    });
    return notice.noticeEvidenceId;
  }
  // An untouched notice carries only its default yes/no answers: add no empty row for it.
  if (!demandNoticeHasContent(notice) && caseDocumentId == null) return undefined;
  const saved = await getCaseFilingRepository().addEvidence(caseId, {
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

/** Take a removed notice's evidence row off the case. A failure leaves it on it. */
export function removeNoticeEvidence(notice: Pick<DemandNotice, "noticeEvidenceId">) {
  if (!notice.noticeEvidenceId) return;
  getCaseFilingRepository()
    .deleteEvidence(notice.noticeEvidenceId)
    .catch((error) => {
      console.warn(
        "[filing] couldn't remove demand-notice evidence from the case",
        notice.noticeEvidenceId,
        error,
      );
    });
}

export function useDemandNoticeEvidence() {
  const { update, latest, flush } = useFiling();
  const [saving, setSaving] = React.useState(false);
  useLoadFromCase((read, d) => {
    d.notices = noticesFromCase(read, d.notices);
  });
  const [error, setError] = React.useState<string | null>(null);
  // Evidence ids created this session, kept across renders so a follow-up autosave sees them
  // before the draft catches up (see `saveOneNotice`).
  const createdIds = React.useRef<NoticeEvidenceIds>(new Map());

  /** Push every demand notice to the case, as filled in. `ok` is false on a failure. */
  const runSave = React.useCallback(async (): Promise<SaveResult> => {
    // Read the newest draft, not a render-old copy: an autosave fires right after an edit.
    const current = latest();
    const caseId = current.caseId;
    if (!caseId) return { ok: true };
    setSaving(true);
    setError(null);
    try {
      // In list order, so a notice keeps the same ordinal as its cheque on the backend.
      const savedAs = new Map<string, string | undefined>();
      for (let i = 0; i < current.notices.length; i += 1) {
        savedAs.set(
          current.notices[i].id,
          await saveOneNotice(caseId, current, i, update, createdIds.current),
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
    } finally {
      setSaving(false);
    }
  }, [update, latest, flush]);

  // A notice's first save POSTs its row, so the engine runs one save at a time and
  // `createdIds` carries the id across (no double POST before it lands). The signature covers
  // each notice's evidence and scan, plus the document set — a proof of dispatch/delivery/
  // reply that finishes uploading must still get linked, and that lives in `documents`.
  const save = useSerialSave(runSave, () => {
    const current = latest();
    if (!current.caseId) return null;
    return JSON.stringify({
      notices: current.notices.map((notice, i) => ({
        info: demandNoticeEvidenceInfo(notice),
        scan: noticeSourceSlot(current, i, "demand-notice")?.caseDocumentId ?? null,
      })),
      documents: current.documents,
    });
  });
  const autosaveProps = onBlurAutosave(() => void save());

  return { save, saving, error, clearError: () => setError(null), autosaveProps };
}
