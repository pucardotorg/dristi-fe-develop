/**
 * The cases sandbox: the demo fixtures, read-only. Design owns this file.
 *
 * Plain arrays, so it also works in server components (the cases list renders on the
 * server). The demo is frozen on `FIXTURE_TODAY` so "due in 3 days" always reads right.
 */

import { CASES, FIXTURE_TODAY } from "../fixtures";
import { PARTY_CASES } from "../party-cases";
import type { CaseRecord } from "../types";
import type { CasesRepository } from "./repository";

export class SandboxCasesRepository implements CasesRepository {
  async listOfficeCases(): Promise<CaseRecord[]> {
    return CASES;
  }
  async listPartyCases(): Promise<CaseRecord[]> {
    return PARTY_CASES;
  }
  async today(): Promise<string> {
    return FIXTURE_TODAY;
  }
}
