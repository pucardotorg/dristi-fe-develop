/**
 * Advocates on the backend case. The backend records one representation per client, so
 * an advocate acting for two complainants is two representations; changing whom they act
 * for ends some and adds others, and changing the advocate replaces them all.
 *
 * Pure apart from the API it is handed, so it is tested without rendering the form.
 */

import { isApiError } from "@/lib/api";

import type { CaseFilingApi } from "./data/cases-api";
import type { Advocate, SavedAdvocate } from "./types";

export type AdvocateApi = Pick<CaseFilingApi, "addAdvocate" | "endRepresentation">;

export type AdvocateSaveResult = Required<
  Pick<SavedAdvocate, "savedAdvocateId" | "representations">
> & { error?: unknown };

/** End a representation; one the backend no longer has (its client was removed) is gone already. */
async function end(api: AdvocateApi, representationId: string) {
  try {
    await api.endRepresentation(representationId);
  } catch (error) {
    if (!(isApiError(error) && error.status === 404)) throw error;
  }
}

/**
 * Bring an advocate's representations on the case in line with `clientIds`. If it fails
 * part way, the result still records what is on the case by then.
 */
export async function saveAdvocate(
  api: AdvocateApi,
  caseId: string,
  advocateId: string,
  clientIds: string[],
  saved: SavedAdvocate
): Promise<AdvocateSaveResult> {
  const representations = { ...(saved.representations ?? {}) };
  try {
    // Another advocate in the same row: what the old one held is ended first.
    if (saved.savedAdvocateId && saved.savedAdvocateId !== advocateId) {
      for (const [client, id] of Object.entries(representations)) {
        await end(api, id);
        delete representations[client];
      }
    }
    for (const [client, id] of Object.entries(representations)) {
      if (clientIds.includes(client)) continue;
      await end(api, id);
      delete representations[client];
    }
    const toAdd = clientIds.filter((client) => !representations[client]);
    if (toAdd.length) {
      const ids = await api.addAdvocate(caseId, advocateId, toAdd);
      toAdd.forEach((client, i) => {
        if (ids[i]) representations[client] = ids[i];
      });
    }
    return { savedAdvocateId: advocateId, representations };
  } catch (error) {
    const held = Object.keys(representations).length > 0;
    return {
      savedAdvocateId: held ? (saved.savedAdvocateId ?? advocateId) : advocateId,
      representations,
      error,
    };
  }
}

/** Has this advocate changed since it was last saved, or never been saved? */
export function advocateChanged(
  advocateId: string,
  clientIds: string[],
  saved: SavedAdvocate
): boolean {
  const held = Object.keys(saved.representations ?? {});
  return (
    saved.savedAdvocateId !== advocateId ||
    held.length !== clientIds.length ||
    clientIds.some((c) => !held.includes(c))
  );
}

/** End every representation an advocate holds, for when the row is removed or cleared. */
export async function endAdvocate(api: AdvocateApi, saved: SavedAdvocate): Promise<void> {
  for (const id of Object.values(saved.representations ?? {})) await end(api, id);
}

/**
 * Advocates name the complainants they act for by position, so removing complainant
 * `index` drops it from each advocate and moves the ones after it up one. Left alone, an
 * advocate for the third complainant would be saved for whoever moved into third place.
 */
export function withoutComplainant(advocates: Advocate[], index: number): void {
  for (const advocate of advocates) {
    advocate.forComplainants = advocate.forComplainants
      .filter((k) => k !== index)
      .map((k) => (k > index ? k - 1 : k));
  }
}
