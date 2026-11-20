/**
 * The cases sandbox: the demo fixtures, read-only. Design owns this file.
 *
 * Plain arrays, so it also works in server components (the cases list renders on the
 * server). The demo is frozen on `FIXTURE_TODAY` so "due in 3 days" always reads right.
 */

import CASE_FILE from "../case-file-dummy.json";
import { CASES, FIXTURE_TODAY } from "../fixtures";
import { PARTY_CASES } from "../party-cases";
import type { CaseFileDocument, CaseRecord } from "../types";
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
  /**
   * The fictional PDF pack under /case-file/, the same for every case, as the Documents
   * and Orders tabs read it. The links between orders and documents are sample data.
   */
  async getCaseFile(caseId: string): Promise<CaseFileDocument[]> {
    void caseId;
    // JSON widens `category` to string. The fixture is written to CaseFileDocument and
    // case-file-format.test.ts reads it back through this method.
    return CASE_FILE.documents as CaseFileDocument[];
  }
}
