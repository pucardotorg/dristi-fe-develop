/**
 * How a link inside CMS content should open. CMS editors write links by hand, so the
 * screen decides per link rather than trusting them all to be in-app paths.
 */

/**
 * - `internal`: a path in this app (`/citizen`), opened with client-side navigation.
 * - `external`: another site (`https://…`), opened in a new tab.
 * - `other`: anything else (`mailto:`, `tel:`, `#section`), left to the browser.
 */
export type CmsLinkKind = "internal" | "external" | "other";

export function cmsLinkKind(href: string): CmsLinkKind {
  // `//host` is protocol-relative: another site, not a path here.
  if (href.startsWith("/") && !href.startsWith("//")) return "internal";
  if (/^https?:\/\//i.test(href) || href.startsWith("//")) return "external";
  return "other";
}
