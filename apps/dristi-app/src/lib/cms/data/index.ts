/**
 * Repository access for the CMS pages. They always come from the backend, through the
 * app's `/api/v1` proxy, whatever `NEXT_PUBLIC_DATA_SOURCE` says: there is no sandbox copy
 * of the published privacy, terms and support text. `npm run dev:sandbox` reaches the
 * backend that `API_BASE_URL` names; a build with no backend (Netlify) shows that the
 * page couldn't be loaded.
 */

import type { OnlyContract } from "@/lib/data/source";

import { HttpCmsRepository } from "./http";
import type { CmsRepository } from "./repository";

export type { CmsRepository } from "./repository";

let instance: CmsRepository | null = null;

export function getCmsRepository(): CmsRepository {
  instance ??= new HttpCmsRepository() satisfies OnlyContract<HttpCmsRepository, CmsRepository>;
  return instance;
}
