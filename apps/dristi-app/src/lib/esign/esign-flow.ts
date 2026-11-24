/**
 * The browser's side of an e-sign round trip, as plain functions: which form to post, how
 * to read the return to this app, and how long to keep asking for the outcome.
 */

import type { SigningRequest, TransactionStatus } from "./types";

/**
 * The landing route the backend sends the browser back to. The backend's
 * `ESIGN_UI_REDIRECT_URL` is this app's origin followed by this path.
 */
export const ESIGN_RETURN_PATH = "/esign/return";

/** The sandbox's stand-in for C-DAC's page. */
export const SANDBOX_PROVIDER_PATH = "/esign/sandbox";

/** What the browser posts: where, how, and the fields in the backend's order. */
export type ProviderForm = {
  action: string;
  method: "POST" | "GET";
  entries: [string, string][];
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The form to post to the provider, or `null` when the address cannot be trusted with a
 * signing request: it must be https (http only on this machine, for a local backend's mock
 * provider), or a path in this app (the sandbox's stand-in page).
 */
export function providerForm(request: SigningRequest): ProviderForm | null {
  const url = request.url.trim();
  if (url.startsWith("/") && !url.startsWith("//")) {
    return { action: url, method: request.method, entries: Object.entries(request.fields) };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const secure =
    parsed.protocol === "https:" ||
    (parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.host.split(":")[0]));
  if (!secure) return null;
  return { action: parsed.href, method: request.method, entries: Object.entries(request.fields) };
}

/** What the backend's redirect carries. `status` is a hint; the transaction is the answer. */
export type EsignReturn = { transactionId: string; statusHint: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The return to this app, or `null` when it names no transaction. */
export function parseEsignReturn(params: URLSearchParams): EsignReturn | null {
  const transactionId = params.get("transaction_id")?.trim() ?? "";
  if (!UUID.test(transactionId)) return null;
  return { transactionId, statusHint: params.get("status")?.trim() || null };
}

/** The attempt is over: nothing more will change it. */
export function isSettled(status: TransactionStatus): boolean {
  return status === "SUCCESS" || status === "FAILURE" || status === "EXPIRED";
}

/** How many times the landing page asks before saying the outcome is not known yet. */
export const MAX_POLLS = 15;

/** The wait before poll `n` (0-based): quick at first, then every three seconds. */
export function pollDelayMs(n: number): number {
  return n < 3 ? 1000 : 3000;
}
