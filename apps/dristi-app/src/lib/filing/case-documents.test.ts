import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blankCheque,
  blankComplainant,
  buildDocumentGroups,
  createBlankDraft,
  removeCaseRecord,
  syncIntakeCounts,
} from "./blank";
import {
  caseRecordTargets,
  caseUploadFor,
  findSynced,
  pendingLinks,
  targetForRow,
  unsavedDocuments,
  unsavedRows,
} from "./case-documents";
import type { CaseDocument, FilingDraft, StoredFileRef } from "./types";

const FILE: StoredFileRef = { id: "f1", name: "scan.pdf", size: 10, type: "application/pdf", ext: "PDF" };

/** A draft with two cheques, its list of documents built as the store builds it. */
function twoChequeDraft(): FilingDraft {
  const draft = createBlankDraft("draft-docs");
  draft.cheques.push(blankCheque());
  syncIntakeCounts(draft);
  draft.documents = buildDocumentGroups(draft);
  return draft;
}

function rowNamed(draft: FilingDraft, name: string): CaseDocument {
  const row = draft.documents.flatMap((g) => g.docs).find((d) => d.name === name);
  assert.ok(row, `no row named ${name}`);
  return row;
}

function addCustomRow(draft: FilingDraft, row: Partial<CaseDocument> = {}): CaseDocument {
  const custom: CaseDocument = {
    id: "doc_custom",
    name: "Bank statement",
    required: false,
    file: null,
    quality: null,
    digital: false,
    custom: true,
    ...row,
  };
  draft.documents[0].docs.push(custom);
  return custom;
}

describe("caseUploadFor", () => {
  it("sends every cheque as a bounced cheque, whatever its number", () => {
    const draft = twoChequeDraft();
    for (const key of ["c1f", "c2f"]) {
      assert.equal(caseUploadFor(draft, { kind: "slot", key })?.documentType, "BOUNCED_CHEQUE");
    }
  });

  it("carries the list row's digital tick with the slot it mirrors", () => {
    const draft = twoChequeDraft();
    rowNamed(draft, "Cheque 2").digital = true;
    assert.deepEqual(caseUploadFor(draft, { kind: "slot", key: "c2f" })?.meta, { isDigital: true });
    assert.deepEqual(caseUploadFor(draft, { kind: "slot", key: "c1f" })?.meta, { isDigital: false });
  });

  it("leaves the tick out for a slot the list does not show", () => {
    const draft = twoChequeDraft();
    assert.deepEqual(caseUploadFor(draft, { kind: "slot", key: "sl" }), {
      documentType: "PROOF_OF_TRANSACTION",
      meta: { isDigital: undefined },
    });
  });

  it("sends a custom row as another supporting document, under its typed name", () => {
    const draft = twoChequeDraft();
    addCustomRow(draft, { digital: true });
    assert.deepEqual(caseUploadFor(draft, { kind: "row", id: "doc_custom" }), {
      documentType: "OTHER_SUPPORTING_DOCUMENT",
      meta: { isDigital: true, displayName: "Bank statement" },
    });
  });

  it("has nothing to send for a slot or row that is gone", () => {
    const draft = twoChequeDraft();
    assert.equal(caseUploadFor(draft, { kind: "slot", key: "c9f" }), undefined);
    assert.equal(caseUploadFor(draft, { kind: "row", id: "nope" }), undefined);
  });
});

describe("targetForRow", () => {
  it("saves a mirrored row through the slot it shows", () => {
    const draft = twoChequeDraft();
    assert.deepEqual(targetForRow(draft.intake, rowNamed(draft, "Cheque return memo 2")), {
      kind: "slot",
      key: "c2m",
    });
  });

  it("follows a slot whose key gained a suffix", () => {
    const draft = twoChequeDraft();
    draft.intake.cheques[1].slots[0].key = "c2f-2";
    assert.deepEqual(targetForRow(draft.intake, rowNamed(draft, "Cheque 2")), {
      kind: "slot",
      key: "c2f-2",
    });
  });

  it("saves a custom row as itself", () => {
    const draft = twoChequeDraft();
    const row = addCustomRow(draft);
    assert.deepEqual(targetForRow(draft.intake, row), { kind: "row", id: "doc_custom" });
  });
});

