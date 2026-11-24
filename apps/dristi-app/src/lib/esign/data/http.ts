/**
 * The esign repository against the DRISTI backend. Engineering owns this file.
 *
 * It implements the contract (`repository.ts`) one method at a time, as the backend's
 * endpoints arrive, calling them through `@/lib/api` and translating backend shapes
 * into the app's types (`../esign-api.ts`), so backend naming never reaches a screen.
 * Until a method exists, calling it rejects with `NotIntegratedError`.
 *
 *   startSigning     POST  /esign/_esign                    → transaction, form for C-DAC
 *   getTransaction   GET   /esign/transactions/{id}         → status, signed_file_id
 *
 * The proxy adds the trailing slash to every path, as it does for every other endpoint.
 */

import { api, type ApiClient } from "@/lib/api";

import {
  toSigningRequest,
  toStartSigningBody,
  toTransaction,
  type SigningRequestResponse,
  type TransactionResponse,
} from "../esign-api";
import type { EsignTransaction, SigningRequest, StartSigningInput } from "../types";
import type { EsignRepository } from "./repository";

export class HttpEsignRepository implements Partial<EsignRepository> {
  constructor(private readonly client: ApiClient = api) {}

  async startSigning(input: StartSigningInput): Promise<SigningRequest> {
    const body = await this.client.post<SigningRequestResponse>(
      "esign/_esign",
      toStartSigningBody(input),
    );
    return toSigningRequest(body);
  }

  async getTransaction(transactionId: string, signal?: AbortSignal): Promise<EsignTransaction> {
    const body = await this.client.get<TransactionResponse>(
      `esign/transactions/${encodeURIComponent(transactionId)}`,
      { signal },
    );
    return toTransaction(body);
  }
}
