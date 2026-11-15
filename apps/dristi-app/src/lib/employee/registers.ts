/**
 * The court's registers — what each one is, not what is in it.
 *
 * Eighteen registers from the owner's "Note On Dashboard, Reports And Registers",
 * section B. This module holds only their names, numbers, groups and descriptions, so
 * the rail and the trail can name a register without loading the generated court
 * behind it (`register-rows.ts` holds the rows and columns).
 *
 * **Registers 11–18 carry `sourceToConfirm`.** The note lists their columns, but where
 * DRISTI would get that data has not been confirmed (batta, warrants in execution, fines,
 * attendance of witnesses, calendar and committal). They are listed, with the note's
 * columns, and they hold no rows: inventing entries for them would claim the product
 * keeps records it does not.
 *
 * The names are Kerala's (CMP, ST, LPR) — the designed baseline. Another state's court
 * re-voices identifiers at display time; a register's own name is not re-voiced yet.
 */

export const REGISTERS_PAGE = { href: "/employee/registers", label: "Registers" } as const;

export type RegisterGroup =
  | "Cases and hearings"
  | "Statements"
  | "Applications and copies"
  | "Bail and evidence"
  | "Fees"
  | "Witnesses"
  | "Fines and warrants";

export const REGISTER_GROUPS: RegisterGroup[] = [
  "Cases and hearings",
  "Statements",
  "Applications and copies",
  "Bail and evidence",
  "Fees",
  "Witnesses",
  "Fines and warrants",
];

export type RegisterId =
  | "calendar"
  | "hearing-book"
  | "statements"
  | "cmp-apps"
  | "disposed"
  | "pending"
  | "bails"
  | "depositions"
  | "fees"
  | "ctc"
  | "batta"
  | "warrants"
  | "refunds"
  | "fine-statement"
  | "fine-register"
  | "attendance"
  | "committal"
  | "batta-orders";

export type RegisterView = { id: string; label: string };

export type RegisterMeta = {
  id: RegisterId;
  no: number;
  group: RegisterGroup;
  name: string;
  description: string;
  /** Sub-views, first is the default. */
  views?: RegisterView[];
  /** Listed with the note's columns; no source for its data is confirmed yet. */
  sourceToConfirm?: string[];
};

