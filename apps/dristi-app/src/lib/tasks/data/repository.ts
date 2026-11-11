/**
 * Persistence contract for pending tasks.
 *
 * Everything the screens store goes through this interface: people, cases, tasks, the
 * current person (the stand-in for the session) and uploaded files. Two implementations
 * answer it: the sandbox in the browser (`./indexeddb.ts`, design) and the backend
 * (`./http.ts`, engineering, filled in as endpoints arrive); `./index.ts` picks one by
 * `NEXT_PUBLIC_DATA_SOURCE`, and screens do not change.
 *
 * Shared by both teams and only grows: add methods, never rename or remove one that
 * `http.ts` already implements (the type check fails if you do).
 */

import type { Case, Person, PersonId, StoredFileRef, Task } from "../types";

/** A stored upload: the reference the task holds plus the bytes. */
export type StoredFile = StoredFileRef & {
  blob: Blob;
  createdAt: string;
};

export interface TasksRepository {
  /* Reference data */
  listPeople(): Promise<Person[]>;
  putPeople(people: Person[]): Promise<void>;
  listCases(): Promise<Case[]>;
  putCases(cases: Case[]): Promise<void>;

  /* Tasks */
  listTasks(): Promise<Task[]>;
  putTask(task: Task): Promise<void>;
  putTasks(tasks: Task[]): Promise<void>;

  /* The current person — per tab, so two tabs can be two people. */
  getCurrentUserId(): Promise<PersonId | null>;
  putCurrentUserId(id: PersonId): Promise<void>;

  /* Files */
  putFile(file: StoredFile): Promise<void>;
  getFile(id: string): Promise<StoredFile | null>;
  deleteFile(id: string): Promise<void>;

  /** Wipe everything so the sandbox can re-seed. */
  clear(): Promise<void>;
}
