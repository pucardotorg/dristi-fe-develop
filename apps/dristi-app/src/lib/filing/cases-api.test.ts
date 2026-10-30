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

describe("parties", () => {
  const party = {
    person: { name: "Asha" },
    address: { line1: "12 MG Road" },
    is_party_in_person: false,
    additional_details: {},
  };

  it("adds a complainant or an accused on the role's own path", async () => {
    const { cases, calls } = setup(() =>
      Response.json({ case_participant_id: "p1", role: "ACCUSED", meta: META }, { status: 201 })
    );
    assert.equal(await cases.addParty("c0ffee", "accused", party), "p1");
    assert.equal(calls[0].url, "/api/v1/cases/c0ffee/accused");
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, party);
  });

  it("refuses a response without a participant id", async () => {
    const { cases } = setup(() => Response.json({ meta: META }, { status: 201 }));
    await assert.rejects(cases.addParty("c0ffee", "complainants", party));
  });

  it("patches and removes a participant by its own id", async () => {
    const { cases, calls } = setup((call) =>
      call.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json({ case_participant_id: "p1", meta: META })
    );
    await cases.updateParticipant("p1", {
      name_at_filing: "Asha",
      phone_number_at_filing: null,
      gender_at_filing: null,
      age_at_filing: null,
      address: {},
      is_party_in_person: false,
      additional_details: {},
    });
    await cases.removeParticipant("p1");
    assert.equal(calls[0].url, "/api/v1/case-participants/p1");
    assert.equal(calls[0].method, "PATCH");
    assert.equal(calls[1].url, "/api/v1/case-participants/p1");
    assert.equal(calls[1].method, "DELETE");
  });
});

describe("advocates", () => {
  it("searches approved advocates and reads the page of results", async () => {
    const { cases, calls } = setup(() =>
      Response.json({
        count: 1,
        next: null,
        previous: null,
        results: [{ id: "adv-1", name: "Anitha R", bar_registration_id: "K/0421/2004" }],
        meta: META,
      })
    );
    assert.deepEqual(await cases.searchAdvocates(" K/04 "), [
      { id: "adv-1", name: "Anitha R", barNumber: "K/0421/2004" },
    ]);
    assert.equal(calls[0].url, "/api/v1/advocates?search=K%2F04");
  });

  it("does not search on fewer than two characters", async () => {
    const { cases, calls } = setup(() => Response.json({ results: [], meta: META }));
    assert.deepEqual(await cases.searchAdvocates(" o "), []);
    assert.equal(calls.length, 0);
  });

  it("searches on two characters, for a short name", async () => {
    const { cases, calls } = setup(() => Response.json({ results: [], meta: META }));
    await cases.searchAdvocates("om");
    assert.equal(calls[0].url, "/api/v1/advocates?search=om");
  });

  it("adds one advocate for several clients and returns the representations", async () => {
    const { cases, calls } = setup(() =>
      Response.json(
        { representation_ids: ["r1", "r2"], advocate_id: "adv-1", meta: META },
        { status: 201 }
      )
    );
    assert.deepEqual(await cases.addAdvocate("c0ffee", "adv-1", ["p1", "p2"]), ["r1", "r2"]);
    assert.equal(calls[0].url, "/api/v1/cases/c0ffee/advocates");
    assert.deepEqual(calls[0].body, { advocate_id: "adv-1", client_participant_ids: ["p1", "p2"] });
  });

  it("ends a representation by its own id", async () => {
    const { cases, calls } = setup(() => new Response(null, { status: 204 }));
    await cases.endRepresentation("r1");
    assert.equal(calls[0].url, "/api/v1/representations/r1");
    assert.equal(calls[0].method, "DELETE");
  });
});

describe("PoA holders", () => {
  it("adds a holder for the parties they act for and returns the mandates", async () => {
    const { cases, calls } = setup(() =>
      Response.json(
        { case_participant_id: "h1", poa_mandate_ids: ["m1"], role: "POA_HOLDER", meta: META },
        { status: 201 }
      )
    );
    const holder = {
      person: { name: "Suresh Patel" },
      address: { line1: "12 MG Road" },
      represented_participant_ids: ["p1"],
      additional_details: {},
    };
    assert.deepEqual(await cases.addPoaHolder("c0ffee", holder), {
      participantId: "h1",
      mandateIds: ["m1"],
    });
    assert.equal(calls[0].url, "/api/v1/cases/c0ffee/poa-holders");
    assert.deepEqual(calls[0].body, holder);
  });

  it("revokes a mandate by its own id", async () => {
    const { cases, calls } = setup(() => new Response(null, { status: 204 }));
    await cases.revokePoaMandate("m1");
    assert.equal(calls[0].url, "/api/v1/poa-mandates/m1");
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
