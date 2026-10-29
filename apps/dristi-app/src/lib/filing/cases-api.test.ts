import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError, createApiClient } from "@/lib/api";

import {
  caseDocumentType,
  caseFilingErrorMessage,
  createCaseFilingApi,
} from "./data/cases-api";

const META = { timestamp: "2026-10-27T10:00:00+05:30", app_version: "abc", spec_version: "1.0" };

type Call = { url: string; method: string; body: unknown; raw: unknown };

/** The case-filing API over the real API client, answered by `respond`. */
function setup(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = {
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      raw: init?.body,
    };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  const client = createApiClient({ baseUrl: "/api/v1", fetchImpl, getCsrfToken: () => "tok" });
  return { cases: createCaseFilingApi(client), calls };
}

const httpError = (status: number, codes: string[]) =>
  new ApiError({ kind: "http", status, message: "x", codes });

describe("caseDocumentType", () => {
  it("maps each upload slot to the backend's document type", () => {
    assert.equal(caseDocumentType("cheque-front"), "BOUNCED_CHEQUE");
    assert.equal(caseDocumentType("delivery-proof"), "PROOF_OF_DELIVERY_OF_DEMAND_NOTICE");
    assert.equal(caseDocumentType("poa"), "POA_DOCUMENT");
    assert.equal(caseDocumentType("other"), "OTHER_SUPPORTING_DOCUMENT");
  });

  it("has no type for identity proof or loan papers yet, so they are not sent", () => {
    assert.equal(caseDocumentType("id-proof"), null);
    assert.equal(caseDocumentType("supporting"), null);
  });
});

describe("startDraft", () => {
  it("opens a cheque bounce draft and returns its session id as the case id", async () => {
    const { cases, calls } = setup(() =>
      Response.json(
        { draft_session_id: "c0ffee", case_type: "CHEQUE_BOUNCE", meta: META },
        { status: 201 }
      )
    );
    assert.deepEqual(await cases.startDraft(), { caseId: "c0ffee" });
    assert.equal(calls[0].url, "/api/v1/cases");
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, { case_type: "CHEQUE_BOUNCE" });
  });

  it("refuses a response without a draft session id", async () => {
    const { cases } = setup(() => Response.json({ meta: META }, { status: 201 }));
    await assert.rejects(cases.startDraft());
  });
});

describe("uploadDocument", () => {
  it("posts the file and its type as multipart to the case", async () => {
    const { cases, calls } = setup(() =>
      Response.json(
        {
          case_id: "c0ffee",
          case_document_id: "doc-1",
          document_id: "file-1",
          document_type: "BOUNCED_CHEQUE",
          meta: META,
        },
        { status: 201 }
      )
    );
    const saved = await cases.uploadDocument(
      "c0ffee",
      new Blob(["%PDF"], { type: "application/pdf" }),
      "cheque.pdf",
      "BOUNCED_CHEQUE"
    );
    assert.deepEqual(saved, {
      caseId: "c0ffee",
      caseDocumentId: "doc-1",
      documentType: "BOUNCED_CHEQUE",
    });
    assert.equal(calls[0].url, "/api/v1/cases/c0ffee/documents");
    assert.ok(calls[0].raw instanceof FormData);
    const form = calls[0].raw as FormData;
    assert.equal(form.get("document_type"), "BOUNCED_CHEQUE");
    assert.equal((form.get("file") as File).name, "cheque.pdf");
  });

  it("encodes the case id in the path", async () => {
    const { cases, calls } = setup(() =>
      Response.json({ case_id: "a/b", case_document_id: "d", meta: META }, { status: 201 })
    );
    await cases.uploadDocument("a/b", new Blob(["x"]), "x.pdf", "RETURN_MEMO");
    assert.equal(calls[0].url, "/api/v1/cases/a%2Fb/documents");
  });
});

describe("deleteDocument", () => {
  it("deletes the case document by its own id", async () => {
    const { cases, calls } = setup(() => new Response(null, { status: 204 }));
    await cases.deleteDocument("doc-1");
    assert.equal(calls[0].url, "/api/v1/case-documents/doc-1");
    assert.equal(calls[0].method, "DELETE");
  });
});

