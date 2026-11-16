/**
 * IndexedDB implementation of the filing repository, and the sandbox's backend case.
 *
 * Drafts: one database, two stores: `drafts` (whole drafts, indexed by `updatedAt`) and `files`
 * (upload bytes + metadata). Blobs are stored as-is — IndexedDB keeps binary data
 * natively, so uploads survive reloads and are never base64-inflated. Databases created
 * before the profile moved to the signed-in account still hold an unused `profile` store.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import { getAuthService } from "@/lib/auth";

import type { FilingDraft } from "../types";
import type { FilingRepository, StoredFile } from "./repository";
import { migrateDraft } from "../blank";
import {
  SandboxCaseFiling,
  type CaseStore,
  type SandboxAccount,
  type SandboxCase,
} from "./cases-sandbox";

const DB_NAME = "dristi-efiling";
const DB_VERSION = 1;

interface FilingDB extends DBSchema {
  drafts: {
    key: string;
    value: FilingDraft;
    indexes: { updatedAt: string };
  };
  files: {
    key: string;
    value: StoredFile;
  };
}

let dbPromise: Promise<IDBPDatabase<FilingDB>> | null = null;

function db(): Promise<IDBPDatabase<FilingDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FilingDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        const drafts = database.createObjectStore("drafts", { keyPath: "id" });
        drafts.createIndex("updatedAt", "updatedAt");
        database.createObjectStore("files", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

/**
 * Migrate one stored draft, or leave it out of the list.
 *
 * `migrateDraft` handles every shape this branch knows about, but drafts on disk are
 * written by whichever branch ran last on this origin, and the next one is not
 * predictable. A record it cannot make sense of is dropped from the listing instead of
 * throwing: the queue then shows the drafts it *can* read, rather than one bad row
 * taking the whole filings screen down with it.
 */
function readable(draft: FilingDraft): FilingDraft | null {
  try {
    return migrateDraft(draft);
  } catch (err) {
    console.warn("[filing] skipping a draft this build cannot read", draft?.id, err);
    return null;
  }
}

export class IndexedDbFilingRepository implements FilingRepository {
  async listDrafts(): Promise<FilingDraft[]> {
    const all = await (await db()).getAllFromIndex("drafts", "updatedAt");
    // newest first
    return all
      .reverse()
      .map(readable)
      .filter((d): d is FilingDraft => d !== null);
  }

  async getDraft(id: string): Promise<FilingDraft | null> {
    const draft = await (await db()).get("drafts", id);
    // Drafts written by an earlier shape of the form are still on this person's disk.
    return draft ? readable(draft) : null;
  }

  async putDraft(draft: FilingDraft): Promise<void> {
    await (await db()).put("drafts", draft);
  }

  async deleteDraft(id: string): Promise<void> {
    await (await db()).delete("drafts", id);
  }

  async putFile(file: StoredFile): Promise<void> {
    await (await db()).put("files", file);
  }

  async getFile(id: string): Promise<StoredFile | null> {
    return (await (await db()).get("files", id)) ?? null;
  }

  async deleteFile(id: string): Promise<void> {
    await (await db()).delete("files", id);
  }

  async deleteFiles(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const tx = (await db()).transaction("files", "readwrite");
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  }
}

/* ─────────────────────────────── The backend case ───────────────────────────────── */

/**
 * The sandbox's copy of each backend case (`./cases-sandbox.ts`). A database of its own, so
 * adding it left the drafts database at its version: another branch that still opens
 * `dristi-efiling` at version 1 keeps working.
 */
const CASES_DB_NAME = "dristi-efiling-cases";
const CASES_DB_VERSION = 1;

interface CasesDB extends DBSchema {
  cases: {
    key: string;
    value: SandboxCase;
  };
}

let casesDbPromise: Promise<IDBPDatabase<CasesDB>> | null = null;

function casesDb(): Promise<IDBPDatabase<CasesDB>> {
  if (!casesDbPromise) {
    casesDbPromise = openDB<CasesDB>(CASES_DB_NAME, CASES_DB_VERSION, {
      upgrade(database) {
        database.createObjectStore("cases", { keyPath: "caseId" });
      },
    });
  }
  return casesDbPromise;
}

const indexedDbCaseStore: CaseStore = {
  async get(caseId) {
    return (await casesDb()).get("cases", caseId);
  },
  async put(record) {
    await (await casesDb()).put("cases", record);
  },
  async list() {
    return (await casesDb()).getAll("cases");
  },
};

/** The signed-in person, for a party added as `self`; unknown when the session is not. */
async function currentAccount(): Promise<SandboxAccount> {
  const account = await getAuthService().getCurrentAccount();
  return { name: account.name ?? "", mobile: account.mobile };
}

/** The backend case, answered in this browser. Cases survive a reload, like their drafts. */
export class IndexedDbCaseFilingRepository extends SandboxCaseFiling {
  constructor() {
    super(indexedDbCaseStore, currentAccount);
  }
}
