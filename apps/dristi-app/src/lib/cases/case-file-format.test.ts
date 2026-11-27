import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { flattenLeaves, type CaseFileNode } from "./case-file";
import { caseFileBaseId, caseFileTree, isMarkableCaseFileDoc } from "./case-file-format";
import { SandboxCasesRepository } from "./data/sandbox";
import type { CaseFileDocument } from "./types";

const label = (key: string) => key.replace("casesCaseFile_", "");
const none = () => undefined;

const DOCS: CaseFileDocument[] = [
  { id: "complaint", category: "complaint", name: "Complaint", href: "/c.pdf" },
  { id: "cheque", category: "original-filing", name: "Cheque", href: "/f.pdf", page: 2 },
  { id: "bond", category: "bail-bonds", name: "Bail bond - A", href: "/b.pdf" },
  {
    id: "surety",
    category: "bail-bonds",
    name: "Document attached: Surety bond",
    href: "/b.pdf",
    submittedWith: "bond",
  },
  {
    id: "order-1",
    category: "orders",
    name: "Order: One - 1 July 2025",
    href: "/o.pdf",
    linkedTo: ["complaint", "bond"],
  },
  { id: "order-2", category: "orders", name: "Order: Two - 2 July 2025", href: "/o.pdf" },
  { id: "roznama-1", category: "roznamas", name: "Roznama - 1 July 2025", href: "/r.pdf" },
  { id: "app", category: "applications", name: "Bail - CMP/1/2025", href: "/a.pdf" },
  {
    id: "app-doc",
    category: "applications",
    name: "Document attached: Proof of solvency",
    href: "/a.pdf",
    submittedWith: "app",
  },
  {
    id: "objection",
    category: "applications",
    name: "Objection - CMP/1/2025",
    href: "/a.pdf",
    objectsTo: "app",
  },
  { id: "summons", category: "processes", name: "Summons via RPAD - 1 July 2025", href: "/p.pdf" },
  {
    id: "report",
    category: "processes",
    name: "Execution report - 9 July 2025",
    href: "/p.pdf",
    reportOn: "summons",
  },
  {
    id: "order-3",
    category: "orders",
    name: "Order: Three - 3 July 2025",
    href: "/o.pdf",
    linkedTo: ["app", "summons"],
  },
];

function byNumber(nodes: CaseFileNode[], number: string): CaseFileNode | undefined {
  for (const node of nodes) {
    if (node.number === number) return node;
    const found = node.children ? byNumber(node.children, number) : undefined;
    if (found) return found;
  }
  return undefined;
}

