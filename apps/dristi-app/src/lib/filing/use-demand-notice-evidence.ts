"use client";

/**
 * Saves the demand-notice section to the backend case when the filer clicks Continue.
 *
 * Each demand notice becomes one `LEGAL_DEMAND_NOTICE` evidence row, matched to its cheque
 * by the order rows are created (spec 0021 §5.1). A row is sent only once it is complete
 * (`evidence.ts`), since the backend rejects a half-filled one; the id it is given is kept
 * on the notice, so Continue again updates it instead of adding a second. The notice's scan
 * is linked from the row (`case_document_id`); its proof of dispatch, proof of delivery and
 * reply are linked to the row (`case_evidence_id`) once it is saved. Opening the step reads
 * the case's notices back (`noticesFromCase`).
 *
 * A draft without a `caseId` (sample and batch drafts, older drafts) is never sent anywhere.
 */

import * as React from "react";

import { noticesFromCase } from "./case-details-read";
import { caseFilingApi, caseFilingErrorMessage } from "./data/cases-api";
import { demandNoticeEvidenceInfo, demandNoticeReady } from "./evidence";
import { noticeSourceSlot } from "./selectors";
import { useFiling } from "./store";
import { linkSavedDocuments } from "./use-case-documents";
import type { DemandNotice, FilingDraft } from "./types";
import { useLoadFromCase } from "./use-load-from-case";

export type SaveResult = { ok: boolean; error?: string };

type Update = (recipe: (draft: FilingDraft) => void) => void;

/**
 * Save one demand notice's evidence row; creates on first save, updates after. Resolves
 * to the row's id, which the draft may not hold yet.
 */
async function saveOneNotice(
  caseId: string,
  draft: FilingDraft,
  index: number,
  update: Update
): Promise<string | undefined> {
  const notice = draft.notices[index];
  if (!demandNoticeReady(notice)) return notice.noticeEvidenceId;

  const evidenceInfo = demandNoticeEvidenceInfo(notice);
  // `null` unlinks a scan that was removed; a new one is linked as it finishes uploading.
  const caseDocumentId = noticeSourceSlot(draft, index, "demand-notice")?.caseDocumentId ?? null;

  if (notice.noticeEvidenceId) {
    await caseFilingApi.updateEvidence(notice.noticeEvidenceId, { evidenceInfo, caseDocumentId });
    return notice.noticeEvidenceId;
  }
  const saved = await caseFilingApi.addEvidence(caseId, {
    evidenceType: "LEGAL_DEMAND_NOTICE",
    evidenceInfo,
    caseDocumentId,
  });
  update((d) => {
    const n = d.notices.find((x) => x.id === notice.id);
    if (n) n.noticeEvidenceId = saved.caseEvidenceId;
  });
  return saved.caseEvidenceId;
}

/** Take a removed notice's evidence row off the case. A failure leaves it on it. */
export function removeNoticeEvidence(notice: Pick<DemandNotice, "noticeEvidenceId">) {
  if (!notice.noticeEvidenceId) return;
  caseFilingApi.deleteEvidence(notice.noticeEvidenceId).catch((error) => {
    console.warn("[filing] couldn't remove demand-notice evidence from the case", notice.noticeEvidenceId, error);
  });
}

export function useDemandNoticeEvidence() {
  const { draft, update, latest, flush } = useFiling();
  const [saving, setSaving] = React.useState(false);
  useLoadFromCase((read, d) => {
    d.notices = noticesFromCase(read, d.notices);
  });
  const [error, setError] = React.useState<string | null>(null);

  /** Push every complete demand notice to the case. `ok` is false on a failure. */
  const save = React.useCallback(async (): Promise<SaveResult> => {
    const caseId = draft.caseId;
    if (!caseId) return { ok: true };
    setSaving(true);
    setError(null);
    try {
      // In list order, so a notice keeps the same ordinal as its cheque on the backend.
      const savedAs = new Map<string, string | undefined>();
      for (let i = 0; i < draft.notices.length; i += 1) {
        savedAs.set(draft.notices[i].id, await saveOneNotice(caseId, draft, i, update));
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
  }, [draft, update, latest, flush]);

  return { save, saving, error, clearError: () => setError(null) };
}
