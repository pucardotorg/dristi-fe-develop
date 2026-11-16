/**
 * Persistence contract for the e-filing flow.
 *
 * Everything the screens keep in this browser goes through this interface: drafts (the
 * whole `FilingDraft`) and uploaded files (bytes + metadata). It is the working copy of a
 * draft while sections move to the backend one by one (`./cases-api.ts`); it goes once the
 * backend holds them all. Two implementations answer it: the sandbox in the browser
 * (`./indexeddb.ts`, design) and the backend (`./http.ts`, engineering, filled in as
 * endpoints arrive); `./index.ts` picks one by `NEXT_PUBLIC_DATA_SOURCE`, and screens do
 * not change.
 *
 * Shared by both teams and only grows: add methods, never rename or remove one that
 * `http.ts` already implements (the type check fails if you do).
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
