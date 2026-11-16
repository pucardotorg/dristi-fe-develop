/**
 * Turning the backend's CMS page into the app's `CmsPage`, and deciding what a failed
 * load means for the screen. Pure, so the repository and the screen stay thin.
 */

import { isApiError } from "@/lib/api";

import type { CmsContentType, CmsLoadFailure, CmsPage } from "./types";

/** `GET cms/pages/slug/{slug}` as the backend sends it. */
export type CmsPageResponse = {
  id: string;
  slug: string;
  title: string;
  sub_title?: string | null;
  main_image_url?: string | null;
  content_type: string;
  content: string;
  categories?: { id: string; name: string; slug: string }[] | null;
  created_at: string;
  updated_at: string;
};

/** Blank optional text is the same as none: the screen should not render an empty heading. */
function optionalText(value: string | null | undefined): string | null {
  return value && value.trim() ? value : null;
}

function toContentType(value: string): CmsContentType {
  return value.trim().toLowerCase() === "markdown" ? "markdown" : "unknown";
}

export function toCmsPage(response: CmsPageResponse): CmsPage {
  return {
    id: response.id,
    slug: response.slug,
    title: response.title,
    subtitle: optionalText(response.sub_title),
    imageUrl: optionalText(response.main_image_url),
    contentType: toContentType(response.content_type),
    content: response.content,
    categories: response.categories ?? [],
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

/**
 * What a failed load means for the screen, or `null` when the caller cancelled it
 * (an unmount or a slug change) and there is nothing to show.
 */
export function cmsLoadFailure(error: unknown): CmsLoadFailure | null {
  if (!isApiError(error)) return "failed";
  if (error.kind === "aborted") return null;
  if (error.kind === "http" && error.status === 404) return "not-found";
  return "failed";
}
