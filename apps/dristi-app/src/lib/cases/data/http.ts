/**
 * The cases repository against the DRISTI backend. Engineering owns this file.
 *
 * It implements the contract (`repository.ts`) one method at a time, translating
 * backend shapes into `CaseRecord` here. Until a method exists, calling it rejects with
 * `NotIntegratedError` ("cases.listOfficeCases is not connected to the backend yet").
 *
 * Empty for now: the cases list is a server component, and `@/lib/api` works only in
 * the browser until server-side fetching is added (see `lib/api/README.md`).
 */

import type { CasesRepository } from "./repository";

export class HttpCasesRepository implements Partial<CasesRepository> {}