describe("addEvidence", () => {
  it("posts the evidence type, info and linked document to the case", async () => {
    const { cases, calls } = setup(() =>
      Response.json(
        { case_evidence_id: "ev-1", evidence_type: "CHEQUE", ordinal: 1, meta: META },
        { status: 201 }
      )
    );
    const saved = await cases.addEvidence("c0ffee", {
      evidenceType: "CHEQUE",
      evidenceInfo: { amount: 50000, cheque_number: "456789" },
      caseDocumentId: "doc-1",
    });
    assert.deepEqual(saved, { caseEvidenceId: "ev-1", evidenceType: "CHEQUE", ordinal: 1 });
    assert.equal(calls[0].url, "/api/v1/cases/c0ffee/evidence");
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, {
      evidence_type: "CHEQUE",
      evidence_info: { amount: 50000, cheque_number: "456789" },
      case_document_id: "doc-1",
    });
  });

  it("leaves case_document_id out when there is no linked document", async () => {
    const { cases, calls } = setup(() =>
      Response.json({ case_evidence_id: "ev-2", evidence_type: "RETURN_MEMO", ordinal: 1, meta: META }, { status: 201 })
    );
    await cases.addEvidence("c0ffee", { evidenceType: "RETURN_MEMO", evidenceInfo: { return_reason: "x" } });
    assert.ok(!("case_document_id" in (calls[0].body as object)));
  });

  it("refuses a response without an evidence id", async () => {
    const { cases } = setup(() => Response.json({ meta: META }, { status: 201 }));
    await assert.rejects(
      cases.addEvidence("c0ffee", { evidenceType: "CHEQUE", evidenceInfo: {} })
    );
  });
});

describe("updateEvidence", () => {
  it("patches the evidence row by its own id", async () => {
    const { cases, calls } = setup(() =>
      Response.json({ case_evidence_id: "ev-1", evidence_type: "CHEQUE", ordinal: 1, meta: META }, { status: 200 })
    );
    await cases.updateEvidence("ev-1", { evidenceInfo: { amount: 60000 }, caseDocumentId: "doc-9" });
    assert.equal(calls[0].url, "/api/v1/case-evidence/ev-1");
    assert.equal(calls[0].method, "PATCH");
    assert.deepEqual(calls[0].body, { evidence_info: { amount: 60000 }, case_document_id: "doc-9" });
  });

  it("omits case_document_id to keep the current link", async () => {
    const { cases, calls } = setup(() =>
      Response.json({ case_evidence_id: "ev-1", evidence_type: "CHEQUE", ordinal: 1, meta: META }, { status: 200 })
    );
    await cases.updateEvidence("ev-1", { evidenceInfo: { amount: 60000 } });
    assert.ok(!("case_document_id" in (calls[0].body as object)));
  });

  it("sends case_document_id: null to unlink a document", async () => {
    const { cases, calls } = setup(() =>
      Response.json({ case_evidence_id: "ev-1", evidence_type: "CHEQUE", ordinal: 1, meta: META }, { status: 200 })
    );
    await cases.updateEvidence("ev-1", { caseDocumentId: null });
    assert.deepEqual(calls[0].body, { case_document_id: null });
  });
});

describe("deleteEvidence", () => {
  it("deletes the evidence row by its own id", async () => {
    const { cases, calls } = setup(() => new Response(null, { status: 204 }));
    await cases.deleteEvidence("ev-1");
    assert.equal(calls[0].url, "/api/v1/case-evidence/ev-1");
    assert.equal(calls[0].method, "DELETE");
  });
});

describe("caseFilingErrorMessage", () => {
  it("names a submitted case before anything else", () => {
    assert.match(caseFilingErrorMessage(httpError(409, ["E07001"])), /submitted/);
  });

  it("says a document type is not accepted", () => {
    assert.match(caseFilingErrorMessage(httpError(400, ["E07002"])), /doesn't accept/);
  });

  it("reads 404 as an expired or missing draft", () => {
    assert.match(caseFilingErrorMessage(httpError(404, [])), /no longer on the court's server/);
  });

  it("reads 401 and 403 as an ended session", () => {
    assert.match(caseFilingErrorMessage(httpError(401, [])), /Sign in again/);
    assert.match(caseFilingErrorMessage(httpError(403, [])), /Sign in again/);
  });

  it("reports no connection for network failures and timeouts", () => {
    const offline = new ApiError({ kind: "network", message: "x" });
    assert.match(caseFilingErrorMessage(offline), /couldn't reach/);
  });

  it("uses the backend's message for the file otherwise", () => {
    const refused = new ApiError({
      kind: "http",
      status: 400,
      message: "Bad request",
      fieldErrors: { file: ["Upload a PDF, JPEG or PNG."] },
    });
    assert.equal(caseFilingErrorMessage(refused), "Upload a PDF, JPEG or PNG.");
  });
});