describe("case file format (case-file.md §2, §6.2)", () => {
  it("puts Roznamas second in Gujarat and leaves it out elsewhere", () => {
    const gujarat = caseFileTree("gujarat", DOCS, none, label);
    const kerala = caseFileTree("kerala", DOCS, none, label);
    assert.equal(gujarat.length, 15);
    assert.equal(gujarat[1].label, "roznamas");
    assert.equal(kerala.length, 14);
    assert.ok(!kerala.some((node) => node.id === "roznamas"));
  });

  it("numbers a single-document section as the section, with its linked orders below", () => {
    const complaint = byNumber(caseFileTree("kerala", DOCS, none, label), "2");
    assert.equal(complaint?.id, "complaint");
    assert.deepEqual(
      complaint?.children?.map((node) => [node.number, node.id]),
      [["2.1", "order-1@complaint"]],
    );
  });

  it("shows what was submitted with a bail bond before the orders on it (CFL-03)", () => {
    const tree = caseFileTree("kerala", DOCS, none, label);
    const bond = tree.find((node) => node.id === "bail-bonds")?.children?.[0];
    assert.deepEqual(
      bond?.children?.map((node) => node.id),
      ["surety@bond", "order-1@bond"],
    );
    assert.equal(tree.find((node) => node.id === "bail-bonds")?.children?.length, 1);
  });

  it("shows an application's documents, then its objection, then its orders (CFL-03, CFL-05)", () => {
    const tree = caseFileTree("kerala", DOCS, none, label);
    const applications = tree.find((node) => node.id === "applications")?.children;
    assert.deepEqual(
      applications?.map((node) => node.id),
      ["app"],
      "the objection and the attachment are not in the section's own list",
    );
    assert.deepEqual(
      applications?.[0].children?.map((node) => node.id),
      ["app-doc@app", "objection@app", "order-3@app"],
    );
  });

  it("shows a process's execution reports before its orders", () => {
    const tree = caseFileTree("kerala", DOCS, none, label);
    const processes = tree.find((node) => node.id === "processes")?.children;
    assert.deepEqual(
      processes?.map((node) => [node.id, node.children?.map((child) => child.id)]),
      [["summons", ["report@summons", "order-3@summons"]]],
    );
  });

  it("splits Orders into linked and independent (CFL-06)", () => {
    const orders = caseFileTree("kerala", DOCS, none, label).find((node) => node.id === "orders");
    assert.deepEqual(
      orders?.children?.map((part) => part.children?.map((node) => node.id)),
      [["order-1", "order-3"], ["order-2"]],
    );
  });

  it("names a marked document with its exhibit number and copies it to Exhibits (CFL-09, CFL-31)", () => {
    const exhibit = (id: string) => (id === "cheque" ? "P1" : undefined);
    const gujarat = caseFileTree("gujarat", DOCS, exhibit, label);
    assert.equal(byNumber(gujarat, "4.1")?.label, "Cheque (P1)");
    const exhibits = gujarat.find((node) => node.id === "exhibits");
    assert.deepEqual(
      exhibits?.children?.map((node) => node.id),
      ["cheque@exhibits"],
    );
    const kerala = caseFileTree("kerala", DOCS, exhibit, label);
    const parts = kerala.find((node) => node.id === "exhibits")?.children;
    assert.deepEqual(
      parts?.map((part) => [part.label, part.children?.length]),
      [
        ["evidenceOfTheComplainant", 1],
        ["evidenceOfTheAccused", 0],
        ["otherEvidence", 0],
      ],
    );
  });

  it("lets only the categories in §1.2 be marked, copies included", () => {
    assert.equal(isMarkableCaseFileDoc(DOCS, "cheque"), true);
    assert.equal(isMarkableCaseFileDoc(DOCS, "cheque@exhibits"), true);
    assert.equal(isMarkableCaseFileDoc(DOCS, "order-1@complaint"), false);
    assert.equal(isMarkableCaseFileDoc(DOCS, "bond"), false);
    assert.equal(isMarkableCaseFileDoc(DOCS, "app"), false, "the application itself");
    assert.equal(isMarkableCaseFileDoc(DOCS, "app-doc"), true, "a document submitted with it");
    assert.equal(isMarkableCaseFileDoc(DOCS, "objection"), false);
    assert.equal(caseFileBaseId("order-1@surety@bond"), "order-1");
  });
});

describe("case file sandbox data", () => {
  it("links orders and attachments only to documents that exist", async () => {
    const documents = await new SandboxCasesRepository().getCaseFile("c-1001");
    const ids = new Set(documents.map((doc) => doc.id));
    assert.equal(ids.size, documents.length, "ids are unique");
    for (const doc of documents) {
      for (const target of doc.linkedTo ?? []) assert.ok(ids.has(target), target);
      if (doc.submittedWith) assert.ok(ids.has(doc.submittedWith), doc.submittedWith);
      if (doc.objectsTo) assert.ok(ids.has(doc.objectsTo), doc.objectsTo);
      if (doc.reportOn) assert.ok(ids.has(doc.reportOn), doc.reportOn);
      if (doc.linkedTo) assert.equal(doc.category, "orders", doc.id);
    }
  });

  it("gives every document in the tree a PDF", async () => {
    const documents = await new SandboxCasesRepository().getCaseFile("c-1001");
    const leaves = flattenLeaves(caseFileTree("gujarat", documents, none, label));
    assert.ok(leaves.length > documents.length, "copies are shown in more than one place");
    for (const leaf of leaves) assert.ok(leaf.href, leaf.id);
  });
});
