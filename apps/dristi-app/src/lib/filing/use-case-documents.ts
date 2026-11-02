"use client";

/**
 * Keeps the filing's documents on the backend case, for the upload step and the list of
 * documents alike. A file stored on an intake slot or a custom row is also uploaded to
 * the case; clearing or replacing it takes the old copy off, and a changed name or
 * "Natively digital" tick is patched onto the saved copy. The copy in this browser stays —
 * reading and previews use it, and there is no download endpoint.
 *
 * What is sent, as which type and linked to whom, is decided in `case-documents.ts`.
 *
 * A draft without a `caseId` (batch drafts, older drafts) is never sent anywhere.
 */

import * as React from "react";

import {
  caseUploadFor,
  findSynced,
  pendingLinks,
  targetId,
  type DocumentsDraft,
  type DocumentTarget,
  type ParticipantIdOf,
  type PendingLink,
  type UnsavedDocument,
} from "./case-documents";
import {
  caseFilingApi,
  caseFilingErrorMessage,
  documentPatch,
  type CaseDocumentMeta,
} from "./data/cases-api";
import { storeUpload } from "./data";
import { discardStoredFile, getFileBlob } from "./files";
import { readability } from "./readability";
import { findDocumentRow } from "./selectors";
import { useFiling } from "./store";
import type { FilingDraft, StoredFileRef, SyncedFile } from "./types";

const STORE_FAILED = "We couldn't store that file in this browser. Please try again.";

/** The filing store's `update`: a change to the draft, as a recipe. */
export type DraftUpdate = (recipe: (draft: FilingDraft) => void) => void;

export type CaseDocuments = {
  /** Store a chosen file on a target and save it to the case. Resolves to why it failed. */
  attachFile: (target: DocumentTarget, file: File) => Promise<string | null>;
  /** Clear a target's file, here and on the case. */
  clearFile: (target: DocumentTarget) => void;
  /** Forget targets leaving the draft (`discardDocuments`). */
  discard: (targets: DocumentTarget[]) => void;
  /** Change a saved document's name or "Natively digital" tick. */
  updateDetails: (target: DocumentTarget, meta: CaseDocumentMeta) => Promise<void>;
  /** Save these failed files to the case again. */
  retry: (documents: UnsavedDocument[]) => void;
};

function patchSynced(update: DraftUpdate, target: DocumentTarget, recipe: (r: SyncedFile) => void) {
  update((d) => {
    const record = findSynced(d, target);
    if (record) recipe(record);
  });
}

/*
 * Turns per target, kept for the whole page rather than per hook, since one screen can
 * remove what another started uploading. Anything that changes a target's file starts a
 * new run, so work in flight for an older one knows it lost and backs out; a file being
 * chosen holds a pick, so a later choice or a clear wins over it.
 */
const runs = new Map<string, number>();
const picks = new Map<string, number>();

function turn(turns: Map<string, number>, key: string): () => boolean {
  const n = (turns.get(key) ?? 0) + 1;
  turns.set(key, n);
  return () => turns.get(key) === n;
}

function turnKey(draft: Pick<FilingDraft, "id">, target: DocumentTarget): string {
  return `${draft.id}:${targetId(target)}`;
}

/** Start a new run on a target, cancelling its upload and any file still being chosen. */
function nextRun(draft: Pick<FilingDraft, "id">, target: DocumentTarget): () => boolean {
  const key = turnKey(draft, target);
  turn(picks, key);
  return turn(runs, key);
}

/**
 * Everything the case should hold for a saved document — its details and, once known,
 * its participant — so a patch that succeeds leaves nothing earlier still to send.
 */
function fullPatch(draft: DocumentsDraft, target: DocumentTarget, meta?: CaseDocumentMeta) {
  const { caseParticipantId, ...details } = {
    ...caseUploadFor(draft, target)?.meta,
    ...meta,
  };
  // An unknown participant is left alone, not unlinked: it is linked once saved.
  return documentPatch(caseParticipantId ? { ...details, caseParticipantId } : details);
}

/** Links being sent, by document and participant, so two passes never send one twice. */
const linking = new Set<string>();

/**
 * Link one saved document to its participant, with its details. A failure is reported on
 * the document; trying it again uploads it with the link.
 */
