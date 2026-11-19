import type { CmsContentType } from "@/lib/cms/types";

import { CmsMarkdown } from "./cms-markdown";

type CmsContentBodyProps = {
  contentType: CmsContentType;
  content: string;
};

/**
 * Picks the renderer for a page's `content_type`. Adding a type to `CmsContentType`
 * fails to compile here until it is handled.
 */
export function CmsContentBody({ contentType, content }: CmsContentBodyProps) {
  switch (contentType) {
    case "markdown":
      return <CmsMarkdown content={content} />;
    // TODO(cms): HTML support still needs to be added, once design decides how HTML
    // pages should look. It must be sanitised before rendering (CMS HTML can carry
    // <script> or onclick=). The plan: parse it with rehype-parse, sanitise it with
    // rehype-sanitize, and render it through the same element map as markdown, so both
    // look alike. JSON waits on a confirmed schema.
    // Until then both are shown as plain text, so nothing unsafe or misread reaches the page.
    case "html":
    case "json":
    case "unknown":
      return <div className="text-body whitespace-pre-wrap break-words">{content}</div>;
    default: {
      const unhandled: never = contentType;
      return unhandled;
    }
  }
}
