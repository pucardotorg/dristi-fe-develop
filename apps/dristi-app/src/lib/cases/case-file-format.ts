/**
 * The case file in the format set by case-file.md (dristi-be PRDs, v30): sections in
 * the order the state's format gives (§6.2), documents numbered under them (§2), the
 * documents linked to each one level below it (CFL-03), and Exhibits built from the
 * exhibit numbers given on the case (CFL-09, CFL-31).
 *
 * The documents come from the cases repository (`getCaseFile`); this module only lays
 * them out. A document shown in a second place (CFL-04) gets `<id>@<where>`: an exhibit
 * `<id>@exhibits`, an order under a document `<order>@<that node's id>`.
 * `caseFileBaseId` strips it.
 */
import type { CourtId } from "@/lib/court/profiles";

import type { CaseFileNode } from "./case-file";
import type { CaseFileCategory, CaseFileDocument } from "./types";

/** A section of the case file: a category, or Exhibits, which is built from the others. */
type SectionId = CaseFileCategory | "exhibits";

/** The message keys for the case file's section and sub-section names. */
export type CaseFileLabelKey =
  | "casesCaseFile_synopsis"
  | "casesCaseFile_complaint"
  | "casesCaseFile_originalFilingDocuments"
  | "casesCaseFile_vakalatnamas"
  | "casesCaseFile_affidavits"
  | "casesCaseFile_applications"
  | "casesCaseFile_orders"
  | "casesCaseFile_judgment"
  | "casesCaseFile_roznamas"
  | "casesCaseFile_recordedStatements"
  | "casesCaseFile_processes"
  | "casesCaseFile_bailBonds"
  | "casesCaseFile_paymentReceipts"
  | "casesCaseFile_otherDocuments"
  | "casesCaseFile_exhibits"
  | "casesCaseFile_ordersLinkedToOtherDocuments"
  | "casesCaseFile_independentOrders"
  | "casesCaseFile_evidenceOfTheComplainant"
  | "casesCaseFile_evidenceOfTheAccused"
  | "casesCaseFile_otherEvidence";

/** Turns a label key into text in the reader's language. */
export type CaseFileLabel = (key: CaseFileLabelKey) => string;

/** A document's exhibit number, if it has one. */
export type ExhibitFor = (docId: string) => string | undefined;

const SECTION_LABEL: Record<SectionId, CaseFileLabelKey> = {
  synopsis: "casesCaseFile_synopsis",
  complaint: "casesCaseFile_complaint",
  "original-filing": "casesCaseFile_originalFilingDocuments",
  vakalatnamas: "casesCaseFile_vakalatnamas",
  affidavits: "casesCaseFile_affidavits",
  applications: "casesCaseFile_applications",
  orders: "casesCaseFile_orders",
  judgment: "casesCaseFile_judgment",
  roznamas: "casesCaseFile_roznamas",
  "recorded-statements": "casesCaseFile_recordedStatements",
  processes: "casesCaseFile_processes",
  "bail-bonds": "casesCaseFile_bailBonds",
  "payment-receipts": "casesCaseFile_paymentReceipts",
  "other-documents": "casesCaseFile_otherDocuments",
  exhibits: "casesCaseFile_exhibits",
};

/** Categories whose documents can be marked as evidence (§1.2). */
const MARKABLE: ReadonlySet<CaseFileCategory> = new Set([
  "original-filing",
  "affidavits",
  "applications",
  "recorded-statements",
  "other-documents",
]);

/** Synopsis, Complaint and Judgment hold one document, numbered as the section (CFL-02). */
const SINGLE: ReadonlySet<SectionId> = new Set(["synopsis", "complaint", "judgment"]);

/** §6.2: Gujarat's starting format. */
const GUJARAT: SectionId[] = [
  "synopsis",
  "roznamas",
  "complaint",
  "original-filing",
  "affidavits",
  "applications",
  "orders",
  "judgment",
  "recorded-statements",
  "processes",
  "bail-bonds",
  "vakalatnamas",
  "exhibits",
  "other-documents",
  "payment-receipts",
];

/** §6.2 and §6.1: Roznamas is a section only where Roznama is a separate document. */
const WITHOUT_ROZNAMAS = GUJARAT.filter((section) => section !== "roznamas");

const FORMAT: Record<CourtId, SectionId[]> = {
  gujarat: GUJARAT,
  "punjab-haryana": WITHOUT_ROZNAMAS,
  kerala: WITHOUT_ROZNAMAS,
};

/** §6.1: Exhibits splits by party only where evidence is marked separately by party. */
const EVIDENCE_BY_PARTY: Record<CourtId, boolean> = {
  gujarat: false,
  "punjab-haryana": false,
  kerala: true,
};

type LinkedKind = "attachments" | "objections" | "reports" | "orders";

/** §6.2, "Linked to each document, in order": the kinds of linked document a section shows under each document. */
const LINKED_KINDS: Partial<Record<SectionId, LinkedKind[]>> = {
  complaint: ["orders"],
  "original-filing": ["orders"],
  affidavits: ["orders"],
  applications: ["attachments", "objections", "orders"],
  "recorded-statements": ["orders"],
  processes: ["reports", "orders"],
  "bail-bonds": ["attachments", "orders"],
  vakalatnamas: ["orders"],
  exhibits: ["orders"],
  "other-documents": ["orders"],
  "payment-receipts": ["orders"],
};

const COPY = "@";

/** The document a node shows, for a copy shown in a second place (CFL-04). */
export function caseFileBaseId(id: string): string {
  return id.split(COPY)[0];
}

/** Whether a document's category lets it be marked as evidence (§1.2). */
export function isMarkableCaseFileDoc(documents: CaseFileDocument[], id: string): boolean {
  const doc = documents.find((item) => item.id === caseFileBaseId(id));
  return Boolean(doc && markable(doc));
}

