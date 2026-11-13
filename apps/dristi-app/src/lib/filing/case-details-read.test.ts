import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankCheque, blankNotice, createBlankDraft } from "./blank";
import {
  ADR_SECTION,
  JURISDICTION_SECTION,
  adrFromCase,
  affidavitFromCase,
  chequesFromCase,
  jurisdictionFromCase,
  noticesFromCase,
} from "./case-details-read";
import type { CaseRead, EvidenceRead } from "./data/cases-api";
import { chequeEvidenceInfo, demandNoticeEvidenceInfo, returnMemoEvidenceInfo } from "./evidence";
import { todayIso } from "./format";
import { derivedCauseDate } from "./selectors";
import type { ChequeDetails, DemandNotice } from "./types";

function caseOf(read: Partial<CaseRead>): CaseRead {
  return {
    participants: [],
    representations: [],
    poa_mandates: [],
    evidence: [],
    details: {},
    affidavit: null,
    ...read,
  };
}

function evidence(
  id: string,
  type: string,
  ordinal: number,
  info: Record<string, unknown>
): EvidenceRead {
  return { case_evidence_id: id, case_document_id: null, evidence_type: type, ordinal, evidence_info: info };
}

function cheque(): ChequeDetails {
  return {
    ...blankCheque(),
    dateOnCheque: "2026-06-01",
    amount: "50000",
    chequeNumber: "123456",
    ifsc: "SBIN0001234",
    bankName: "State Bank of India",
    bankBranch: "Kollam",
    presentDate: "2026-06-05",
    returnDate: "2026-06-08",
    returnReason: "funds-insufficient",
  };
}

function notice(): DemandNotice {
  return {
    ...blankNotice(),
    natureDebt: "loan",
    dispatchDate: "2026-06-20",
    modeService: "speed",
    tracking: "EE123456789IN",
    delivered: "yes",
    deliveryDate: "2026-06-24",
    replied: "no",
    paymentStatus: "part",
    partAmount: "10000",
  };
}

describe("chequesFromCase", () => {
  it("reads a cheque and its return memo back as the form typed them", () => {
    const typed = cheque();
    const read = caseOf({
      evidence: [
        evidence("e-memo", "RETURN_MEMO", 1, returnMemoEvidenceInfo(typed)),
        evidence("e-chq", "CHEQUE", 1, chequeEvidenceInfo([typed], 0)),
      ],
    });
    const [c] = chequesFromCase(read, [blankCheque()]);
    assert.deepEqual(
      { ...c, id: "" },
      { ...typed, id: "", chequeEvidenceId: "e-chq", returnMemoEvidenceId: "e-memo" }
    );
  });

  it("takes the case's copy over this browser's for a cheque saved there", () => {
    const local = { ...cheque(), chequeEvidenceId: "e-chq", amount: "60000" };
    const read = caseOf({
      evidence: [evidence("e-chq", "CHEQUE", 1, chequeEvidenceInfo([cheque()], 0))],
    });
    const [c] = chequesFromCase(read, [local]);
    assert.equal(c.id, local.id);
    assert.equal(c.amount, "50000");
  });

  it("pairs cheques and memos by ordinal, and puts them in the case's order", () => {
    const second = { ...cheque(), chequeNumber: "654321" };
    const read = caseOf({
      evidence: [
        evidence("c2", "CHEQUE", 2, chequeEvidenceInfo([second], 0)),
        evidence("c1", "CHEQUE", 1, chequeEvidenceInfo([cheque()], 0)),
        evidence("m2", "RETURN_MEMO", 2, returnMemoEvidenceInfo(second)),
      ],
    });
    const rows = chequesFromCase(read, [blankCheque()]);
    assert.deepEqual(
      rows.map((c) => [c.chequeNumber, c.chequeEvidenceId, c.returnMemoEvidenceId]),
      [
        ["123456", "c1", undefined],
        ["654321", "c2", "m2"],
      ]
    );
  });

  it("keeps a cheque never saved, and one the case no longer has, marked unsaved", () => {
    const typed = cheque();
    const gone = { ...cheque(), chequeEvidenceId: "removed" };
    const rows = chequesFromCase(caseOf({}), [typed, gone]);
    assert.equal(rows[0], typed);
    assert.equal(rows[1].chequeEvidenceId, undefined);
    assert.equal(rows[1].amount, "50000");
  });

  it("keeps a decimal amount readable as the form types it", () => {
    const read = caseOf({
      evidence: [evidence("c1", "CHEQUE", 1, { ...chequeEvidenceInfo([cheque()], 0), amount: "50000.00" })],
    });
    assert.equal(chequesFromCase(read, [])[0].amount, "50000");
  });
});

