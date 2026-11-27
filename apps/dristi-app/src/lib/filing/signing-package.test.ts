import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "@/lib/api";

import { blankComplainant, createBlankDraft } from "./blank";
import {
  leavingSignAsks,
  mySignatories,
  nextSignature,
  signedSlots,
  signingFailure,
  slotFor,
  toSigningPackage,
  voidedSlots,
} from "./signing-package";
import type { FilingDraft, SigningPackage, UserProfile } from "./types";

const PROFILE: UserProfile = {
  role: null,
  name: "Asha Menon",
  mobile: "+919876543210",
  email: "",
  barNumber: "",
};

/** Two complainants: Asha signs for herself; Ravi's PoA holder signs for him. */
function draft(): FilingDraft {
  const d = createBlankDraft("d1");
  const asha = { ...blankComplainant(), id: "c1", name: "Asha", mobile: "9876543210" };
  asha.caseParticipantIds = ["p-asha"];
  const ravi = {
    ...blankComplainant(),
    id: "c2",
    name: "Ravi",
    mobile: "9000000001",
    poa: "yes" as const,
  };
  ravi.poaHolder = { ...ravi.poaHolder, name: "Suresh", mobile: "9000000002" };
  ravi.caseParticipantIds = ["p-ravi"];
  ravi.savedPoaHolder = {
    participantId: "p-suresh",
    mandateIds: ["m1"],
    forParticipantId: "p-ravi",
    body: "{}",
  };
  d.complainants = [asha, ravi];
  return d;
}

function pkg(signed: string[] = []): SigningPackage {
  const ids = ["p-asha", "p-ravi", "p-suresh"];
  return {
    caseId: "case-1",
    signingRound: 1,
    status: "OPEN",
    complaintFileId: "f0",
    signingFileId: "f0",
    currentFileId: "f0",
    pageCount: 6,
    affidavitPage: 6,
    signatories: ids.map((id) => ({
      caseParticipantId: id,
      name: id,
      label: id,
      hasSigned: signed.includes(id),
    })),
    placeholders: ids.map((id, i) => ({
      caseParticipantId: id,
      page: 6,
      x: 48 + i,
      y: 140,
      width: 240,
      height: 60,
      signerName: id,
      reason: id,
    })),
  };
}

describe("toSigningPackage", () => {
  it("reads the backend's package", () => {
    const read = toSigningPackage({
      case_id: "case-1",
      signing_round: 1,
      status: "OPEN",
      current_file_id: "f1",
      affidavit_page: 6,
      signatories: [
        { case_participant_id: "p1", name: "A", label: "Complainant 1", has_signed: false },
      ],
      signature_placeholders: [
        {
          case_participant_id: "p1",
          page: 6,
          x: 48,
          y: 140,
          width: 240,
          height: 60,
          signer_name: "A",
          reason: "Complainant 1",
        },
        { page: 1 },
      ],
    });
    assert.equal(read.currentFileId, "f1");
    assert.deepEqual(read.signatories, [
      { caseParticipantId: "p1", name: "A", label: "Complainant 1", hasSigned: false },
    ]);
    assert.equal(read.placeholders.length, 1, "a row without a participant is left out");
    assert.equal(read.placeholders[0].signerName, "A");
  });

  it("refuses a body with no current file", () => {
    assert.throws(() => toSigningPackage({ case_id: "case-1" }));
  });
});

