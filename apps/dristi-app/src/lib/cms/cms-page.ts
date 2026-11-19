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
  /** A string for markdown; a `json` page may send structured content instead. */
  content: unknown;
  categories?: { id: string; name: string; slug: string }[] | null;
  created_at: string;
  updated_at: string;
};

/** Blank optional text is the same as none: the screen should not render an empty heading. */
function optionalText(value: string | null | undefined): string | null {
  return value && value.trim() ? value : null;
}

const KNOWN_CONTENT_TYPES: readonly CmsContentType[] = ["markdown", "html", "json"];

function isKnownContentType(value: string): value is CmsContentType {
  return (KNOWN_CONTENT_TYPES as readonly string[]).includes(value);
}

/** Case and surrounding space do not matter: `" Markdown "` is markdown. */
export function toContentType(value: string): CmsContentType {
  const normalized = value.trim().toLowerCase();
  return isKnownContentType(normalized) ? normalized : "unknown";
}

/**
 * The content as a string. Structured content is kept as formatted JSON rather than
 * passed on as an object, which React cannot render and would crash the page on.
 */
function toContentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

export function toCmsPage(response: CmsPageResponse): CmsPage {
  return {
    id: response.id,
    slug: response.slug,
    title: response.title,
    subtitle: optionalText(response.sub_title),
    imageUrl: optionalText(response.main_image_url),
    contentType: toContentType(response.content_type),
    content: toContentText(response.content),
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
