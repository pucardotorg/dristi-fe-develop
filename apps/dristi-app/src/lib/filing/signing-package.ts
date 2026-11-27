/**
 * The backend's signing package (dristi-be PR 355): reading it, and working out which of
 * its signatories is the person at this keyboard and which rows of the Sign step's roster
 * each of them fills.
 *
 * The roster on the Sign step is still built from the draft (`signatories` in
 * `selectors.ts`): one slot per complainant, `sig-c-<complainant id>`. The package lists
 * backend participants instead: each complainant and each PoA holder. A complainant's
 * slot counts as signed once every package signatory saved for that complainant has
 * signed (`signedSlots`).
 */

import { isApiError } from "@/lib/api";

import { sameMobile } from "./selectors";
import type {
  Complainant,
  FilingDraft,
  PackagePlaceholder,
  PackageSignatory,
  SigningPackage,
  UserProfile,
} from "./types";

/* ─────────────────────────────── Backend → app shape ────────────────────────────── */

export type SigningPackageResponse = {
  case_id?: unknown;
  signing_round?: unknown;
  status?: unknown;
  complaint_file_id?: unknown;
  signing_file_id?: unknown;
  current_file_id?: unknown;
  page_count?: unknown;
  affidavit_page?: unknown;
  signatories?: unknown;
  signature_placeholders?: unknown;
};

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function toSignatory(row: unknown): PackageSignatory[] {
  if (!isRecord(row) || typeof row.case_participant_id !== "string") return [];
  return [
    {
      caseParticipantId: row.case_participant_id,
      name: text(row.name),
      label: text(row.label),
      hasSigned: row.has_signed === true,
      ...(typeof row.is_me === "boolean" ? { isMe: row.is_me } : {}),
    },
  ];
}

function toPlaceholder(row: unknown): PackagePlaceholder[] {
  if (!isRecord(row) || typeof row.case_participant_id !== "string") return [];
  return [
    {
      caseParticipantId: row.case_participant_id,
      page: num(row.page),
      x: num(row.x),
      y: num(row.y),
      width: num(row.width),
      height: num(row.height),
      signerName: text(row.signer_name),
      reason: text(row.reason),
    },
  ];
}

export function toSigningPackage(body: SigningPackageResponse | null): SigningPackage {
  const caseId = text(body?.case_id);
  const currentFileId = text(body?.current_file_id);
  if (!caseId || !currentFileId) {
    throw new Error("Unexpected signing package response from the case service.");
  }
  return {
    caseId,
    signingRound: num(body?.signing_round),
    status: text(body?.status),
    complaintFileId: text(body?.complaint_file_id),
    signingFileId: text(body?.signing_file_id),
    currentFileId,
    pageCount: num(body?.page_count),
    affidavitPage: num(body?.affidavit_page),
    signatories: Array.isArray(body?.signatories) ? body.signatories.flatMap(toSignatory) : [],
    placeholders: Array.isArray(body?.signature_placeholders)
      ? body.signature_placeholders.flatMap(toPlaceholder)
      : [],
  };
}

/* ─────────────────────────────── Who is signing ─────────────────────────────────── */

/** The backend participants a complainant record was saved as (itself and its PoA holder). */
function participantIdsOf(c: Complainant): string[] {
  const ids = [...(c.caseParticipantIds ?? [])];
  if (c.savedPoaHolder?.participantId) ids.push(c.savedPoaHolder.participantId);
  return ids;
}

/** The roster slot (`sig-c-<id>`) a backend participant fills, or `null` if none. */
export function slotFor(draft: FilingDraft, caseParticipantId: string): string | null {
  const c = draft.complainants.find((x) => participantIdsOf(x).includes(caseParticipantId));
  return c ? `sig-c-${c.id}` : null;
}

/**
 * The backend participants the signed-in person signs as.
 *
 * When the backend marks them (`isMe`), that is the answer. Until it does, they are
 * worked out the way the backend matches a signer without an account of their own: the
 * mobile number given for them in the complaint is the one signed in with. A complainant
 * signs with their own number; a PoA holder with the holder's. Nobody is "you" by default:
 * an advocate, or anyone not on the complaint, matches nothing.
 */
export function mySignatories(
  pkg: SigningPackage,
  draft: FilingDraft,
  profile: UserProfile | null,
): PackageSignatory[] {
  if (pkg.signatories.some((s) => s.isMe !== undefined)) {
    return pkg.signatories.filter((s) => s.isMe === true);
  }
  const mobile = profile?.mobile ?? "";
  if (!mobile) return [];
  const mine = new Set<string>();
  for (const c of draft.complainants) {
    if (sameMobile(mobile, c.mobile)) c.caseParticipantIds?.forEach((id) => mine.add(id));
    const holder = c.savedPoaHolder?.participantId;
    if (holder && c.poa === "yes" && sameMobile(mobile, c.poaHolder.mobile)) mine.add(holder);
  }
  return pkg.signatories.filter((s) => mine.has(s.caseParticipantId));
}

