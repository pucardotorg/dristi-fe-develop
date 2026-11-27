/**
 * The esign contract: every read and write its screens may do.
 *
 * Two implementations answer it: the sandbox in the browser (`./indexeddb.ts`, design)
 * and the backend (`./http.ts`, engineering, filled in as endpoints arrive);
 * `./index.ts` picks one, and screens do not change.
 *
 * Shared by both teams and only grows: add methods (each with a one-line comment on what
 * it returns) and optional fields; never rename or remove one that `http.ts` already
 * implements (the type check fails if you do). No method takes the signed-in person's
 * id: the backend knows who is asking.
 */

import type {
  EsignTransaction,
  SandboxSigningOutcome,
  SigningRequest,
  StartSigningInput,
} from "../types";

export interface EsignRepository {
  /** Open a signing attempt; returns the form the browser posts to the provider. */
  startSigning(input: StartSigningInput): Promise<SigningRequest>;

  /** One signing attempt and where it stands. */
  getTransaction(transactionId: string, signal?: AbortSignal): Promise<EsignTransaction>;

  /**
   * The sandbox's stand-in provider page reporting what the person chose, as C-DAC's
   * callback does for the backend. Sandbox-only: `http.ts` need not implement it.
   */
  settleSandboxTransaction(transactionId: string, outcome: SandboxSigningOutcome): Promise<void>;

  /**
   * Wipe the sandbox's data ("Reset sandbox data", shown only in the sandbox).
   * Sandbox-only: `http.ts` need not implement it.
   */
  clear(): Promise<void>;
}