describe("findSynced", () => {
  it("never treats a mirrored row as a record of its own", () => {
    const draft = twoChequeDraft();
    assert.equal(findSynced(draft, { kind: "row", id: rowNamed(draft, "Cheque 1").id }), undefined);
  });
});

describe("complainant document links", () => {
  /** A draft with two complainants (and so two party cards), the first saved on the case. */
  function twoComplainantDraft(): FilingDraft {
    const draft = createBlankDraft("draft-links");
    draft.complainants.push(blankComplainant());
    syncIntakeCounts(draft);
    draft.complainants[0].caseParticipantIds = ["p-1"];
    draft.documents = buildDocumentGroups(draft);
    return draft;
  }

  it("uploads a saved complainant's identity proof linked to them", () => {
    const draft = twoComplainantDraft();
    const upload = caseUploadFor(draft, { kind: "slot", key: "p1id" });
    assert.equal(upload?.documentType, "IDENTITY_PROOF");
    assert.equal(upload?.meta.caseParticipantId, "p-1");
  });

  it("leaves the link out until the complainant is on the case", () => {
    const draft = twoComplainantDraft();
    const meta = caseUploadFor(draft, { kind: "slot", key: "p2vak" })?.meta;
    assert.equal(meta?.caseParticipantId, undefined);
  });

  it("never links a party's other documents or a cheque to anyone", () => {
    const draft = twoComplainantDraft();
    for (const key of ["c1f", "sl"]) {
      const meta = caseUploadFor(draft, { kind: "slot", key })?.meta;
      assert.equal(meta && "caseParticipantId" in meta, false, key);
    }
  });

  it("lists saved documents not yet linked to their complainant", () => {
    const draft = twoComplainantDraft();
    const [idProof, poa, vakalatnama] = draft.intake.parties[0].slots;
    idProof.caseDocumentId = "d-id";
    vakalatnama.caseDocumentId = "d-vak";
    vakalatnama.linkedParticipantId = "p-1";
    poa.caseDocumentId = "d-poa";
    poa.syncing = true;
    // Complainant 2 is not saved, so their document waits.
    draft.intake.parties[1].slots[0].caseDocumentId = "d-id-2";

    assert.deepEqual(pendingLinks(draft), [
      { target: { kind: "slot", key: "p1id" }, caseDocumentId: "d-id", participantId: "p-1" },
    ]);
  });

  it("relinks a document when its complainant is added again under a new id", () => {
    const draft = twoComplainantDraft();
    const vakalatnama = draft.intake.parties[0].slots[2];
    vakalatnama.caseDocumentId = "d-vak";
    vakalatnama.linkedParticipantId = "p-old";
    assert.deepEqual(
      pendingLinks(draft, () => "p-new").map((l) => [l.caseDocumentId, l.participantId]),
      [["d-vak", "p-new"]]
    );
  });
});

describe("unsavedDocuments", () => {
  it("lists slots and custom rows whose file failed to save, by their names", () => {
    const draft = twoChequeDraft();
    draft.caseId = "case-1";
    const slot = draft.intake.cheques[1].slots[0];
    slot.file = FILE;
    slot.syncError = "Offline";
    addCustomRow(draft, { name: "", file: FILE, syncError: "Too large" });
    // A failed save with no file left is not something to retry.
    draft.intake.cheques[0].slots[0].syncError = "Offline";

    assert.deepEqual(
      unsavedDocuments(draft).map(({ label, error }) => ({ label, error })),
      [
        { label: slot.label, error: "Offline" },
        { label: "Other document", error: "Too large" },
      ]
    );
  });

  it("lists nothing for a draft that is never sent to the case", () => {
    const draft = twoChequeDraft();
    draft.intake.cheques[0].slots[0].file = FILE;
    draft.intake.cheques[0].slots[0].syncError = "Offline";
    assert.deepEqual(unsavedDocuments(draft), []);
  });
});

