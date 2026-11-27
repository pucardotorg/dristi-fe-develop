import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toSigningRequest, toStartSigningBody, toTransaction } from "./esign-api";
import { isSettled, parseEsignReturn, providerForm } from "./esign-flow";
import type { SigningRequest } from "./types";

const UUID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

function request(url: string, method: SigningRequest["method"] = "POST"): SigningRequest {
  return {
    transactionId: UUID,
    expiresAt: "",
    url,
    method,
    fields: { eSignRequest: "<Esign/>", aspTxnID: "esign-1", "Content-Type": "application/xml" },
  };
}

describe("toStartSigningBody", () => {
  it("sends only the placement keys the backend accepts", () => {
    const body = toStartSigningBody({
      module: "esign",
      entityType: "CASE_FILING",
      entityId: "case-1",
      fileId: "file-1",
      placeholder: {
        page: 6,
        x: 48,
        y: 140,
        width: 240,
        height: 60,
        reason: "Complainant 1",
        signerName: "",
      },
    });
    assert.deepEqual(body, {
      organization_id: null,
      module: "esign",
      entity_type: "CASE_FILING",
      entity_id: "case-1",
      file_id: "file-1",
      sign_placeholder: { page: 6, x: 48, y: 140, width: 240, height: 60, reason: "Complainant 1" },
    });
  });
});

describe("toSigningRequest", () => {
  it("keeps the form fields verbatim", () => {
    const read = toSigningRequest({
      transaction_id: UUID,
      esign_url: "https://esign.example/form",
      form_method: "post",
      form_fields: { eSignRequest: "<Esign/>", aspTxnID: "esign-1" },
    });
    assert.equal(read.method, "POST");
    assert.deepEqual(read.fields, { eSignRequest: "<Esign/>", aspTxnID: "esign-1" });
  });

  it("refuses a field that is not text", () => {
    assert.throws(() =>
      toSigningRequest({ transaction_id: UUID, esign_url: "https://x", form_fields: { a: 1 } }),
    );
  });
});

describe("toTransaction", () => {
  it("reads the status and the signed file", () => {
    const t = toTransaction({
      transaction_id: UUID,
      status: "SUCCESS",
      entity_id: "case-1",
      signed_file_id: "f2",
    });
    assert.equal(t.status, "SUCCESS");
    assert.equal(t.signedFileId, "f2");
    assert.equal(t.entityId, "case-1");
  });

  it("refuses an unknown status", () => {
    assert.throws(() => toTransaction({ transaction_id: UUID, status: "DONE" }));
  });
});

describe("providerForm", () => {
  it("posts to https and to a path in this app", () => {
    assert.equal(
      providerForm(request("https://esign.example/form"))?.action,
      "https://esign.example/form",
    );
    assert.deepEqual(providerForm(request("/esign/sandbox", "GET"))?.entries, [
      ["eSignRequest", "<Esign/>"],
      ["aspTxnID", "esign-1"],
      ["Content-Type", "application/xml"],
    ]);
  });

  it("allows plain http only on this machine", () => {
    assert.ok(providerForm(request("http://localhost:8000/mock")));
    assert.equal(providerForm(request("http://esign.example/form")), null);
    assert.equal(providerForm(request("//esign.example/form")), null);
    assert.equal(providerForm(request("javascript:alert(1)")), null);
  });
});

describe("parseEsignReturn", () => {
  it("reads the transaction and the hint", () => {
    assert.deepEqual(
      parseEsignReturn(new URLSearchParams(`transaction_id=${UUID}&status=SUCCESS`)),
      {
        transactionId: UUID,
        statusHint: "SUCCESS",
      },
    );
  });

  it("refuses a missing or malformed transaction id", () => {
    assert.equal(parseEsignReturn(new URLSearchParams("status=SUCCESS")), null);
    assert.equal(parseEsignReturn(new URLSearchParams("transaction_id=../x")), null);
  });
});

describe("isSettled", () => {
  it("is over once it succeeded, failed or expired", () => {
    assert.equal(isSettled("SIGNING"), false);
    assert.equal(isSettled("PENDING"), false);
    assert.equal(isSettled("SUCCESS"), true);
    assert.equal(isSettled("FAILURE"), true);
    assert.equal(isSettled("EXPIRED"), true);
  });
});