export const REGISTERS: RegisterMeta[] = [
  {
    id: "calendar",
    no: 1,
    group: "Cases and hearings",
    name: "Calendar of cases",
    description:
      "registers_oneRowForEveryCaseOn",
  },
  {
    id: "hearing-book",
    no: 2,
    group: "Cases and hearings",
    name: "Hearing book",
    description: "registers_everyPendingCaseWithItsProceedings",
  },
  {
    id: "statements",
    no: 3,
    group: "Statements",
    name: "Statements of filing, disposal and pendency",
    description:
      "registers_openingPendencyCasesFiledDisposalsCases",
    views: [
      { id: "monthly", label: "registers_monthly24Months" },
      { id: "quarterly", label: "registers_quarterly" },
      { id: "annual", label: "registers_annualFinancialYear" },
    ],
  },
  {
    id: "cmp-apps",
    no: 4,
    group: "Applications and copies",
    name: "Register of CMP applications",
    description: "registers_everyApplicationFiledInACase",
  },
  {
    id: "disposed",
    no: 5,
    group: "Cases and hearings",
    name: "Disposed cases",
    description: "registers_casesDisposedAfterNumberingAsSt",
    views: [
      { id: "st", label: "registers_stCases" },
      { id: "cmp", label: "registers_cmpCases" },
    ],
  },
  {
    id: "pending",
    no: 6,
    group: "Cases and hearings",
    name: "Pending cases",
    description: "registers_pendingStAndCmpCasesCounted",
    views: [
      { id: "st", label: "registers_stPending" },
      { id: "cmp", label: "registers_cmpPending" },
    ],
  },
  {
    id: "bails",
    no: 7,
    group: "Bail and evidence",
    name: "Bails granted",
    description: "registers_theStNumberAndDateOf",
  },
  {
    id: "depositions",
    no: 8,
    group: "Bail and evidence",
    name: "Witness depositions",
    description:
      "registers_eachDepositionRecordedWithTheWitness",
    views: [
      { id: "list", label: "registers_eachDeposition" },
      { id: "month", label: "registers_monthWise" },
    ],
  },
  {
    id: "fees",
    no: 9,
    group: "Fees",
    name: "Fees collected",
    description: "registers_monthWiseVakalathsFiledAndEvery",
  },
  {
    id: "ctc",
    no: 10,
    group: "Applications and copies",
    name: "Certified copy register",
    description: "registers_everyCopyApplicationTheSheetsIssued",
  },
  {
    id: "batta",
    no: 11,
    group: "Witnesses",
    name: "Batta and travelling allowance to witnesses",
    description:
      "registers_witnessClassTravelFareOrMileage",
    sourceToConfirm: ["Witness", "Class", "Rail / road", "Fare or mileage", "Carriage hire", "Days", "Per diem", "Total batta", "Certificate of comparison", "Receipt"],
  },
  {
    id: "warrants",
    no: 12,
    group: "Fines and warrants",
    name: "Warrants in execution of sentences",
    description:
      "registers_warrantsIssuedToExecuteSentencesIncluding",
    sourceToConfirm: ["Warrant no.", "Case no. and year", "Issued against", "Particulars of requisition", "Warrant dated", "Delivered", "Returned", "Addressee", "Executed, or reason not"],
  },
  {
    id: "refunds",
    no: 13,
    group: "Fines and warrants",
    name: "Refund certificates and deposit vouchers",
    description: "registers_eachCertificateOrVoucherTheFine",
    sourceToConfirm: ["Date", "Court imposing fine", "Case no.", "Court sanctioning refund", "Payee", "Amount", "Delivered on", "Acknowledgement"],
  },
  {
    id: "fine-statement",
    no: 14,
    group: "Fines and warrants",
    name: "Statement of fines imposed, collected and refunded",
    description: "registers_monthlyStatementOfFinesAndCompensation",
    sourceToConfirm: ["Case and party", "Uncollected balance", "Imposed this month", "Collected this month", "Compensation (S. 250, 357)", "To local bodies", "To Government", "Written off", "Cancelled on appeal", "Refunded", "Uncollected over 3 months"],
  },
  {
    id: "fine-register",
    no: 15,
    group: "Fines and warrants",
    name: "Register of fines imposed, levied and refunded",
    description: "registers_eachFineFromImpositionToTreasury",
    sourceToConfirm: ["Imposed on", "Case no.", "Accused", "Demand", "Collected", "Collected on", "Credit to Govt / local bodies", "Compensation (S. 250, 357, 358)", "Treasury credit", "Written off", "Balance", "Refunds"],
  },
  {
    id: "attendance",
    no: 16,
    group: "Witnesses",
    name: "Attendance of witnesses",
    description: "registers_eachWitnessPresentOnADate",
    sourceToConfirm: ["Date", "Case", "Witness present", "By party or on summons", "Occupation", "Previous attendance", "Examined / dispensed / re-summoned", "Reason for adjournment", "Next date"],
  },
  {
    id: "committal",
    no: 17,
    group: "Cases and hearings",
    name: "Calendar and committal proceedings",
    description: "registers_calendarCaseNumberToResultSentence",
    sourceToConfirm: ["Calendar case no.", "Complainant or police station", "Accused", "Offence and section", "Complaint received", "Appearance", "Trial began", "Decision", "Result", "Sentence implemented", "To record room"],
  },
  {
    id: "batta-orders",
    no: 18,
    group: "Witnesses",
    name: "Orders on witnesses’ batta and travelling allowance",
    description:
      "registers_attendanceOnEachDayClassDays",
    sourceToConfirm: ["Case", "Witness", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Class", "Days of batta", "Distance for mileage", "Judge’s initials"],
  },
];

export function registerById(id: string): RegisterMeta | undefined {
  return REGISTERS.find((register) => register.id === id);
}

export function registerHref(id: RegisterId, view?: string): string {
  return `${REGISTERS_PAGE.href}/${id}${view ? `?view=${encodeURIComponent(view)}` : ""}`;
}

/** The trail's name for a register: its number, which no heading on the page restates. */
export function registerCrumb(register: RegisterMeta): string {
  return `Register ${register.no}`;
}
