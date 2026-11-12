/**
 * IndexedDB implementation of the tasks repository: the tasks sandbox.
 *
 * One database, four stores: `people`, `cases`, `tasks` and `files` (upload bytes +
 * metadata; blobs are stored as-is). The current person is *not* in the database —
 * IndexedDB is shared by every tab, and the sandbox wants two tabs to be two people, so
 * it lives in `sessionStorage`, seeded from `localStorage` for the first tab.
 *
 * The sandbox seeds itself from `../sandbox.ts`: the store only reads, so the same store
 * works against the backend, where there is nothing to seed and nothing to wipe.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import { buildTasks, CASES, DEFAULT_USER_ID, PEOPLE, SEED_VERSION } from "../sandbox";
import { orderBySeed, seedAction, seedStamp, todayKey } from "../seed-plan";
import type { Case, Person, PersonId, Task } from "../types";
import type { StoredFile, TasksRepository } from "./repository";

const DB_NAME = "dristi-tasks";
const DB_VERSION = 1;
const USER_KEY = "dristi-tasks:user";
/** Which seed this browser holds; an older one is wiped and re-seeded on load. */
const SEED_KEY = "dristi-tasks:seed";

/**
 * **The demo starts fresh on every page load** (owner, 2026-10-14: "if I refresh the
 * page, all the pending tasks come back"). It is sample data for showing flows, so a
 * refresh puts every task back as seeded — whatever was paid, signed or filed in the
 * last run. Within a page's life the sandbox keeps what was done, so a flow can be
 * walked through screen to screen; only a full load starts it again.
 *
 * Set to false to keep a browser's sandbox across loads (it then reseeds only when the
 * seed stamp changes, as before).
 */
const RESEED_ON_PAGE_LOAD = true;
/** The page's first pass (fresh-page and stale-stamp check) has completed. */
let firstPassDone = false;

interface TasksDB extends DBSchema {
  people: { key: string; value: Person };
  cases: { key: string; value: Case };
  tasks: { key: string; value: Task };
  files: { key: string; value: StoredFile };
}

const STORES = ["people", "cases", "tasks", "files"] as const;

type Db = IDBPDatabase<TasksDB>;

let dbPromise: Promise<Db> | null = null;

function db(): Promise<Db> {
  dbPromise ??= openDB<TasksDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      for (const store of STORES) database.createObjectStore(store, { keyPath: "id" });
    },
  });
  return dbPromise;
}

async function putAll<S extends "people" | "cases" | "tasks">(
  d: Db,
  store: S,
  rows: TasksDB[S]["value"][]
): Promise<void> {
  const tx = d.transaction(store, "readwrite");
  await Promise.all([...rows.map((row) => tx.store.put(row)), tx.done]);
}

/** Empty every store and forget who this browser was viewing as. */
async function wipeAll(d: Db): Promise<void> {
  const tx = d.transaction([...STORES], "readwrite");
  await Promise.all([...STORES.map((store) => tx.objectStore(store).clear()), tx.done]);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(USER_KEY);
}

function currentStamp(): string {
  return seedStamp({ version: SEED_VERSION, day: todayKey(new Date()), people: PEOPLE.length, cases: CASES.length });
}

function stampIsCurrent(): boolean {
  try {
    return localStorage.getItem(SEED_KEY) === currentStamp();
  } catch {
    return true;
  }
}

function rememberSeed(): void {
  try {
    localStorage.setItem(SEED_KEY, currentStamp());
  } catch {
    /* private mode; nothing to do */
  }
}

/** The seeding pass in progress, shared by every read that arrives while it runs. */
let checking: Promise<void> | null = null;

/**
 * Before a read: start the demo over, seed an empty sandbox, or keep it (`seedAction`).
 * The reads the store makes together (people, cases, tasks, current person) share one
 * pass, so the current person is read after any wipe. A failed pass changes nothing it
 * has not finished, and the next read tries again.
 */
function prepareRead(): Promise<void> {
  checking ??= (async () => {
    const d = await db();
    const action = seedAction({
      firstPass: !firstPassDone,
      reseedOnLoad: RESEED_ON_PAGE_LOAD,
      hasPeople: (await d.count("people")) > 0,
      stampIsCurrent: stampIsCurrent(),
    });
    if (action === "wipe-and-seed") await wipeAll(d);
    if (action !== "keep") {
      await Promise.all([putAll(d, "people", PEOPLE), putAll(d, "cases", CASES), putAll(d, "tasks", buildTasks())]);
      rememberSeed();
    }
    firstPassDone = true;
  })().finally(() => {
    checking = null;
  });
  return checking;
}

/** The database for a read, once the sandbox is seeded. */
async function readyDb(): Promise<Db> {
  await prepareRead();
  return db();
}

/**
 * The database for a write. Writes never start a pass (it could wipe mid-change); they
 * wait for one running. The store always reads before it writes, so a page's first pass
 * has run by then.
 */
async function settledDb(): Promise<Db> {
  if (checking) await checking;
  return db();
}

export class IndexedDbTasksRepository implements TasksRepository {
  async listPeople(): Promise<Person[]> {
    return orderBySeed(await (await readyDb()).getAll("people"), PEOPLE);
  }
  async listCases(): Promise<Case[]> {
    return (await readyDb()).getAll("cases");
  }

  async listTasks(): Promise<Task[]> {
    return (await readyDb()).getAll("tasks");
  }
  async putTasks(tasks: Task[]): Promise<void> {
    await putAll(await settledDb(), "tasks", tasks);
  }

  async getCurrentUserId(): Promise<PersonId | null> {
    await readyDb();
    return sessionStorage.getItem(USER_KEY) ?? localStorage.getItem(USER_KEY) ?? DEFAULT_USER_ID;
  }
  async putCurrentUserId(id: PersonId): Promise<void> {
    await settledDb();
    sessionStorage.setItem(USER_KEY, id);
    localStorage.setItem(USER_KEY, id);
  }

  async putFile(file: StoredFile): Promise<void> {
    await (await settledDb()).put("files", file);
  }
  async getFile(id: string): Promise<StoredFile | null> {
    return (await (await settledDb()).get("files", id)) ?? null;
  }
  async deleteFile(id: string): Promise<void> {
    await (await settledDb()).delete("files", id);
  }

  /** Wipe everything; the next read seeds the demo again ("Reset sandbox data"). */
  async clear(): Promise<void> {
    await wipeAll(await settledDb());
  }
}
