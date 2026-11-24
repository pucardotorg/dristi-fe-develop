/**
 * The esign sandbox: answers the contract from IndexedDB in this browser. Design
 * owns this file.
 *
 * It stands in for the backend and for C-DAC together. `startSigning` opens a transaction
 * and sends the browser to the app's own stand-in provider page (`/esign/sandbox`) instead
 * of C-DAC; that page reports the person's choice through `settleSandboxTransaction`, as
 * C-DAC's callback does for the backend, and sends the browser to the same landing route
 * the backend redirects to. The signed file is a made-up id: no PDF is signed here.
 *
 * Checks what the backend checks before it calls C-DAC (spec 0015 §6.1): a file id and a
 * placement on a real page with a real size. It does not refuse a second attempt while one
 * is open, which the backend does for a case filing (one signer at a time).
 *
 * Transactions survive a page reload, as the round trip through the provider page needs.
 */

import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";

import { ApiError } from "@/lib/api";

import { SANDBOX_PROVIDER_PATH } from "../esign-flow";
import type {
  EsignTransaction,
  SandboxSigningOutcome,
  SigningRequest,
  StartSigningInput,
} from "../types";
import type { EsignRepository } from "./repository";

const DB_NAME = "dristi-esign";
// Raise this when you add a store, and create stores only if they're missing, so a
// browser on an older version upgrades cleanly. A browser on a newer version (from
// another branch) is reset, below.
const DB_VERSION = 1;

/** How long the stand-in provider page may take, as the backend's transaction TTL. */
const TTL_MS = 15 * 60 * 1000;

type StoredTransaction = EsignTransaction & { expiresAt: string };

interface EsignDB extends DBSchema {
  transactions: { key: string; value: StoredTransaction };
}

let dbPromise: Promise<IDBPDatabase<EsignDB>> | null = null;

function openDatabase(): Promise<IDBPDatabase<EsignDB>> {
  return openDB<EsignDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("transactions")) {
        database.createObjectStore("transactions", { keyPath: "transactionId" });
      }
    },
    blocking() {
      // Another tab is opening a newer version: let go, so it isn't left waiting.
      void dbPromise?.then((database) => database.close());
      dbPromise = null;
    },
  });
}

async function openOrReset(): Promise<IDBPDatabase<EsignDB>> {
  try {
    return await openDatabase();
  } catch (error) {
    // This browser has a newer version, left by another branch. It holds only demo
    // data, so start it over instead of failing every call.
    if (!(error instanceof DOMException && error.name === "VersionError")) throw error;
    await deleteDB(DB_NAME);
    return openDatabase();
  }
}

function db(): Promise<IDBPDatabase<EsignDB>> {
  dbPromise ??= openOrReset().catch((error: unknown) => {
    dbPromise = null; // let the next call try again
    throw error;
  });
  return dbPromise;
}

function refused(status: number, message: string, code: string): ApiError {
  return new ApiError({ kind: "http", status, message, code });
}

/** An open attempt past its time reads as expired, as on the backend. */
function current(t: StoredTransaction): StoredTransaction {
  const open = t.status === "PENDING" || t.status === "SIGNING";
  return open && Date.parse(t.expiresAt) < Date.now() ? { ...t, status: "EXPIRED" } : t;
}

function publicView({ expiresAt: _expiresAt, ...t }: StoredTransaction): EsignTransaction {
  return t;
}

export class IndexedDbEsignRepository implements EsignRepository {
  async startSigning(input: StartSigningInput): Promise<SigningRequest> {
    const p = input.placeholder;
    if (!input.fileId.trim()) {
      throw refused(404, "The document to sign could not be found.", "E03002");
    }
    if (!input.module.trim() || p.page < 1 || p.width < 1 || p.height < 1 || p.x < 0 || p.y < 0) {
      throw refused(400, "The signature placement is not valid for this document.", "E03004");
    }
    const transaction: StoredTransaction = {
      transactionId: crypto.randomUUID(),
      status: "SIGNING",
      entityType: input.entityType,
      entityId: input.entityId,
      sourceFileId: input.fileId,
      signedFileId: null,
      failureCode: null,
      failureMessage: null,
      expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
    };
    await (await db()).put("transactions", transaction);
    return {
      transactionId: transaction.transactionId,
      expiresAt: transaction.expiresAt,
      url: SANDBOX_PROVIDER_PATH,
      method: "GET",
      fields: { transaction_id: transaction.transactionId },
    };
  }

  async getTransaction(transactionId: string): Promise<EsignTransaction> {
    const stored = await (await db()).get("transactions", transactionId);
    if (!stored) throw refused(404, "No signing transaction with that id.", "E00404");
    return publicView(current(stored));
  }

  async settleSandboxTransaction(
    transactionId: string,
    outcome: SandboxSigningOutcome,
  ): Promise<void> {
    const database = await db();
    const stored = await database.get("transactions", transactionId);
    if (!stored) throw refused(404, "No signing transaction with that id.", "E00404");
    const t = current(stored);
    if (t.status !== "SIGNING" && t.status !== "PENDING") {
      throw refused(409, "This signing transaction can no longer be completed.", "E03016");
    }
    await database.put(
      "transactions",
      outcome === "success"
        ? { ...t, status: "SUCCESS", signedFileId: crypto.randomUUID() }
        : {
            ...t,
            status: "FAILURE",
            failureCode: "SANDBOX_DECLINED",
            failureMessage: "Signing was cancelled on the sandbox provider page.",
          },
    );
  }

  async clear(): Promise<void> {
    await (await db()).clear("transactions");
  }
}
