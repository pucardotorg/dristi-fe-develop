"use client";

/**
 * Saves the demand-notice section to the backend case when the filer clicks Continue.
 *
 * Each demand notice becomes one `LEGAL_DEMAND_NOTICE` evidence row, matched to its cheque
 * by the order rows are created (spec 0021 §5.1). A row is sent only once it is complete
 * (`evidence.ts`), since the backend rejects a half-filled one; the id it is given is kept
 * on the notice, so Continue again updates it instead of adding a second. Nothing is read
 * back yet, so clearing this browser still loses the draft.
 *
 * A draft without a `caseId` (sample and batch drafts, older drafts) is never sent anywhere.
 */

import * as React from "react";

import { caseFilingApi, caseFilingErrorMessage } from "./data/cases-api";
import { demandNoticeEvidenceInfo, demandNoticeReady } from "./evidence";
import { chequeSourceSlot } from "./selectors";
import { useFiling } from "./store";
import type { DemandNotice, FilingDraft } from "./types";

export type SaveResult = { ok: boolean; error?: string };

type Update = (recipe: (draft: FilingDraft) => void) => void;

/** Save one demand notice's evidence row; creates on first save, updates after. */
async function saveOneNotice(caseId: string, draft: FilingDraft, index: number, update: Update) {
  const notice = draft.notices[index];
  if (!demandNoticeReady(notice)) return;

  const evidenceInfo = demandNoticeEvidenceInfo(notice);
  const caseDocumentId = chequeSourceSlot(draft, index, "demand-notice")?.caseDocumentId;

  if (notice.noticeEvidenceId) {
    await caseFilingApi.updateEvidence(notice.noticeEvidenceId, { evidenceInfo, caseDocumentId });
  } else {
    const saved = await caseFilingApi.addEvidence(caseId, {
      evidenceType: "LEGAL_DEMAND_NOTICE",
      evidenceInfo,
      caseDocumentId,
    });
    update((d) => {
      const n = d.notices.find((x) => x.id === notice.id);
      if (n) n.noticeEvidenceId = saved.caseEvidenceId;
    });
  }
}

/** Take a removed notice's evidence row off the case. A failure leaves it on it. */
export function removeNoticeEvidence(notice: Pick<DemandNotice, "noticeEvidenceId">) {
  if (!notice.noticeEvidenceId) return;
  caseFilingApi.deleteEvidence(notice.noticeEvidenceId).catch((error) => {
    console.warn("[filing] couldn't remove demand-notice evidence from the case", notice.noticeEvidenceId, error);
  });
}

export function useDemandNoticeEvidence() {
  const { draft, update, flush } = useFiling();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /** Push every complete demand notice to the case. `ok` is false on a failure. */
  const save = React.useCallback(async (): Promise<SaveResult> => {
    const caseId = draft.caseId;
    if (!caseId) return { ok: true };
    setSaving(true);
    setError(null);
    try {
      // In list order, so a notice keeps the same ordinal as its cheque on the backend.
      for (let i = 0; i < draft.notices.length; i += 1) {
        await saveOneNotice(caseId, draft, i, update);
      }
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
