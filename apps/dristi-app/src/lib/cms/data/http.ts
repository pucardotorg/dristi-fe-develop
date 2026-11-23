/**
 * The CMS repository against the DRISTI backend. Engineering owns this file.
 *
 *   getPage   GET /cms/pages/slug/{slug}   → one published content page
 */

import { api } from "@/lib/api";

import { toCmsPage, type CmsPageResponse } from "../cms-page";
import type { CmsPage, CmsSlug } from "../types";
import type { CmsRepository } from "./repository";

export class HttpCmsRepository implements CmsRepository {
  async getPage(slug: CmsSlug, signal?: AbortSignal): Promise<CmsPage> {
    const response = await api.get<CmsPageResponse>(`cms/pages/slug/${encodeURIComponent(slug)}`, {
      signal,
    });
    return toCmsPage(response);
  }
}
