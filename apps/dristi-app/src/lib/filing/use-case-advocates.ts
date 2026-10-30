"use client";

/**
 * Keeps the advocates on the backend case, as representations of the complainants they
 * act for. The advocate step saves as it opens and closes (`useStepSync`).
 *
 * The backend names a client by their participant id, so an advocate is saved only once
 * the complainants they act for are on the case — the complainant step, which comes
 * first, saves them. An advocate found by hand rather than by the search has no backend
 * id and is not sent.
 */

import { advocateChanged, endAdvocate, saveAdvocate } from "./advocates";
import { caseFilingApi, caseFilingErrorMessage } from "./data/cases-api";
import { representedIndices } from "./selectors";
import { useFiling } from "./store";
import type { Advocate, FilingDraft, SavedAdvocate } from "./types";
import { savedParticipantIds } from "./use-case-parties";
import { useStepSync } from "./use-step-sync";

const NOT_SAVED_CLIENTS =
  "Finish Complainant details first: an advocate is added for complainants already on the case.";

type Saved = Required<Pick<SavedAdvocate, "savedAdvocateId" | "representations">>;

/** The last save of each advocate row, by row id (see `lastSaved` in use-case-parties). */
const lastSaved = new Map<string, Saved>();

function savedOf(advocate: Advocate): SavedAdvocate {
  return lastSaved.get(advocate.id) ?? advocate;
}

/** Take a removed advocate off the backend case. A failure leaves them on the case. */
export function removeAdvocateFromCase(advocate: Advocate) {
  const saved = savedOf(advocate);
  lastSaved.delete(advocate.id);
  endAdvocate(caseFilingApi, saved).catch((error) => {
    console.warn("[filing] couldn't remove an advocate from the case", advocate.id, error);
  });
}

type Update = (recipe: (draft: FilingDraft) => void) => void;

/**
 * Bring every advocate row's representations on the case in line with the form. Run by
 * the advocate step, and by the complainant step when a complainant it saved was added
 * again under a new participant id, since the backend ended that complainant's advocates.
 */
export async function syncAdvocates(latest: () => FilingDraft, caseId: string, update: Update) {
  const record = (id: string, patch: (advocate: SavedAdvocate) => void) =>
    update((d) => {
      const advocate = d.advocates.find((a) => a.id === id);
      if (advocate) patch(advocate);
    });

  const d = latest();
  const represented = representedIndices(d.complainants);
  for (const advocate of d.advocates) {
    const saved = savedOf(advocate);
    const held = Object.keys(saved.representations ?? {}).length > 0;
    // A save the draft has not caught up with (its step closed first) is written now.
    if (
      saved !== advocate &&
      JSON.stringify(saved.representations) !== JSON.stringify(advocate.representations ?? {})
    ) {
      record(advocate.id, (a) => {
        a.savedAdvocateId = saved.savedAdvocateId;
        a.representations = saved.representations;
      });
    }

    // Cleared, or not found through the search: whatever it held comes off the case.
    if (!advocate.advocateId) {
      if (held) {
        lastSaved.set(advocate.id, { savedAdvocateId: "", representations: {} });
        await endAdvocate(caseFilingApi, saved).catch(() => undefined);
      }
      if (held || advocate.syncError) {
        record(advocate.id, (a) => {
          a.savedAdvocateId = undefined;
          a.representations = {};
          a.syncError = undefined;
        });
      }
      continue;
    }

    const clients = advocate.forComplainants.filter((k) => represented.includes(k));
    const clientIds = clients.map((k) => {
      const complainant = d.complainants[k];
      return complainant ? savedParticipantIds(complainant)[0] : undefined;
    });
    if (clientIds.length === 0) continue;
    if (clientIds.some((id) => !id)) {
      if (advocate.syncError !== NOT_SAVED_CLIENTS) {
        record(advocate.id, (a) => (a.syncError = NOT_SAVED_CLIENTS));
      }
      continue;
    }
    const ids = clientIds as string[];
    if (!advocate.syncError && !advocateChanged(advocate.advocateId, ids, saved)) continue;

    const result = await saveAdvocate(caseFilingApi, caseId, advocate.advocateId, ids, saved);
    lastSaved.set(advocate.id, {
      savedAdvocateId: result.savedAdvocateId,
      representations: result.representations,
    });
    if (!latest().advocates.some((a) => a.id === advocate.id)) {
      removeAdvocateFromCase(advocate);
      continue;
    }
    record(advocate.id, (a) => {
      a.savedAdvocateId = result.savedAdvocateId;
      a.representations = result.representations;
      a.syncError = result.error ? caseFilingErrorMessage(result.error) : undefined;
    });
  }
}

export function useCaseAdvocates() {
  const { draft, update } = useFiling();
  const sync = useStepSync("advocate", (latest, caseId) => syncAdvocates(latest, caseId, update));
  const unsaved = draft.caseId ? draft.advocates.filter((a) => a.syncError) : [];
  return { unsaved, retryUnsaved: sync };
}
