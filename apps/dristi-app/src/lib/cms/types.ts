/** The CMS pages the app links to (footers on `/`, `/citizen` and court sign-in). */
export type CmsSlug = "privacy" | "terms" | "support";

/**
 * How a page's `content` is written. The API doc says markdown; any other value is
 * kept as `"unknown"` so the screen can still show the text instead of failing.
 */
export type CmsContentType = "markdown" | "unknown";

export type CmsCategory = {
  id: string;
  name: string;
  slug: string;
};

export type CmsPage = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  contentType: CmsContentType;
  content: string;
  categories: CmsCategory[];
  createdAt: string;
  updatedAt: string;
};

/** Why a page could not be shown. */
export type CmsLoadFailure = "not-found" | "failed";