/** §1.2: of an application, only the documents submitted with it can be marked. */
function markable(doc: CaseFileDocument): boolean {
  if (doc.category === "applications") return Boolean(doc.submittedWith);
  return MARKABLE.has(doc.category);
}

/** CFL-31: the exhibit number in brackets at the end of the name. */
function named(doc: CaseFileDocument, exhibitFor: ExhibitFor): string {
  const exhibit = exhibitFor(doc.id);
  return exhibit ? `${doc.name} (${exhibit})` : doc.name;
}

/** Party of an exhibit from its prefix: P complainant, D accused, anything else other. */
function exhibitParty(exhibit: string): "complainant" | "accused" | "other" {
  if (/^P\d/i.test(exhibit)) return "complainant";
  if (/^D\d/i.test(exhibit)) return "accused";
  return "other";
}

const PARTY_ORDER = { complainant: 0, accused: 1, other: 2 } as const;

/**
 * The case file for a state, numbered as shown (CFL-01, CFL-02, CFL-08). `documents`
 * are in the order each came into the case; `label` names sections in the reader's
 * language.
 */
export function caseFileTree(
  court: CourtId,
  documents: CaseFileDocument[],
  exhibitFor: ExhibitFor,
  label: CaseFileLabel,
): CaseFileNode[] {
  /** The documents shown under `doc` in a section, in the format's order (CFL-03). */
  function linkedTo(doc: CaseFileDocument, section: SectionId): CaseFileDocument[] {
    return (LINKED_KINDS[section] ?? []).flatMap((kind) =>
      documents.filter((item) => {
        if (kind === "attachments") return item.submittedWith === doc.id;
        if (kind === "objections") return item.objectsTo === doc.id;
        if (kind === "reports") return item.reportOn === doc.id;
        return item.category === "orders" && item.linkedTo?.includes(doc.id);
      }),
    );
  }

  /** One document at `number`, with its linked documents one level below. */
  function docNode(
    doc: CaseFileDocument,
    id: string,
    number: string,
    section: SectionId,
  ): CaseFileNode {
    const linked = linkedTo(doc, section);
    return {
      id,
      number,
      label: named(doc, exhibitFor),
      href: doc.href,
      page: doc.page,
      docket: doc.docket,
      children:
        linked.length > 0
          ? linked.map((item, index) => ({
              id: `${item.id}${COPY}${id}`,
              number: `${number}.${index + 1}`,
              label: named(item, exhibitFor),
              href: item.href,
              page: item.page,
              docket: item.docket,
            }))
          : undefined,
    };
  }

  function numbered(
    docs: CaseFileDocument[],
    number: string,
    section: SectionId,
    copyOf?: string,
  ): CaseFileNode[] {
    return docs.map((doc, index) =>
      docNode(
        doc,
        copyOf ? `${doc.id}${COPY}${copyOf}` : doc.id,
        `${number}.${index + 1}`,
        section,
      ),
    );
  }

  function folder(
    id: string,
    number: string,
    key: CaseFileLabelKey,
    children: CaseFileNode[],
  ): CaseFileNode {
    return { id, number, label: label(key), children };
  }

  return FORMAT[court].map((section, index): CaseFileNode => {
    const number = String(index + 1);
    const key = SECTION_LABEL[section];

    if (section === "exhibits") {
      const marked = documents
        .filter((doc) => markable(doc) && exhibitFor(doc.id))
        .sort((a, b) => {
          const x = exhibitFor(a.id) ?? "";
          const y = exhibitFor(b.id) ?? "";
          const party = PARTY_ORDER[exhibitParty(x)] - PARTY_ORDER[exhibitParty(y)];
          return party || x.localeCompare(y, undefined, { numeric: true });
        });
      if (!EVIDENCE_BY_PARTY[court]) {
        return folder(section, number, key, numbered(marked, number, section, section));
      }
      const parts = [
        { id: "complainant", key: "casesCaseFile_evidenceOfTheComplainant" },
        { id: "accused", key: "casesCaseFile_evidenceOfTheAccused" },
        { id: "other", key: "casesCaseFile_otherEvidence" },
      ] as const;
      return folder(
        section,
        number,
        key,
        parts.map((part, partIndex) => {
          const sub = `${number}.${partIndex + 1}`;
          const docs = marked.filter((doc) => exhibitParty(exhibitFor(doc.id) ?? "") === part.id);
          return folder(
            `${section}-${part.id}`,
            sub,
            part.key,
            numbered(docs, sub, section, section),
          );
        }),
      );
    }

    /* Attachments, objections and execution reports sit under the document they belong to. */
    const docs = documents.filter(
      (doc) => doc.category === section && !doc.submittedWith && !doc.objectsTo && !doc.reportOn,
    );

    if (section === "orders") {
      const parts = [
        {
          id: "linked",
          key: "casesCaseFile_ordersLinkedToOtherDocuments",
          docs: docs.filter((doc) => doc.linkedTo?.length),
        },
        {
          id: "independent",
          key: "casesCaseFile_independentOrders",
          docs: docs.filter((doc) => !doc.linkedTo?.length),
        },
      ] as const;
      return folder(
        section,
        number,
        key,
        parts.map((part, partIndex) => {
          const sub = `${number}.${partIndex + 1}`;
          return folder(`${section}-${part.id}`, sub, part.key, numbered(part.docs, sub, section));
        }),
      );
    }

    if (SINGLE.has(section) && docs.length === 1) {
      return docNode(docs[0], docs[0].id, number, section);
    }

    return folder(section, number, key, numbered(docs, number, section));
  });
}
