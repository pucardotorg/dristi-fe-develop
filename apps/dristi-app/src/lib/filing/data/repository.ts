/**
 * Persistence contract for the e-filing flow.
 *
 * Everything the screens keep in this browser goes through this interface: drafts (the
 * whole `FilingDraft`) and uploaded files (bytes + metadata). The only implementation is
 * IndexedDB (`./indexeddb.ts`). It is the working copy of a draft while sections move to
 * the backend one by one (`./cases-api.ts`); it goes once the backend holds them all.
 */

import type { FilingDraft, StoredFileRef } from "../types";

/** A stored upload: the reference the draft holds plus the bytes. */
export type StoredFile = StoredFileRef & {
  blob: Blob;
  createdAt: string;
};

export interface FilingRepository {
  /* Drafts (and filed cases — a filed case is a draft with `status: "filed"`). */
  listDrafts(): Promise<FilingDraft[]>;
  getDraft(id: string): Promise<FilingDraft | null>;
  putDraft(draft: FilingDraft): Promise<void>;
  deleteDraft(id: string): Promise<void>;

  /* Files */
  putFile(file: StoredFile): Promise<void>;
  getFile(id: string): Promise<StoredFile | null>;
  deleteFile(id: string): Promise<void>;
  /** Drop files no draft references any more (called after a draft is deleted). */
  deleteFiles(ids: string[]): Promise<void>;
}