describe("unsavedRows", () => {
  it("lists only the rows shown, named as the list names them", () => {
    const draft = twoChequeDraft();
    draft.caseId = "case-1";
    const cheque2 = draft.intake.cheques[1].slots[0];
    cheque2.file = FILE;
    cheque2.syncError = "Offline";
    // The supporting slot is not on the list of documents, so the list never offers it.
    const supporting = draft.intake.supporting[0];
    supporting.file = FILE;
    supporting.syncError = "Offline";

    assert.deepEqual(
      unsavedRows(draft, draft.documents).map(({ label, target }) => ({ label, target })),
      [{ label: "Cheque 2", target: { kind: "slot", key: cheque2.key } }]
    );
    // A group the step hides is not offered either.
    assert.deepEqual(unsavedRows(draft, draft.documents.slice(1)), []);
  });
});

describe("caseUploadFor — after a cheque is removed and another added", () => {
  it("sends each cheque's own digital tick, never its neighbour's", () => {
    const draft = twoChequeDraft();
    removeCaseRecord(draft, "cheque", 0);
    draft.cheques.push(blankCheque());
    syncIntakeCounts(draft);
    draft.documents = buildDocumentGroups(draft);
    const keys = draft.intake.cheques.map((g) => g.slots[0].key);
    assert.deepEqual(keys, ["c2f", "c2f-2"]);

    rowNamed(draft, "Cheque 1").digital = true;
    assert.deepEqual(caseUploadFor(draft, { kind: "slot", key: "c2f" })?.meta, { isDigital: true });
    assert.deepEqual(caseUploadFor(draft, { kind: "slot", key: "c2f-2" })?.meta, {
      isDigital: false,
    });
  });
});

describe("removing a complainant", () => {
  /** Three complainants, each with a custom row; complainant 1's ID proof ticked digital. */
  function threeComplainantDraft(): FilingDraft {
    const draft = createBlankDraft("draft-three");
    draft.complainants.push(blankComplainant(), blankComplainant());
    syncIntakeCounts(draft);
    draft.documents = buildDocumentGroups(draft);
    draft.documents[1].docs[0].digital = true;
    draft.documents.slice(1).forEach((group, i) => {
      group.docs.push({
        id: `custom-${i + 1}`,
        name: `C${i + 1} extra`,
        required: false,
        file: null,
        quality: null,
        digital: false,
        custom: true,
      });
    });
    return draft;
  }

  const customNames = (draft: FilingDraft) =>
    draft.documents.slice(1).map((g) => g.docs.filter((d) => d.custom).map((d) => d.name));

  it("keeps each remaining complainant's rows and ticks with them", () => {
    const draft = threeComplainantDraft();
    removeCaseRecord(draft, "party", 0);
    draft.documents = buildDocumentGroups(draft);

    assert.deepEqual(customNames(draft), [["C2 extra"], ["C3 extra"]]);
    assert.equal(draft.documents[1].docs[0].digital, false, "complainant 1's tick moved on");
  });

  it("takes the complainant's slots and custom rows with them", () => {
    const draft = threeComplainantDraft();
    const targets = caseRecordTargets(draft, "party", 1);
    assert.deepEqual(targets.filter((t) => t.kind === "row"), [{ kind: "row", id: "custom-2" }]);
    assert.deepEqual(
      targets.filter((t) => t.kind === "slot").map((t) => (t.kind === "slot" ? t.key : "")),
      draft.intake.parties[1].slots.map((s) => s.key)
    );
  });

  it("takes nothing when only one complainant is left", () => {
    const draft = createBlankDraft("draft-one");
    draft.documents = buildDocumentGroups(draft);
    assert.deepEqual(caseRecordTargets(draft, "party", 0), []);
  });
});
