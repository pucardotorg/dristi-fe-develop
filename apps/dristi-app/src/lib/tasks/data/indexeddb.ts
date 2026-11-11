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

let dbPromise: Promise<IDBPDatabase<TasksDB>> | null = null;

function db(): Promise<IDBPDatabase<TasksDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TasksDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        database.createObjectStore("people", { keyPath: "id" });
        database.createObjectStore("cases", { keyPath: "id" });
        database.createObjectStore("tasks", { keyPath: "id" });
        database.createObjectStore("files", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

async function putAll<S extends "people" | "cases" | "tasks">(
  store: S,
  rows: TasksDB[S]["value"][]
): Promise<void> {
  const tx = (await db()).transaction(store, "readwrite");
  await Promise.all([...rows.map((row) => tx.store.put(row)), tx.done]);
}

/** Empty every store and forget who this browser was viewing as. */
async function wipeAll(): Promise<void> {
  const d = await db();
  const tx = d.transaction(["people", "cases", "tasks", "files"], "readwrite");
  await Promise.all([
    tx.objectStore("people").clear(),
    tx.objectStore("cases").clear(),
    tx.objectStore("tasks").clear(),
    tx.objectStore("files").clear(),
    tx.done,
  ]);
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
 * Only the page's first pass starts over (a fresh page, or data from an older stamp);
 * after it, a read only seeds a sandbox that is empty (just reset), so nothing done in
 * this page is wiped mid-session, say by the read after a task change past midnight.
 * The reads the store makes together (people, cases, tasks, current person) share one
 * pass, so the current person is read after any wipe. A failed pass changes nothing it
 * has not finished, and the next read tries again.
 */
function prepareRead(): Promise<void> {
  checking ??= (async () => {
    const first = !firstPassDone;
    const hasPeople = (await (await db()).count("people")) > 0;
    const action = seedAction({
      freshPage: first && RESEED_ON_PAGE_LOAD,
      hasPeople,
      stampIsCurrent: first ? stampIsCurrent() : true,
    });
    if (action === "wipe-and-seed") await wipeAll();
    if (action !== "keep") {
      await Promise.all([putAll("people", PEOPLE), putAll("cases", CASES), putAll("tasks", buildTasks())]);
      rememberSeed();
    }
    firstPassDone = true;
  })().finally(() => {
    checking = null;
  });
  return checking;
}

/**
 * Writes never start a pass (it could wipe mid-change); they wait for one running. The
 * store always reads before it writes, so a page's first pass has run by then.
 */
async function afterPass(): Promise<void> {
  if (checking) await checking;
}

export class IndexedDbTasksRepository implements TasksRepository {
  async listPeople(): Promise<Person[]> {
    await prepareRead();
    return orderBySeed(await (await db()).getAll("people"), PEOPLE);
  }
  async putPeople(people: Person[]): Promise<void> {
    await afterPass();
    await putAll("people", people);
  }

  async listCases(): Promise<Case[]> {
    await prepareRead();
    return (await db()).getAll("cases");
  }
  async putCases(cases: Case[]): Promise<void> {
    await afterPass();
    await putAll("cases", cases);
  }

  async listTasks(): Promise<Task[]> {
    await prepareRead();
    return (await db()).getAll("tasks");
  }
  async putTask(task: Task): Promise<void> {
    await afterPass();
    await (await db()).put("tasks", task);
  }
  async putTasks(tasks: Task[]): Promise<void> {
    await afterPass();
    await putAll("tasks", tasks);
  }

  async getCurrentUserId(): Promise<PersonId | null> {
    await prepareRead();
    return sessionStorage.getItem(USER_KEY) ?? localStorage.getItem(USER_KEY) ?? DEFAULT_USER_ID;
  }
  async putCurrentUserId(id: PersonId): Promise<void> {
    await afterPass();
    sessionStorage.setItem(USER_KEY, id);
    localStorage.setItem(USER_KEY, id);
  }

  async putFile(file: StoredFile): Promise<void> {
    await afterPass();
    await (await db()).put("files", file);
  }
  async getFile(id: string): Promise<StoredFile | null> {
    await afterPass();
    return (await (await db()).get("files", id)) ?? null;
  }
  async deleteFile(id: string): Promise<void> {
    await afterPass();
    await (await db()).delete("files", id);
  }

  /** Wipe everything; the next read seeds the demo again ("Reset sandbox data"). */
  async clear(): Promise<void> {
    await afterPass();
    await wipeAll();
  }
}
