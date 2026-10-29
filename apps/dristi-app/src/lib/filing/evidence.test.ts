import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankCheque } from "./blank";
import {
  chequeAmount,
  chequeBank,
  chequeEvidenceInfo,
  chequeReady,
  returnMemoEvidenceInfo,
  returnMemoReady,
  returnReasonText,
} from "./evidence";
import type { ChequeDetails } from "./types";

/** A complete cheque, so tests can vary one field at a time. */
function filledCheque(over: Partial<ChequeDetails> = {}): ChequeDetails {
  return {
    ...blankCheque(),
    dateOnCheque: "2024-01-15",
    amount: "50000",
    chequeNumber: "456789",
    ifsc: "sbin0001234",
    bankName: "State Bank of India",
    bankBranch: "MG Road",
    presentDate: "2024-01-18",
    returnDate: "2024-01-22",
    returnReason: "funds-insufficient",
    ...over,
  };
}

describe("chequeAmount", () => {
  it("parses a positive number, dropping grouping commas", () => {
    assert.equal(chequeAmount("50000"), 50000);
    assert.equal(chequeAmount("1,50,000"), 150000);
  });

  it("rejects empty, zero, negative and non-numeric amounts", () => {
    for (const bad of ["", "0", "-5", "abc"]) assert.equal(chequeAmount(bad), null);
  });
});

describe("returnReasonText", () => {
  it("maps the stored option code to the label written on the memo", () => {
    assert.equal(returnReasonText("funds-insufficient"), "Funds insufficient");
  });

  it("passes an unknown value through unchanged", () => {
    assert.equal(returnReasonText("something else"), "something else");
  });
});

describe("chequeBank", () => {
  it("uppercases the IFSC and trims the bank fields of the cheque's own bank", () => {
    assert.deepEqual(chequeBank([filledCheque()], 0), {
      ifsc: "SBIN0001234",
      bankName: "State Bank of India",
      bankBranch: "MG Road",
    });
  });

  it("inherits the previous cheque's bank when 'same as previous' is yes", () => {
    const cheques = [
      filledCheque(),
      filledCheque({ sameAsPrev: "yes", ifsc: "", bankName: "", bankBranch: "" }),
    ];
    assert.deepEqual(chequeBank(cheques, 1), {
      ifsc: "SBIN0001234",
      bankName: "State Bank of India",
      bankBranch: "MG Road",
    });
  });

  it("follows the chain back through several inheriting cheques", () => {
    const cheques = [
      filledCheque(),
      filledCheque({ sameAsPrev: "yes", ifsc: "", bankName: "", bankBranch: "" }),
      filledCheque({ sameAsPrev: "yes", ifsc: "", bankName: "", bankBranch: "" }),
    ];
    assert.equal(chequeBank(cheques, 2).bankName, "State Bank of India");
  });
});

describe("chequeEvidenceInfo", () => {
  it("builds the CHEQUE body the backend schema expects", () => {
    assert.deepEqual(chequeEvidenceInfo([filledCheque()], 0), {
      cheque_date: "2024-01-15",
      amount: 50000,
      cheque_number: "456789",
      ifsc_code: "SBIN0001234",
      bank_name: "State Bank of India",
      bank_branch: "MG Road",
    });
  });

  it("uses the inherited bank for a 'same as previous' cheque", () => {
    const cheques = [
      filledCheque(),
      filledCheque({ sameAsPrev: "yes", chequeNumber: "456790", ifsc: "", bankName: "", bankBranch: "" }),
    ];
    const info = chequeEvidenceInfo(cheques, 1);
    assert.equal(info.cheque_number, "456790");
    assert.equal(info.ifsc_code, "SBIN0001234");
    assert.equal(info.bank_name, "State Bank of India");
  });
});

describe("returnMemoEvidenceInfo", () => {
  it("builds the RETURN_MEMO body with the reason as written on the memo", () => {
    assert.deepEqual(returnMemoEvidenceInfo(filledCheque()), {
      presentation_date: "2024-01-18",
      return_date: "2024-01-22",
      return_reason: "Funds insufficient",
    });
  });
});

describe("chequeReady", () => {
  it("is true for a complete, well-formed cheque", () => {
    assert.equal(chequeReady([filledCheque()], 0), true);
  });

  it("is false when a required field is missing", () => {
    assert.equal(chequeReady([filledCheque({ dateOnCheque: "" })], 0), false);
    assert.equal(chequeReady([filledCheque({ amount: "" })], 0), false);
    assert.equal(chequeReady([filledCheque({ bankName: "" })], 0), false);
  });

  it("is false when the cheque number is not six digits", () => {
    assert.equal(chequeReady([filledCheque({ chequeNumber: "12345" })], 0), false);
    assert.equal(chequeReady([filledCheque({ chequeNumber: "1234567" })], 0), false);
  });

  it("is false when the IFSC is malformed", () => {
    assert.equal(chequeReady([filledCheque({ ifsc: "SBIN123" })], 0), false);
  });

  it("holds the inherited bank to the same rule", () => {
    const cheques = [
      filledCheque({ ifsc: "BADCODE" }),
      filledCheque({ sameAsPrev: "yes", ifsc: "", bankName: "", bankBranch: "" }),
    ];
    assert.equal(chequeReady(cheques, 1), false);
  });
});

describe("returnMemoReady", () => {
  it("is true only when presentation date, return date and reason are all present", () => {
    assert.equal(returnMemoReady(filledCheque()), true);
    assert.equal(returnMemoReady(filledCheque({ returnReason: "" })), false);
    assert.equal(returnMemoReady(filledCheque({ presentDate: "" })), false);
  });
});