describe("noticesFromCase", () => {
  it("reads a demand notice back as the form typed it", () => {
    const typed = notice();
    const read = caseOf({
      evidence: [evidence("n1", "LEGAL_DEMAND_NOTICE", 1, demandNoticeEvidenceInfo(typed))],
    });
    const [n] = noticesFromCase(read, [blankNotice()]);
    assert.deepEqual({ ...n, id: "" }, { ...typed, id: "", noticeEvidenceId: "n1" });
  });

  it("reads an undelivered notice's return date and reason", () => {
    const typed: DemandNotice = {
      ...notice(),
      delivered: "no",
      deliveryDate: "",
      returnDate: "2026-06-30",
      nonDeliveryReason: "refused",
    };
    const read = caseOf({
      evidence: [evidence("n1", "LEGAL_DEMAND_NOTICE", 1, demandNoticeEvidenceInfo(typed))],
    });
    const [n] = noticesFromCase(read, []);
    assert.equal(n.delivered, "no");
    assert.equal(n.returnDate, "2026-06-30");
    assert.equal(n.nonDeliveryReason, typed.nonDeliveryReason);
  });
});

describe("jurisdictionFromCase", () => {
  it("leaves the section alone until the case has saved it", () => {
    const draft = createBlankDraft("d1");
    const before = structuredClone(draft.jurisdiction);
    jurisdictionFromCase(caseOf({ details: { [JURISDICTION_SECTION]: {} } }), draft);
    assert.deepEqual(draft.jurisdiction, before);
  });

  it("reads the payee's bank and the other pending complaints", () => {
    const draft = createBlankDraft("d1");
    jurisdictionFromCase(
      caseOf({
        details: {
          [JURISDICTION_SECTION]: {
            cheque_deposited_by_payee: true,
            other_complaints_pending: true,
            cause_of_action_date: "2026-07-10",
            complaint_filing_date: "2026-07-20",
            payee_ifsc_code: "HDFC0000123",
            payee_bank_name: "HDFC Bank",
            payee_bank_branch: "Kochi",
            payee_bank_police_station: "Kochi Central",
            other_complaints: [{ court: "JMFC Kollam", case_number: "ST 12/2026" }],
          },
        },
      }),
      draft
    );
    const j = draft.jurisdiction;
    assert.equal(j.deposited, "yes");
    assert.equal(j.ifsc, "HDFC0000123");
    assert.equal(j.payeePolice, "Kochi Central");
    assert.equal(j.otherPending, "yes");
    assert.deepEqual(j.otherCases, [{ court: "JMFC Kollam", caseNumber: "ST 12/2026" }]);
    assert.equal(j.causeDate, "2026-07-10");
    assert.equal(j.filingDate, "2026-07-20");
  });

  it("leaves a date the form works out for itself blank, so it keeps following the case", () => {
    const draft = createBlankDraft("d1");
    draft.notices = [notice()];
    jurisdictionFromCase(
      caseOf({
        details: {
          [JURISDICTION_SECTION]: {
            cheque_deposited_by_payee: false,
            other_complaints_pending: false,
            cause_of_action_date: derivedCauseDate(draft),
            complaint_filing_date: todayIso(),
            drawer_bank_police_station: "Kollam East",
          },
        },
      }),
      draft
    );
    assert.equal(draft.jurisdiction.deposited, "no");
    assert.equal(draft.jurisdiction.drawerPolice, "Kollam East");
    assert.equal(draft.jurisdiction.causeDate, "");
    assert.equal(draft.jurisdiction.filingDate, "");
  });
});

describe("adrFromCase", () => {
  it("reads the ADR preference and the prayer", () => {
    const draft = createBlankDraft("d1");
    adrFromCase(
      caseOf({
        details: {
          [ADR_SECTION]: { adr_preference: "MAYBE", final_relief: "<p>Convict the accused.</p>" },
        },
      }),
      draft
    );
    assert.equal(draft.adr.adr, "maybe");
    assert.equal(draft.adr.finalRelief, "<p>Convict the accused.</p>");
    assert.equal(draft.adr.interimRelief, "");
    assert.equal(draft.adr.otherDetails, "");
  });
});

describe("affidavitFromCase", () => {
  it("reads an edited affidavit, and leaves the standard one following the case", () => {
    const draft = createBlankDraft("d1");
    affidavitFromCase(caseOf({ affidavit: "<p>Standard</p>" }), draft, "<p>Standard</p>");
    assert.equal(draft.affidavit, "");
    affidavitFromCase(caseOf({ affidavit: "<p>My own</p>" }), draft, "<p>Standard</p>");
    assert.equal(draft.affidavit, "<p>My own</p>");
  });

  it("keeps this browser's affidavit while the case has none", () => {
    const draft = createBlankDraft("d1");
    draft.affidavit = "<p>Typed</p>";
    affidavitFromCase(caseOf({ affidavit: null }), draft, "<p>Standard</p>");
    assert.equal(draft.affidavit, "<p>Typed</p>");
  });
});
