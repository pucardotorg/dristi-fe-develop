"use client";

/**
 * Keeps the complainants, accused and witnesses on the backend case, one party at a time.
 *
 * Each step saves its parties as it opens and closes (`useStepSync`). A party is sent
 * once the form counts it complete, and only when it changed since the last save; one
 * the backend would still refuse is held back with a note naming what to add. A party
 * removed from the form is taken off the case at once.
 */

import * as React from "react";

import { caseFilingApi, caseFilingErrorMessage, type PartyRole } from "./data/cases-api";
import {
  accusedBodies,
  complainantBodies,
  isAccountMobile,
  missingFields,
  missingFieldsMessage,
  partyChanged,
  poaHolderBody,
  poaHolderMissing,
  saveParty,
  savePoaHolder,
  selfComplainantId,
  witnessBodies,
  type AnyPartyInput,
} from "./parties";
import { useProfile } from "./profile";
import { accusedComplete, complainantComplete, witnessComplete } from "./selectors";
import { useFiling } from "./store";
import type {
  Accused,
  Complainant,
  FilingDraft,
  SavedParty,
  SavedPoaHolder,
  Witness,
} from "./types";
import { syncAdvocates } from "./use-case-advocates";
import { runStepSave, useStepSync } from "./use-step-sync";

export type PartyKind = "complainant" | "accused" | "witness";

type Party = Complainant | Accused | Witness;

type PartyOf<K extends PartyKind> = K extends "complainant"
  ? Complainant
  : K extends "accused"
    ? Accused
    : Witness;

const ROLE: Record<PartyKind, PartyRole> = {
  complainant: "complainants",
  accused: "accused",
  witness: "witnesses",
};

function partiesOf(draft: FilingDraft, kind: PartyKind): Party[] {
  if (kind === "complainant") return draft.complainants;
  return kind === "accused" ? draft.accused : draft.witnesses;
}

function bodiesOf(party: Party, kind: PartyKind, selfId?: string): AnyPartyInput[] {
  if (kind === "complainant") return complainantBodies(party as Complainant, party.id === selfId);
  if (kind === "accused") return accusedBodies(party as Accused);
  return witnessBodies(party as Witness);
}

/** Complete as the form counts it. */
function complete(party: Party, kind: PartyKind): boolean {
  if (kind === "complainant") return complainantComplete(party as Complainant);
  if (kind === "accused") return accusedComplete(party as Accused);
  return witnessComplete(party as Witness);
}

type Saved = Required<Pick<SavedParty, "caseParticipantIds" | "savedBodies">>;

/**
 * The last save of each party, by party id. A save can finish after its step has closed,
 * or before the draft it wrote to has rendered; this is what the next save reads, so it
 * never adds a participant the case already has.
 */
const lastSaved = new Map<string, Saved>();

/** The same for each complainant's PoA holder; `undefined` once it is off the case. */
const lastPoa = new Map<string, SavedPoaHolder | undefined>();

function savedOf(party: Party): SavedParty {
  return lastSaved.get(party.id) ?? party;
}

function sameList(a: string[] = [], b: string[] = []): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** The participant ids a party is saved as on the case — for advocates to act for. */
export function savedParticipantIds(party: Party): string[] {
  return savedOf(party).caseParticipantIds ?? [];
}

/** Take a removed party off the backend case. A failure leaves it on the case. */
export function removePartyFromCase(party: Party) {
  const ids = savedParticipantIds(party);
  lastSaved.delete(party.id);
  // The backend takes a complainant's PoA holder off with them.
  lastPoa.delete(party.id);
  for (const id of ids) {
    caseFilingApi.removeParticipant(id).catch((error) => {
      console.warn("[filing] couldn't remove a party from the case", id, error);
    });
  }
}

