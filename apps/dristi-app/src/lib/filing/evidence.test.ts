import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { blankCheque, blankNotice } from "./blank";
import {
  chequeAmount,
  chequeBank,
  chequeEvidenceInfo,
  demandNoticeEvidenceInfo,
  demandNoticeHasContent,
  returnMemoEvidenceInfo,
  returnReasonValue,
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
    accountNumber: "3210 4567 890",
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

describe("returnReasonValue", () => {
  it("maps the stored option code to the backend's ReturnReason enum value", () => {
    assert.equal(returnReasonValue("funds-insufficient"), "FUNDS_INSUFFICIENT");
    assert.equal(returnReasonValue("stale-cheque"), "POST_DATED_OR_STALE");
  });

  it("maps the two reasons the backend enum recently gained (B1)", () => {
    assert.equal(returnReasonValue("signature-differs"), "SIGNATURE_DIFFERS");
    assert.equal(returnReasonValue("amount-mismatch"), "AMOUNT_MISMATCH");
  });

  it("returns null for an unknown code", () => {
    assert.equal(returnReasonValue("not-a-reason"), null);
  });
});

describe("chequeBank", () => {
  it("uppercases the IFSC and trims the bank fields of the cheque's own bank", () => {
    assert.deepEqual(chequeBank([filledCheque()], 0), {
      ifsc: "SBIN0001234",
      bankName: "State Bank of India",
      bankBranch: "MG Road",
      accountNumber: "32104567890",
    });
  });

  it("inherits the previous cheque's bank when 'same as previous' is yes", () => {
    const cheques = [
      filledCheque(),
      filledCheque({
        sameAsPrev: "yes",
        ifsc: "",
        bankName: "",
        bankBranch: "",
        accountNumber: "",
      }),
    ];
    assert.deepEqual(chequeBank(cheques, 1), {
      ifsc: "SBIN0001234",
      bankName: "State Bank of India",
      bankBranch: "MG Road",
      accountNumber: "32104567890",
    });
  });

  it("follows the chain back through several inheriting cheques", () => {
    const cheques = [
      filledCheque(),
      filledCheque({
        sameAsPrev: "yes",
        ifsc: "",
        bankName: "",
        bankBranch: "",
        accountNumber: "",
      }),
      filledCheque({
        sameAsPrev: "yes",
        ifsc: "",
        bankName: "",
        bankBranch: "",
        accountNumber: "",
      }),
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
      bank_account_number: "32104567890",
    });
  });

  it("uses the inherited bank for a 'same as previous' cheque", () => {
    const cheques = [
      filledCheque(),
      filledCheque({
        sameAsPrev: "yes",
        chequeNumber: "456790",
        ifsc: "",
        bankName: "",
        bankBranch: "",
        accountNumber: "",
      }),
    ];
    const info = chequeEvidenceInfo(cheques, 1);
    assert.equal(info.cheque_number, "456790");
    assert.equal(info.ifsc_code, "SBIN0001234");
    assert.equal(info.bank_name, "State Bank of India");
    assert.equal(info.bank_account_number, "32104567890");
  });
});

describe("returnMemoEvidenceInfo", () => {
  it("builds the RETURN_MEMO body with the reason as written on the memo", () => {
    assert.deepEqual(returnMemoEvidenceInfo(filledCheque()), {
      presentation_date: "2024-01-18",
      return_date: "2024-01-22",
      return_reason: "FUNDS_INSUFFICIENT",
    });
  });
});

describe("chequeEvidenceInfo partial save", () => {
  it("sends only the filled, well-formed fields, never an empty or zero value", () => {
    // Half-filled: a date and bank name, no amount yet, a not-yet-complete cheque number.
    const info = chequeEvidenceInfo(
      [
        filledCheque({
          amount: "",
          chequeNumber: "12345",
          ifsc: "SBIN123",
          bankBranch: "",
          accountNumber: "",
        }),
      ],
      0,
    );
    assert.deepEqual(info, {
      cheque_date: "2024-01-15",
      bank_name: "State Bank of India",
    });
  });

  it("is empty for a blank cheque, so no row is created for one", () => {
    assert.deepEqual(chequeEvidenceInfo([blankCheque()], 0), {});
  });

  it("omits a malformed cheque number or IFSC rather than sending it", () => {
    const info = chequeEvidenceInfo(
      [filledCheque({ chequeNumber: "1234567", ifsc: "BADCODE" })],
      0,
    );
    assert.ok(!("cheque_number" in info));
    assert.ok(!("ifsc_code" in info));
  });

  it("sends the account number only once it is 9 to 18 digits (CHQ-7a)", () => {
    for (const bad of ["", "12345678", "1234567890123456789", "12345678AB"]) {
      const info = chequeEvidenceInfo([filledCheque({ accountNumber: bad })], 0);
      assert.ok(!("bank_account_number" in info), bad);
    }
    const info = chequeEvidenceInfo([filledCheque({ accountNumber: "1234-5678 9" })], 0);
    assert.equal(info.bank_account_number, "123456789");
  });
});

