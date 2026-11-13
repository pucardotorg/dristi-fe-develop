import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createBlankDraft } from "./blank";
import {
  chequeFullyComplete,
  chequePresentIssue,
  chequePresentedLate,
  chequeValidUntil,
  isDelayed,
  limitationDeadline,
  limitationView,
  noticeDispatchIssue,
  noticeDispatchLate,
  noticeServiceIssue,
  sectionComplete,
} from "./selectors";
import type { FilingDraft } from "./types";

/** A draft with one cheque returned on 1 Aug and its notice sent and served. */
function dated(): FilingDraft {
  const d = createBlankDraft("draft-limitation");
  d.cheques[0].returnDate = "2026-08-01";
  d.notices[0].dispatchDate = "2026-08-10";
  d.notices[0].delivered = "yes";
  d.notices[0].deliveryDate = "2026-08-14";
  d.jurisdiction.filingDate = "2026-09-10";
  return d;
}

describe("the limitation chain — return, notice, service, cause of action, filing", () => {
  it("takes the cause of action as 15 days after service", () => {
    const lim = limitationView(dated());
    assert.equal(lim.causeDate, "2026-08-29");
    assert.equal(lim.causeDerived, true);
    assert.equal(lim.elapsed, 12);
    assert.equal(lim.withinLimit, true);
  });

  it("warns, without blocking, on a notice sent more than 30 days after the return", () => {
    const d = dated();
    d.notices[0].dispatchDate = "2026-09-05";
    assert.equal(noticeDispatchLate(d, 0), true);
    assert.equal(noticeDispatchIssue(d, 0), undefined);
    d.notices[0].dispatchDate = "2026-08-31";
    assert.equal(noticeDispatchLate(d, 0), false);
    d.notices[0].dispatchDate = "2026-07-30";
    assert.match(noticeDispatchIssue(d, 0) ?? "", /before the cheque was returned/);
    assert.equal(noticeDispatchLate(d, 0), false);
  });

  it("measures the dispatch against any cheque returned before it", () => {
    const d = dated();
    d.cheques.push({ ...d.cheques[0], returnDate: "2026-09-01" });
    d.notices[0].dispatchDate = "2026-09-05";
    assert.equal(noticeDispatchIssue(d, 0), undefined);
    assert.equal(noticeDispatchLate(d, 0), false);
    d.notices[0].dispatchDate = "2026-07-30";
    assert.match(noticeDispatchIssue(d, 0) ?? "", /every cheque was returned/);
  });

  it("flags a delivery before the dispatch", () => {
    const d = dated();
    d.notices[0].deliveryDate = "2026-08-09";
    assert.match(noticeServiceIssue(d.notices[0]) ?? "", /before the notice was dispatched/);
  });

  it("refuses a typed cause date inside the 15-day payment window", () => {
    const d = dated();
    d.jurisdiction.causeDate = "2026-08-20";
    assert.match(limitationView(d).causeIssue ?? "", /Cannot be before/);
    assert.equal(sectionComplete(d, "jurisdiction"), false);
  });

  it("refuses a filing date before the cause of action", () => {
    const d = dated();
    d.jurisdiction.filingDate = "2026-08-25";
    const lim = limitationView(d);
    assert.match(lim.filingIssue ?? "", /can only be filed once/);
    assert.equal(lim.elapsed, null);
  });

  it("asks for condonation past one calendar month, and the fee follows the derived dates", () => {
    const d = dated();
    d.jurisdiction.deposited = "no";
    // Cause of action 29 Aug → due 29 Sep.
    d.jurisdiction.filingDate = "2026-10-09";
    const lim = limitationView(d);
    assert.equal(lim.overBy, 10);
    assert.equal(isDelayed(d), true);
    assert.equal(sectionComplete(d, "jurisdiction"), false);
    d.jurisdiction.condonationReason = "The complainant was abroad.";
    assert.equal(sectionComplete(d, "jurisdiction"), true);
  });

  it("counts the section complete from a derived cause date, not only a typed one", () => {
    const d = dated();
    d.jurisdiction.deposited = "no";
    assert.equal(sectionComplete(d, "jurisdiction"), true);
  });
});

describe("the cheque's own validity — the first link of the chain", () => {
  it("is valid for presentation for three months from its date", () => {
    const c = createBlankDraft("draft-validity").cheques[0];
    c.dateOnCheque = "2026-05-15";
    assert.equal(chequeValidUntil(c), "2026-08-14");
    c.presentDate = "2026-08-14";
    assert.equal(chequePresentIssue(c), undefined);
    assert.equal(chequePresentedLate(c), undefined);
    c.presentDate = "2026-05-10";
    assert.match(chequePresentIssue(c) ?? "", /before the date on the cheque/);
    assert.equal(chequePresentedLate(c), undefined);
  });

  it("warns, never blocks, when presented after its validity (CHQ-11)", () => {
    const c = createBlankDraft("draft-validity-late").cheques[0];
    Object.assign(c, {
      chequeNumber: "000123",
      amount: "50000",
      ifsc: "SBIN0000001",
      bankName: "State Bank of India",
      dateOnCheque: "2026-05-15",
      presentDate: "2026-08-20",
      returnDate: "2026-08-22",
      returnReason: "funds-insufficient",
    });
    assert.equal(chequePresentIssue(c), undefined);
    assert.equal(
      chequePresentedLate(c),
      "Presented after the cheque's validity. It was valid for presentation until 14 August 2026, 3 months from its date. Check that S-138 still applies before filing.",
    );
    assert.equal(chequeFullyComplete(c, 0), true);
  });

  it("clamps to the month's end for a cheque dated on the 30th or 31st", () => {
    const c = createBlankDraft("draft-validity-end").cheques[0];
    c.dateOnCheque = "2026-11-30";
    assert.equal(chequeValidUntil(c), "2027-02-27");
  });
});

describe("limitationDeadline — one calendar month, as the backend counts it", () => {
  it("is the same date next month", () => {
    assert.equal(limitationDeadline("2026-08-29"), "2026-09-29");
    assert.equal(limitationDeadline("2026-01-01"), "2026-02-01");
  });

  it("is the last day of a shorter month", () => {
    assert.equal(limitationDeadline("2026-01-31"), "2026-02-28");
    assert.equal(limitationDeadline("2028-01-31"), "2028-02-29");
  });

  it("keeps a filing on the last day in time, and a month of 31 days is not cut to 30", () => {
    const d = createBlankDraft("d1");
    d.jurisdiction.causeDate = "2026-01-01";
    d.jurisdiction.filingDate = "2026-02-01";
    assert.equal(limitationView(d).withinLimit, true);
    assert.equal(isDelayed(d), false);
  });

  it("counts a filing after a short month's last day as late", () => {
    const d = createBlankDraft("d1");
    d.jurisdiction.causeDate = "2026-01-31";
    d.jurisdiction.filingDate = "2026-03-02";
    const lim = limitationView(d);
    assert.equal(lim.withinLimit, false);
    assert.equal(lim.overBy, 2);
    assert.equal(isDelayed(d), true);
  });
});
