/**
 * Repository access for the interface languages. `getLanguagesRepository()` is the one
 * place that chooses the implementation, from `NEXT_PUBLIC_DATA_SOURCE`
 * (`lib/data/source.ts`): a fixed list (`sandbox.ts`) or the backend (`http.ts`).
 */

import { repositoryFor, type OnlyContract } from "@/lib/data/source";

import { HttpLanguagesRepository } from "./http";
import type { LanguagesRepository } from "./repository";
import { SandboxLanguagesRepository } from "./sandbox";

export type { LanguagesRepository } from "./repository";

export const getLanguagesRepository = repositoryFor<LanguagesRepository>("languages", {
  sandbox: () => new SandboxLanguagesRepository(),
  http: () =>
    new HttpLanguagesRepository() satisfies OnlyContract<
      HttpLanguagesRepository,
      LanguagesRepository
    >,
});