describe("who signs", () => {
  it("maps participants to the roster's complainant slots, PoA holder included", () => {
    assert.equal(slotFor(draft(), "p-asha"), "sig-c-c1");
    assert.equal(slotFor(draft(), "p-suresh"), "sig-c-c2");
    assert.equal(slotFor(draft(), "p-unknown"), null);
  });

  it("finds the signed-in person by the mobile given for them", () => {
    assert.deepEqual(
      mySignatories(pkg(), draft(), PROFILE).map((s) => s.caseParticipantId),
      ["p-asha"],
    );
    const suresh = { ...PROFILE, mobile: "9000000002" };
    assert.deepEqual(
      mySignatories(pkg(), draft(), suresh).map((s) => s.caseParticipantId),
      ["p-suresh"],
    );
  });

  it("makes nobody 'you' by default", () => {
    const advocate = { ...PROFILE, mobile: "9111111111" };
    assert.deepEqual(mySignatories(pkg(), draft(), advocate), []);
    assert.equal(nextSignature(pkg(), draft(), advocate), null);
    assert.deepEqual(mySignatories(pkg(), draft(), null), []);
  });

  it("prefers the backend's own marking when it sends one", () => {
    const marked = pkg();
    marked.signatories = marked.signatories.map((s) => ({
      ...s,
      isMe: s.caseParticipantId === "p-ravi",
    }));
    assert.deepEqual(
      mySignatories(marked, draft(), PROFILE).map((s) => s.caseParticipantId),
      ["p-ravi"],
    );
  });

  it("returns the next unsigned box, and none once signed", () => {
    const next = nextSignature(pkg(), draft(), PROFILE);
    assert.equal(next?.placeholder.caseParticipantId, "p-asha");
    assert.equal(nextSignature(pkg(["p-asha"]), draft(), PROFILE), null);
  });
});

describe("signedSlots", () => {
  it("marks a slot only when all its signatories have signed", () => {
    assert.deepEqual(signedSlots(draft(), pkg(["p-asha", "p-ravi"])), ["sig-c-c1"]);
    assert.deepEqual(signedSlots(draft(), pkg(["p-asha", "p-ravi", "p-suresh"])), [
      "sig-c-c1",
      "sig-c-c2",
    ]);
  });
});

describe("voidedSlots", () => {
  const at = "2026-11-24T10:00:00.000Z";

  it("voids e-sign marks the package no longer shows (a new round)", () => {
    const d = draft();
    d.sign.signed["sig-c-c1"] = { at, with: "aadhaar" };
    assert.deepEqual(voidedSlots(d, pkg()), ["sig-c-c1"]);
    assert.deepEqual(voidedSlots(d, pkg(["p-asha"])), []);
  });

  it("leaves signatures made another way, and slots the package does not cover", () => {
    const d = draft();
    d.sign.signed["sig-c-c1"] = { at, with: "paper" };
    d.sign.signed["sig-a-adv1"] = { at, with: "aadhaar" };
    assert.deepEqual(voidedSlots(d, pkg()), []);
  });
});

describe("leavingSignAsks", () => {
  it("asks once someone has signed", () => {
    assert.equal(leavingSignAsks({ anySigned: true, requested: true, backendCase: true }), true);
    assert.equal(leavingSignAsks({ anySigned: true, requested: false, backendCase: false }), true);
  });

  it("does not ask on the backend case when 'Sign digitally' was only chosen", () => {
    assert.equal(leavingSignAsks({ anySigned: false, requested: true, backendCase: true }), false);
    assert.equal(leavingSignAsks({ anySigned: false, requested: false, backendCase: true }), false);
  });

  it("asks off the backend once requests have gone out", () => {
    assert.equal(leavingSignAsks({ anySigned: false, requested: true, backendCase: false }), true);
    assert.equal(
      leavingSignAsks({ anySigned: false, requested: false, backendCase: false }),
      false,
    );
  });
});

describe("signingFailure", () => {
  const http = (status: number, code: string | null = null) =>
    new ApiError({ kind: "http", status, message: "x", code });

  it("reads the registered codes", () => {
    assert.equal(signingFailure(http(409, "E07039")), "in-progress");
    assert.equal(signingFailure(http(409, "E03011")), "in-progress");
    assert.equal(signingFailure(http(400, "E07038")), "stale-copy");
    assert.equal(signingFailure(http(503, "E03026")), "unavailable");
    assert.equal(signingFailure(http(403, "E03005")), "not-permitted");
  });

  it("falls back to the status, then to other", () => {
    assert.equal(signingFailure(http(401)), "session-ended");
    assert.equal(signingFailure(http(403)), "not-permitted");
    assert.equal(signingFailure(new ApiError({ kind: "network", message: "x" })), "unreachable");
    assert.equal(signingFailure(new Error("x")), "other");
  });
});
