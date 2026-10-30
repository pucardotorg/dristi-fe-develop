import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankCheque, blankNotice } from "./blank";
import {
  chequeAmount,
  chequeBank,
  chequeEvidenceInfo,
  chequeReady,
  demandNoticeEvidenceInfo,
  demandNoticeReady,
  returnMemoEvidenceInfo,
  returnMemoReady,
  returnReasonText,
} from "./evidence";
import type { ChequeDetails, DemandNotice } from "./types";

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

/** A complete, delivered demand notice, so tests can vary one field at a time. */
function filledNotice(over: Partial<DemandNotice> = {}): DemandNotice {
  return {
    ...blankNotice(),
    natureDebt: "loan",
    whyIssued: "loan-repay",
    dispatchDate: "2024-02-01",
    modeService: "rpad",
    tracking: "RR123456789IN",
    delivered: "yes",
    deliveryDate: "2024-02-05",
    replied: "no",
    paymentStatus: "none",
    ...over,
  };
}

/** An undelivered notice's extra fields, so tests can spread them in. */
const UNDELIVERED = {
  delivered: "no" as const,
  deliveryDate: "",
  returnDate: "2024-02-12",
  nonDeliveryReason: "unclaimed",
};

describe("demandNoticeEvidenceInfo", () => {
  it("builds the body for a delivered notice, payment status as the enum value", () => {
    assert.deepEqual(demandNoticeEvidenceInfo(filledNotice()), {
      nature_of_debt: "Loan / advance repayment",
      cheque_issue_reason: "Towards repayment of a loan",
      dispatch_date: "2024-02-01",
      mode_of_service: "Registered post (RPAD)",
      is_delivered: true,
      accused_replied: false,
      payment_status: "NO_PAYMENT_MADE",
      tracking_number: "RR123456789IN",
      delivery_date: "2024-02-05",
    });
  });

  it("sends the return date and reason (not a delivery date) for an undelivered notice", () => {
    const info = demandNoticeEvidenceInfo(filledNotice(UNDELIVERED));
    assert.equal(info.is_delivered, false);
    assert.equal(info.return_date, "2024-02-12");
    assert.equal(info.non_delivery_reason, "Unclaimed");
    assert.ok(!("delivery_date" in info));
  });

  it("sends part_payment_amount as a number for a part payment", () => {
    const info = demandNoticeEvidenceInfo(filledNotice({ paymentStatus: "part", partAmount: "2,500" }));
    assert.equal(info.payment_status, "PART_PAYMENT");
    assert.equal(info.part_payment_amount, 2500);
  });

  it("omits tracking_number when empty", () => {
    assert.ok(!("tracking_number" in demandNoticeEvidenceInfo(filledNotice({ tracking: "" }))));
  });
});

describe("demandNoticeReady", () => {
  it("is true for a complete delivered or undelivered notice", () => {
    assert.equal(demandNoticeReady(filledNotice()), true);
    assert.equal(demandNoticeReady(filledNotice(UNDELIVERED)), true);
  });

  it("is false when a required field is missing", () => {
    assert.equal(demandNoticeReady(filledNotice({ natureDebt: "" })), false);
    assert.equal(demandNoticeReady(filledNotice({ whyIssued: "" })), false);
    assert.equal(demandNoticeReady(filledNotice({ dispatchDate: "" })), false);
    assert.equal(demandNoticeReady(filledNotice({ modeService: "" })), false);
    assert.equal(demandNoticeReady(filledNotice({ paymentStatus: "" })), false);
  });

  it("requires a delivery date when delivered", () => {
    assert.equal(demandNoticeReady(filledNotice({ delivered: "yes", deliveryDate: "" })), false);
  });

  it("requires a return date and reason when undelivered", () => {
    assert.equal(demandNoticeReady(filledNotice({ ...UNDELIVERED, returnDate: "" })), false);
    assert.equal(demandNoticeReady(filledNotice({ ...UNDELIVERED, nonDeliveryReason: "" })), false);
  });

  it("requires a valid amount for a part payment", () => {
    assert.equal(demandNoticeReady(filledNotice({ paymentStatus: "part", partAmount: "" })), false);
    assert.equal(demandNoticeReady(filledNotice({ paymentStatus: "part", partAmount: "500" })), true);
  });
});
