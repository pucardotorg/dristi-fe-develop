/**
 * The backend's e-sign shapes (spec 0015 §6) and their translation into the app's types.
 * Kept apart from `data/http.ts` so the translation is tested without a network.
 */

import type {
  EsignTransaction,
  SignPlaceholder,
  SigningRequest,
  StartSigningInput,
  TransactionStatus,
} from "./types";

/** `POST /esign/_esign` request body. */
export type StartSigningBody = {
  organization_id: string | null;
  module: string;
  entity_type: string;
  entity_id: string;
  file_id: string;
  sign_placeholder: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    reason?: string;
    location?: string;
    signer_name?: string;
  };
};

export type SigningRequestResponse = {
  transaction_id?: unknown;
  expires_at?: unknown;
  esign_url?: unknown;
  form_method?: unknown;
  form_fields?: unknown;
};

export type TransactionResponse = {
  transaction_id?: unknown;
  status?: unknown;
  entity_type?: unknown;
  entity_id?: unknown;
  source_file_id?: unknown;
  signed_file_id?: unknown;
  failure_code?: unknown;
  failure_message?: unknown;
};

const STATUSES: readonly TransactionStatus[] = [
  "PENDING",
  "SIGNING",
  "SUCCESS",
  "FAILURE",
  "EXPIRED",
];

const text = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

function unexpected(what: string): Error {
  return new Error(`Unexpected ${what} response from the e-sign service.`);
}

/**
 * The placeholder as the backend takes it. Its serializer refuses any key it does not
 * know, so only these are sent, and empty optional text is left out.
 */
function placeholderBody(p: SignPlaceholder): StartSigningBody["sign_placeholder"] {
  const body: StartSigningBody["sign_placeholder"] = {
    page: p.page,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
  };
  if (p.reason) body.reason = p.reason;
  if (p.location) body.location = p.location;
  if (p.signerName) body.signer_name = p.signerName;
  return body;
}

export function toStartSigningBody(input: StartSigningInput): StartSigningBody {
  return {
    organization_id: input.organizationId ?? null,
    module: input.module,
    entity_type: input.entityType,
    entity_id: input.entityId,
    file_id: input.fileId,
    sign_placeholder: placeholderBody(input.placeholder),
  };
}

export function toSigningRequest(body: SigningRequestResponse | null): SigningRequest {
  const transactionId = text(body?.transaction_id);
  const url = text(body?.esign_url);
  const fields = body?.form_fields;
  if (!transactionId || !url || typeof fields !== "object" || fields === null) {
    throw unexpected("signing request");
  }
  const entries: Record<string, string> = {};
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value !== "string") throw unexpected("signing request");
    entries[name] = value;
  }
  return {
    transactionId,
    expiresAt: text(body?.expires_at) ?? "",
    url,
    // Spec 0015 posts the form; anything else the backend names is read as that.
    method: String(body?.form_method ?? "").toUpperCase() === "GET" ? "GET" : "POST",
    fields: entries,
  };
}

export function toTransaction(body: TransactionResponse | null): EsignTransaction {
  const transactionId = text(body?.transaction_id);
  const status = STATUSES.find((s) => s === body?.status);
  if (!transactionId || !status) throw unexpected("transaction");
  return {
    transactionId,
    status,
    entityType: text(body?.entity_type) ?? "",
    entityId: text(body?.entity_id) ?? "",
    sourceFileId: text(body?.source_file_id),
    signedFileId: text(body?.signed_file_id),
    failureCode: text(body?.failure_code),
    failureMessage: text(body?.failure_message),
  };
}
