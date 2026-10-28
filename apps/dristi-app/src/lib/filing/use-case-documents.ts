"use client";

/**
 * Keeps the intake's files on the backend case. Each stored file is also uploaded to the
 * case as a case document; clearing or replacing a slot takes the old one off. The copy
 * in this browser stays — reading and previews use it, and there is no download endpoint.
 *
 * A draft without a `caseId` (sample and batch drafts, older drafts) is never sent anywhere.
 */

import * as React from "react";

import {
  caseDocumentType,
  caseFilingApi,
  caseFilingErrorMessage,
} from "./data/cases-api";
import { getFileBlob } from "./files";
import { findIntakeSlot, intakeSlots } from "./selectors";
import { useFiling } from "./store";
import type { IntakeSlot, StoredFileRef } from "./types";

/** Take documents off the backend case. A failure leaves the document on the case. */
export function removeFromCase(slots: Array<Pick<IntakeSlot, "caseDocumentId">>) {
  for (const { caseDocumentId } of slots) {
    if (!caseDocumentId) continue;
    caseFilingApi.deleteDocument(caseDocumentId).catch((error) => {
      console.warn("[filing] couldn't remove a document from the case", caseDocumentId, error);
    });
  }
}

/** Forget a slot's backend document, for when its file is cleared or replaced. */
export function clearCaseDocument(slot: IntakeSlot) {
  slot.caseDocumentId = undefined;
  slot.syncing = false;
  slot.syncError = undefined;
}

export function useCaseDocuments() {
  const { draft, update } = useFiling();
  const caseId = draft.caseId;
  const intake = draft.intake;

  /* The latest intake, for checking after an upload whether its slot has moved on. */
  const intakeRef = React.useRef(intake);
  React.useEffect(() => {
    intakeRef.current = intake;
  }, [intake]);

  const patchSlot = React.useCallback(
    (key: string, patch: (slot: IntakeSlot) => void) =>
      update((d) => {
        const slot = findIntakeSlot(d.intake, key);
        if (slot) patch(slot);
      }),
    [update]
  );

  /**
   * Save a stored file to the backend case. If the slot was cleared or given another
   * file while this was in flight, the saved copy is taken off the case again.
   */
  const saveToCase = React.useCallback(
    async (key: string, ref: StoredFileRef, blob: Blob) => {
      const slot = findIntakeSlot(intakeRef.current, key);
      const documentType = slot ? caseDocumentType(slot.docType) : null;
      if (!caseId || !documentType) return;
      patchSlot(key, (s) => {
        s.syncing = true;
        s.syncError = undefined;
      });
      const stillHere = () => findIntakeSlot(intakeRef.current, key)?.file?.id === ref.id;
      try {
        const saved = await caseFilingApi.uploadDocument(caseId, blob, ref.name, documentType);
        if (!stillHere()) {
          removeFromCase([saved]);
          return;
        }
        patchSlot(key, (s) => {
          s.syncing = false;
          s.caseDocumentId = saved.caseDocumentId;
        });
      } catch (error) {
        if (!stillHere()) return;
        patchSlot(key, (s) => {
          s.syncing = false;
          s.syncError = caseFilingErrorMessage(error);
        });
      }
    },
    [caseId, patchSlot]
  );

  const unsaved = caseId ? intakeSlots(intake).filter((s) => s.file && s.syncError) : [];

  /** Try every file that failed to save again, from the copy in this browser. */
  const retryUnsaved = async () => {
    for (const slot of unsaved) {
      if (!slot.file) continue;
      const blob = await getFileBlob(slot.file.id);
      if (blob) void saveToCase(slot.key, slot.file, blob);
    }
  };

  return { saveToCase, unsaved, retryUnsaved };
}
