/**
 * Repository access for the cases list. `getCasesRepository()` is the one place that
 * chooses the implementation, from `NEXT_PUBLIC_DATA_SOURCE` (`lib/data/source.ts`): the
 * demo fixtures (`sandbox.ts`) or the backend (`http.ts`). Works on the server too.
 */

import { chooseRepository, type OnlyContract } from "@/lib/data/source";

import { HttpCasesRepository } from "./http";
import type { CasesRepository } from "./repository";
import { SandboxCasesRepository } from "./sandbox";

export type { CasesRepository } from "./repository";

let instance: CasesRepository | null = null;

export function getCasesRepository(): CasesRepository {
  instance ??= chooseRepository<CasesRepository>("cases", {
    sandbox: () => new SandboxCasesRepository(),
    http: () => new HttpCasesRepository() satisfies OnlyContract<HttpCasesRepository, CasesRepository>,
  });
  return instance;
}
