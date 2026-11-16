"use client";

/**
 * Removing a cheque, a demand notice or a complainant — from its form step or from the
 * upload step's cards, which are the same records. Its documents leave this browser and
 * the case first; a complainant is also taken off the case. The last one always stays.
 */

import * as React from "react";

import { caseRecords, removeCaseRecord, type CaseRecordKind } from "./blank";
import { caseRecordTargets } from "./case-documents";
import { useFiling } from "./store";
import { discardDocuments } from "./use-case-documents";
import { removePartyFromCase } from "./use-case-parties";

/** Remove record `index` (0-based) of a kind. Resolves to whether it was removed. */
export type RemoveCaseRecord = (kind: CaseRecordKind, index: number) => boolean;

export function useRemoveCaseRecord(): RemoveCaseRecord {
  const { latest, update } = useFiling();

  return React.useCallback(
    (kind, index) => {
      const draft = latest();
      const records = caseRecords(draft, kind);
      if (records.length <= 1 || index < 0 || index >= records.length) return false;
      discardDocuments(draft, caseRecordTargets(draft, kind, index));
      if (kind === "party") removePartyFromCase(draft.complainants[index]);
      update((d) => {
        removeCaseRecord(d, kind, index);
      });
      return true;
    },
    [latest, update]
  );
}
