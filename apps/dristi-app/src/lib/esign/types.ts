/**
 * Aadhaar e-sign through C-DAC (dristi-be spec 0015): what the screens work with.
 *
 * The browser never talks to C-DAC through `fetch`. The backend prepares a signing request
 * (`startSigning`), the browser posts it to C-DAC as an ordinary form (a full page
 * navigation), C-DAC sends the result to the backend, and the backend sends the browser
 * back to this app's landing route with `?transaction_id=…&status=…`. The landing route
 * then asks the backend for the outcome (`getTransaction`): the query string is only a
 * hint, never the result.
 */

/** What is being signed. The backend checks the signer against it (`CASE_FILING`: spec 0015 §5). */
export type EsignEntityType = "CASE_FILING";

/** Where the signature goes, in PDF points from the page's bottom-left corner. */
export type SignPlaceholder = {
  /** 1-based page number. */
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  reason?: string;
  location?: string;
  signerName?: string;
};

/** A request to sign one stored PDF. */
export type StartSigningInput = {
  module: string;
  entityType: EsignEntityType;
  /** For `CASE_FILING`, the case id. */
  entityId: string;
  /** The stored PDF to sign. */
  fileId: string;
  placeholder: SignPlaceholder;
  /** The court, when known; the backend accepts none. */
  organizationId?: string | null;
};

/** The form the browser posts to the signing provider, exactly as the backend built it. */
export type SigningRequest = {
  transactionId: string;
  expiresAt: string;
  /** Where the browser goes: C-DAC, or the sandbox's stand-in page. */
  url: string;
  method: "POST" | "GET";
  /** Posted verbatim, one form field each. */
  fields: Record<string, string>;
};

export type TransactionStatus = "PENDING" | "SIGNING" | "SUCCESS" | "FAILURE" | "EXPIRED";

/** One signing attempt, as the backend reports it. */
export type EsignTransaction = {
  transactionId: string;
  status: TransactionStatus;
  entityType: string;
  /** For `CASE_FILING`, the case id. */
  entityId: string;
  /** The PDF that was signed. */
  sourceFileId: string | null;
  /** The signed PDF, once `SUCCESS`. */
  signedFileId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
};

/** The two results the sandbox's stand-in provider page offers. */
export type SandboxSigningOutcome = "success" | "failure";
