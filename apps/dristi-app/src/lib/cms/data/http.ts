/**
 * The CMS seam against the DRISTI backend.
 *
 *   getCmsPage   GET /cms/pages/slug/{slug}   → one published content page
 */

import { api } from "@/lib/api";

import { toCmsPage, type CmsPageResponse } from "../cms-page";
import type { CmsPage, CmsSlug } from "../types";

export async function getCmsPage(slug: CmsSlug, signal?: AbortSignal): Promise<CmsPage> {
  const response = await api.get<CmsPageResponse>(
    `cms/pages/slug/${encodeURIComponent(slug)}`,
    { signal },
  );
  return toCmsPage(response);
}
