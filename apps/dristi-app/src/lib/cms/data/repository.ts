/**
 * Data contract for the CMS pages (`/privacy`, `/terms`, `/support`).
 *
 * Shared by both teams and only grows. Unlike other features, the CMS has no sandbox:
 * its pages are the published text, so `index.ts` always uses the backend (`http.ts`),
 * in a sandbox build too.
 */

import type { CmsPage, CmsSlug } from "../types";

export interface CmsRepository {
  /** One published page. A slug the CMS has no page for rejects with a 404 `ApiError`. */
  getPage(slug: CmsSlug, signal?: AbortSignal): Promise<CmsPage>;
}