async function linkDocument(latest: () => FilingDraft, update: DraftUpdate, link: PendingLink) {
  const key = `${link.caseDocumentId}:${link.participantId}`;
  if (linking.has(key)) return;
  linking.add(key);
  // Only the copy that was linked: a replaced file goes up with its own link.
  const sameCopy = (r: SyncedFile) => r.caseDocumentId === link.caseDocumentId;
  try {
    await caseFilingApi.updateDocument(
      link.caseDocumentId,
      fullPatch(latest(), link.target, { caseParticipantId: link.participantId })
    );
    patchSynced(update, link.target, (r) => {
      if (!sameCopy(r)) return;
      r.linkedParticipantId = link.participantId;
      r.syncError = undefined;
    });
  } catch (error) {
    patchSynced(update, link.target, (r) => {
      if (sameCopy(r)) r.syncError = caseFilingErrorMessage(error);
    });
  } finally {
    linking.delete(key);
  }
}

/**
 * Link complainants' saved documents to their participants — run after the complainant
 * step saves, since a document is often uploaded before its complainant is on the case.
 * Each link is its own request, so they go together.
 */
export async function linkPartyDocuments(
  latest: () => FilingDraft,
  update: DraftUpdate,
  participantIdOf?: ParticipantIdOf
): Promise<void> {
  await Promise.all(
    pendingLinks(latest(), participantIdOf).map((link) => linkDocument(latest, update, link))
  );
}

/** Take documents off the backend case. A failure leaves the document on the case. */
function removeFromCase(records: Array<Pick<SyncedFile, "caseDocumentId">>) {
  for (const { caseDocumentId } of records) {
    if (!caseDocumentId) continue;
    caseFilingApi.deleteDocument(caseDocumentId).catch((error) => {
      console.warn("[filing] couldn't remove a document from the case", caseDocumentId, error);
    });
  }
}

/**
 * Forget the files of targets leaving the draft — in this browser and on the case — and
 * cancel their uploads. Call it with the draft before the update that removes or clears
 * them.
 */
export function discardDocuments(draft: DocumentsDraft, targets: DocumentTarget[]): void {
  for (const target of targets) {
    nextRun(draft, target);
    const record = findSynced(draft, target);
    if (!record) continue;
    if (record.file) discardStoredFile(record.file.id);
    removeFromCase([record]);
  }
}

/** Forget a record's backend document, for when its file is cleared or replaced. */
function clearCaseDocument(record: SyncedFile) {
  record.caseDocumentId = undefined;
  record.syncing = false;
  record.syncError = undefined;
  record.linkedParticipantId = undefined;
}