describe("returnMemoEvidenceInfo partial save", () => {
  it("sends only what is filled, leaving out an unmapped reason", () => {
    assert.deepEqual(returnMemoEvidenceInfo(filledCheque({ returnReason: "", returnDate: "" })), {
      presentation_date: "2024-01-18",
    });
  });

  it("is empty for a blank cheque's return memo", () => {
    assert.deepEqual(returnMemoEvidenceInfo(blankCheque()), {});
  });
});

/** A complete, delivered demand notice, so tests can vary one field at a time. */
function filledNotice(over: Partial<DemandNotice> = {}): DemandNotice {
  return {
    ...blankNotice(),
    natureDebt: "loan",
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
      nature_of_debt: "LOAN_OR_ADVANCE_REPAYMENT",
      dispatch_date: "2024-02-01",
      mode_of_service: "REGISTERED_POST",
      is_delivered: true,
      accused_replied: false,
      payment_status: "NO_PAYMENT_MADE",
      tracking_number: "RR123456789IN",
      delivery_date: "2024-02-05",
    });
  });

  it("does not send cheque_issue_reason (the backend dropped it)", () => {
    assert.ok(!("cheque_issue_reason" in demandNoticeEvidenceInfo(filledNotice())));
  });

  it("sends the return date and reason (not a delivery date) for an undelivered notice", () => {
    const info = demandNoticeEvidenceInfo(filledNotice(UNDELIVERED));
    assert.equal(info.is_delivered, false);
    assert.equal(info.return_date, "2024-02-12");
    assert.equal(info.non_delivery_reason, "UNCLAIMED");
    assert.ok(!("delivery_date" in info));
  });

  it("maps the 'address incomplete' reason to the backend enum value (B3)", () => {
    const info = demandNoticeEvidenceInfo(
      filledNotice({ ...UNDELIVERED, nonDeliveryReason: "incomplete" }),
    );
    assert.equal(info.non_delivery_reason, "ADDRESS_INCOMPLETE_OR_INCORRECT");
  });

  it("sends part_payment_amount as a number for a part payment", () => {
    const info = demandNoticeEvidenceInfo(
      filledNotice({ paymentStatus: "part", partAmount: "2,500" }),
    );
    assert.equal(info.payment_status, "PART_PAYMENT");
    assert.equal(info.part_payment_amount, 2500);
  });

  it("omits tracking_number when empty", () => {
    assert.ok(!("tracking_number" in demandNoticeEvidenceInfo(filledNotice({ tracking: "" }))));
  });
});

describe("demandNoticeEvidenceInfo: the 'other' nature of debt (LDN-1a)", () => {
  it("sends the description, trimmed, with OTHER_LIABILITY", () => {
    const info = demandNoticeEvidenceInfo(
      filledNotice({ natureDebt: "other", natureDebtOther: "  Rent arrears " }),
    );
    assert.equal(info.nature_of_debt, "OTHER_LIABILITY");
    assert.equal(info.nature_of_debt_other, "Rent arrears");
  });

  it("leaves out a blank description, which the backend refuses", () => {
    for (const blank of ["", "   "]) {
      const info = demandNoticeEvidenceInfo(
        filledNotice({ natureDebt: "other", natureDebtOther: blank }),
      );
      assert.equal(info.nature_of_debt, "OTHER_LIABILITY");
      assert.ok(!("nature_of_debt_other" in info), JSON.stringify(blank));
    }
  });

  it("leaves out a description kept from before switching to another nature (E07023)", () => {
    const info = demandNoticeEvidenceInfo(
      filledNotice({ natureDebt: "loan", natureDebtOther: "Rent arrears" }),
    );
    assert.ok(!("nature_of_debt_other" in info));
  });
});

describe("demandNoticeEvidenceInfo partial save", () => {
  it("sends the two yes/no answers plus only the other fields that are filled", () => {
    // Nothing filled beyond the defaults (delivered yes, replied no, no payment status).
    assert.deepEqual(demandNoticeEvidenceInfo(blankNotice()), {
      is_delivered: true,
      accused_replied: false,
    });
  });

  it("leaves out an unmapped nature-of-debt or mode-of-service code rather than sending it", () => {
    const info = demandNoticeEvidenceInfo(
      filledNotice({ natureDebt: "", modeService: "", dispatchDate: "" }),
    );
    assert.ok(!("nature_of_debt" in info));
    assert.ok(!("mode_of_service" in info));
    assert.ok(!("dispatch_date" in info));
  });

  it("omits a part payment amount that is not a positive number", () => {
    const info = demandNoticeEvidenceInfo(filledNotice({ paymentStatus: "part", partAmount: "0" }));
    assert.equal(info.payment_status, "PART_PAYMENT");
    assert.ok(!("part_payment_amount" in info));
  });
});

describe("demandNoticeHasContent", () => {
  it("is false for a blank notice (only its default yes/no answers), true once anything is filled", () => {
    assert.equal(demandNoticeHasContent(blankNotice()), false);
    assert.equal(demandNoticeHasContent({ ...blankNotice(), natureDebt: "loan" }), true);
    assert.equal(demandNoticeHasContent({ ...blankNotice(), tracking: "RR123" }), true);
    assert.equal(demandNoticeHasContent(filledNotice()), true);
  });
});
