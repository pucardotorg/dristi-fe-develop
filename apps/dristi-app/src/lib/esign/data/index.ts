/**
 * Repository access for esign. `getRepository()` chooses the implementation once, on
 * first use: the sandbox (`indexeddb.ts`) or the backend (`http.ts`).
 *
 * It follows the filing's backend case (`caseFilingSource`), not `NEXT_PUBLIC_DATA_SOURCE`
 * alone: what is signed is that case's PDF, and the backend only signs for a real session.
 * So it is the sandbox only when sign-in is in the sandbox too (`npm run dev:sandbox`).
 */

import {
  AUTH_SOURCE,
  DATA_SOURCE,
  browserOnly,
  selectRepository,
  type OnlyContract,
} from "@/lib/data/source";
import { caseFilingSource } from "@/lib/filing/data";

import { HttpEsignRepository } from "./http";
import { IndexedDbEsignRepository } from "./indexeddb";
import type { EsignRepository } from "./repository";

export type { EsignRepository } from "./repository";

let instance: EsignRepository | null = null;

export function getRepository(): EsignRepository {
  instance ??= selectRepository<EsignRepository>(
    caseFilingSource(DATA_SOURCE, AUTH_SOURCE),
    "esign",
    {
      sandbox: browserOnly("esign", () => new IndexedDbEsignRepository()),
      http: () =>
        new HttpEsignRepository() satisfies OnlyContract<HttpEsignRepository, EsignRepository>,
    },
  );
  return instance;
}