export function useCaseParties<K extends PartyKind>(kind: K) {
  const { draft, update } = useFiling();
  const { profile, ready } = useProfile();

  const record = React.useCallback(
    (id: string, patch: (party: SavedParty) => void) =>
      update((d) => {
        const party = partiesOf(d, kind).find((p) => p.id === id);
        if (party) patch(party);
      }),
    [kind, update]
  );
  const recordComplainant = React.useCallback(
    (id: string, patch: (c: Complainant) => void) =>
      update((d) => {
        const c = d.complainants.find((x) => x.id === id);
        if (c) patch(c);
      }),
    [update]
  );

  const sync = useStepSync(kind, async (latest, caseId) => {
    // Who "you" are decides how a complainant is added; wait for it rather than add one twice.
    if (kind === "complainant" && !ready) return;
    const selfId =
      kind === "complainant" ? selfComplainantId(latest().complainants, profile) : undefined;
    let reAdded = false;
    for (const party of partiesOf(latest(), kind)) {
      const saved = savedOf(party);
      // A save the draft has not caught up with (its step closed first) is written now.
      if (saved !== party && !sameList(saved.savedBodies, party.savedBodies)) {
        record(party.id, (p) => {
          p.caseParticipantIds = saved.caseParticipantIds;
          p.savedBodies = saved.savedBodies;
        });
      }

      // Not finished in the form yet: nothing to send, and nothing to report.
      if (!complete(party, kind)) {
        if (party.syncError) record(party.id, (p) => (p.syncError = undefined));
        continue;
      }
      const bodies = bodiesOf(party, kind, selfId);
      const missing = [...new Set(bodies.flatMap((b) => missingFields(b, ROLE[kind])))];
      if (missing.length) {
        const message = missingFieldsMessage(missing);
        if (party.syncError !== message) record(party.id, (p) => (p.syncError = message));
        continue;
      }
      if (!party.syncError && !partyChanged(bodies, saved)) continue;

      const result = await saveParty(caseFilingApi, caseId, ROLE[kind], bodies, saved);
      const before = saved.caseParticipantIds?.[0];
      if (before && before !== result.caseParticipantIds[0]) reAdded = true;
      lastSaved.set(party.id, {
        caseParticipantIds: result.caseParticipantIds,
        savedBodies: result.savedBodies,
      });
      if (!partiesOf(latest(), kind).some((p) => p.id === party.id)) {
        // Removed from the form while it was being saved.
        removePartyFromCase(party);
        continue;
      }
      record(party.id, (p) => {
        p.caseParticipantIds = result.caseParticipantIds;
        p.savedBodies = result.savedBodies;
        p.syncError = result.error ? caseFilingErrorMessage(result.error) : undefined;
      });
    }

    // PoA holders after every complainant: each mandate names its complainant's participant.
    if (kind !== "complainant") return;
    // A complainant added again lost their advocates on the backend; put them back now,
    // queued with the advocate step's own save so the two never add one twice.
    if (reAdded) await runStepSave(caseId, "advocate", () => syncAdvocates(latest, caseId, update));

    for (const c of latest().complainants) {
      const holderIsSelf = c.id !== selfId && isAccountMobile(c.poaHolder.mobile, profile);
      const body = poaHolderBody(c, holderIsSelf);
      const saved = lastPoa.has(c.id) ? lastPoa.get(c.id) : c.savedPoaHolder;
      const setError = (message: string | undefined) => {
        if (c.poaSyncError !== message) recordComplainant(c.id, (p) => (p.poaSyncError = message));
      };

      const missing = body ? poaHolderMissing(body) : [];
      if (missing.length) {
        setError(missingFieldsMessage(missing, "PoA holder's"));
        continue;
      }
      const forId = savedParticipantIds(c)[0];
      // Waits for its complainant, whose own note says what is holding it back.
      if (body && !forId) continue;
      const json = body ? JSON.stringify(body) : undefined;
      if (!c.poaSyncError && saved?.body === json && saved?.forParticipantId === forId) continue;

      const result = await savePoaHolder(caseFilingApi, caseId, body, forId, saved);
      lastPoa.set(c.id, result.saved);
      if (!latest().complainants.some((p) => p.id === c.id)) continue;
      recordComplainant(c.id, (p) => {
        p.savedPoaHolder = result.saved;
        p.poaSyncError = result.error ? caseFilingErrorMessage(result.error) : undefined;
      });
    }
  });

  const unsaved = (
    draft.caseId
      ? partiesOf(draft, kind).filter(
          (p) => p.syncError || ("poaSyncError" in p && p.poaSyncError)
        )
      : []
  ) as PartyOf<K>[];

  return { unsaved, retryUnsaved: sync };
}