/**
 * The next signature the signed-in person owes, with where it goes: the first of theirs
 * not yet signed, in the package's order. `null` when they owe none, or are not a
 * signatory at all.
 *
 * Always the first, so the page that handles the return from C-DAC (which is told only
 * the transaction) finds the same one again.
 */
export function nextSignature(
  pkg: SigningPackage,
  draft: FilingDraft,
  profile: UserProfile | null,
): { signatory: PackageSignatory; placeholder: PackagePlaceholder } | null {
  for (const signatory of mySignatories(pkg, draft, profile)) {
    if (signatory.hasSigned) continue;
    const placeholder = pkg.placeholders.find(
      (p) => p.caseParticipantId === signatory.caseParticipantId,
    );
    if (placeholder) return { signatory, placeholder };
  }
  return null;
}

/**
 * The roster slots every one of whose backend signatories has signed. A slot the package
 * does not cover (an advocate's, today) is never in it.
 */
export function signedSlots(draft: FilingDraft, pkg: SigningPackage): string[] {
  return [...slotsOnPackage(draft, pkg)].filter(([, signed]) => signed).map(([slot]) => slot);
}

/**
 * Slots this browser shows as e-signed that the package does not: the case went back to
 * draft and was prepared again (a new round starts unsigned), from this tab or any other.
 * The package is the record of Aadhaar signatures, so these marks are void. Slots the
 * package does not cover, and signatures made another way, are left alone.
 */
export function voidedSlots(draft: FilingDraft, pkg: SigningPackage): string[] {
  return [...slotsOnPackage(draft, pkg)]
    .filter(([slot, signed]) => !signed && draft.sign.signed[slot]?.with === "aadhaar")
    .map(([slot]) => slot);
}

/** Each roster slot the package covers, and whether all its signatories have signed. */
function slotsOnPackage(draft: FilingDraft, pkg: SigningPackage): Map<string, boolean> {
  const bySlot = new Map<string, boolean>();
  for (const s of pkg.signatories) {
    const slot = slotFor(draft, s.caseParticipantId);
    if (!slot) continue;
    bySlot.set(slot, (bySlot.get(slot) ?? true) && s.hasSigned);
  }
  return bySlot;
}

/* ─────────────────────────────── Leaving Sign ───────────────────────────────────── */

export type LeavingSign = {
  /** Someone has signed this version of the complaint. */
  anySigned: boolean;
  /** The draft is marked as sent for signature ("Sign digitally" was chosen). */
  requested: boolean;
  /** The filing is signed on the backend case (Aadhaar e-sign), not the in-browser demo. */
  backendCase: boolean;
};

/**
 * Whether leaving Sign asks first, because leaving loses something. A signature always
 * counts. "Sign digitally" counts only off the backend: there it stands for links sent to
 * the other parties, while on the backend case it only marks this draft and this app
 * sends nobody anything, so until someone signs there is no request to recall.
 */
export function leavingSignAsks({ anySigned, requested, backendCase }: LeavingSign): boolean {
  return anySigned || (requested && !backendCase);
}

/* ─────────────────────────────────── Errors ─────────────────────────────────────── */

/** "There is no open signing package for this case": the GET answers 404. */
export function isNoSigningPackage(error: unknown): boolean {
  return isApiError(error) && error.kind === "http" && error.status === 404;
}

/** Why a signing step failed, for the screen to say in its own words. */
export type SigningFailure =
  | "not-permitted"
  | "in-progress"
  | "stale-copy"
  | "unavailable"
  | "session-ended"
  | "unreachable"
  | "other";

/**
 * Registered codes the signing calls branch on:
 * E03005 (not permitted to sign: not a signer, already signed, wrong file, or someone else
 * is signing; the backend does not say which), E03011 and E07039 (a signing is in progress),
 * E07038 (signed an older copy), E03026 / E03008 (e-sign is switched off or not set up).
 */
export function signingFailure(error: unknown): SigningFailure {
  if (!isApiError(error)) return "other";
  if (error.kind === "network" || error.kind === "timeout") return "unreachable";
  if (error.kind !== "http") return "other";
  if (error.hasCode("E03011") || error.hasCode("E07039")) return "in-progress";
  if (error.hasCode("E07038")) return "stale-copy";
  if (error.hasCode("E03026") || error.hasCode("E03008")) return "unavailable";
  if (error.hasCode("E03005")) return "not-permitted";
  if (error.status === 401) return "session-ended";
  if (error.status === 403) return "not-permitted";
  return "other";
}

/** The reason recorded on the case when the filer goes back to edit it from Sign. */
export const RETURN_TO_DRAFT_REASON = "Returned to edit the filing from the Sign step.";