export function useCaseDocuments(): CaseDocuments {
  const { draft, update, latest } = useFiling();
  const caseId = draft.caseId;

  const patch = React.useCallback(
    (target: DocumentTarget, recipe: (record: SyncedFile) => void) =>
      patchSynced(update, target, recipe),
    [update]
  );

  /** Save a stored file to the case; a copy saved after the target moved on is taken off. */
  const upload = React.useCallback(
    async (target: DocumentTarget, ref: StoredFileRef, blob: Blob, meta?: CaseDocumentMeta) => {
      const plan = caseUploadFor(latest(), target);
      if (!caseId || !plan) return;
      const isCurrent = nextRun(latest(), target);
      // Still this file on the target, whichever screen changed it meanwhile.
      const stillHere = () => isCurrent() && findSynced(latest(), target)?.file?.id === ref.id;
      patch(target, (r) => {
        r.syncing = true;
        r.syncError = undefined;
      });
      const sent = { ...plan.meta, ...meta };
      try {
        const saved = await caseFilingApi.uploadDocument(
          caseId,
          blob,
          ref.name,
          plan.documentType,
          sent
        );
        if (!stillHere()) {
          removeFromCase([saved]);
          return;
        }
        patch(target, (r) => {
          r.syncing = false;
          r.caseDocumentId = saved.caseDocumentId;
          r.linkedParticipantId = sent.caseParticipantId;
        });
        // The complainant may have been saved while this was uploading — read from the
        // store, which stays current after this step has closed.
        const owner = caseUploadFor(latest(), target)?.meta.caseParticipantId;
        if (owner && owner !== sent.caseParticipantId) {
          const link = { target, caseDocumentId: saved.caseDocumentId, participantId: owner };
          void linkDocument(latest, update, link);
        }
      } catch (error) {
        if (!stillHere()) return;
        patch(target, (r) => {
          r.syncing = false;
          r.syncError = caseFilingErrorMessage(error);
        });
      }
    },
    [caseId, latest, patch, update]
  );

  const discard = React.useCallback(
    (targets: DocumentTarget[]) => discardDocuments(latest(), targets),
    [latest]
  );

  const attachFile = React.useCallback(
    async (target: DocumentTarget, file: File): Promise<string | null> => {
      // A pick, not a run: until this file is stored, the one on the target stays — and
      // keeps uploading — so a failure here leaves it as it was.
      const isLatestPick = turn(picks, turnKey(latest(), target));
      let ref: StoredFileRef;
      try {
        ref = await storeUpload(file);
      } catch {
        return STORE_FAILED;
      }
      // A slot's file is checked at intake; a custom row's is checked here.
      const quality = target.kind === "row" ? await readability(file) : null;
      if (!isLatestPick()) {
        discardStoredFile(ref.id);
        return null;
      }
      discard([target]);
      update((d) => {
        const record = findSynced(d, target);
        if (!record) return;
        record.file = ref;
        clearCaseDocument(record);
        if (target.kind === "row") {
          const row = findDocumentRow(d.documents, target.id);
          if (row) row.quality = quality;
        }
      });
      void upload(target, ref, file);
      return null;
    },
    [latest, discard, update, upload]
  );

  const clearFile = React.useCallback(
    (target: DocumentTarget) => {
      discard([target]);
      update((d) => {
        const record = findSynced(d, target);
        if (!record) return;
        record.file = null;
        clearCaseDocument(record);
        if (target.kind === "row") {
          const row = findDocumentRow(d.documents, target.id);
          if (row) row.quality = null;
        }
      });
    },
    [discard, update]
  );

  /**
   * Save a target's file to the case again, from the copy in this browser, replacing any
   * saved copy. `meta` carries a change not yet in the draft.
   */
  const resave = React.useCallback(
    async (target: DocumentTarget, meta?: CaseDocumentMeta) => {
      const ref = findSynced(latest(), target)?.file;
      if (!caseId || !ref) return;
      const blob = await getFileBlob(ref.id);
      const record = findSynced(latest(), target);
      if (!blob || !record || record.file?.id !== ref.id) return;
      nextRun(latest(), target);
      removeFromCase([record]);
      patch(target, clearCaseDocument);
      void upload(target, ref, blob, meta);
    },
    [caseId, latest, patch, upload]
  );

  /**
   * `meta` carries the change, which may not be in the draft yet. A copy still uploading
   * went up with the old value, so it is uploaded again; a failed one picks the change up
   * when it is tried again. The whole of the document's details go, so a success also
   * settles an earlier failed change.
   */
  const updateDetails = React.useCallback(
    async (target: DocumentTarget, meta: CaseDocumentMeta) => {
      const record = findSynced(latest(), target);
      if (!caseId || !record?.file) return;
      if (record.syncing) {
        void resave(target, meta);
        return;
      }
      const { caseDocumentId } = record;
      if (!caseDocumentId) return;
      const sent = fullPatch(latest(), target, meta);
      try {
        await caseFilingApi.updateDocument(caseDocumentId, sent);
        patch(target, (r) => {
          if (r.caseDocumentId !== caseDocumentId) return;
          r.syncError = undefined;
          if (sent.case_participant_id) r.linkedParticipantId = sent.case_participant_id;
        });
      } catch (error) {
        patch(target, (r) => {
          if (r.caseDocumentId === caseDocumentId) r.syncError = caseFilingErrorMessage(error);
        });
      }
    },
    [caseId, latest, patch, resave]
  );

  const retry = React.useCallback(
    (documents: UnsavedDocument[]) => {
      for (const { target } of documents) void resave(target);
    },
    [resave]
  );

  return { attachFile, clearFile, discard, updateDetails, retry };
}
