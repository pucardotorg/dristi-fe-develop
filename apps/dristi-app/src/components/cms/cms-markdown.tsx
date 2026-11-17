import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cmsLinkKind } from "@/lib/cms/cms-links";

type CmsMarkdownProps = {
  content: string;
};

const LINK_CLASS =
  "rounded-sm text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * Markdown elements mapped to the app's type scale. Headings drop one level because
 * the page title is the only `<h1>`: a CMS `# Heading` becomes an `<h2>`.
 *
 * react-markdown does not render raw HTML inside the markdown and drops unsafe link
 * URLs (`javascript:` …), so CMS content cannot inject script here.
 */
const COMPONENTS: Components = {
  h1: ({ children }) => <h2 className="mt-4 text-title text-balance">{children}</h2>,
  h2: ({ children }) => <h3 className="mt-2 text-title-s text-balance">{children}</h3>,
  h3: ({ children }) => <h4 className="text-body font-semibold">{children}</h4>,
  h4: ({ children }) => <h5 className="text-body font-semibold">{children}</h5>,
  h5: ({ children }) => <h6 className="text-body font-semibold">{children}</h6>,
  h6: ({ children }) => <h6 className="text-body font-semibold">{children}</h6>,
  p: ({ children }) => <p className="text-pretty">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-2 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-2 pl-6">{children}</ol>,
  li: ({ children }) => <li className="pl-1 [&>ol]:mt-2 [&>ul]:mt-2">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-border pl-4 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border" />,
  a: ({ href, children }) => {
    if (!href) return <>{children}</>;
    const kind = cmsLinkKind(href);
    if (kind === "internal") {
      return (
        <Link href={href} className={LINK_CLASS}>
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        className={LINK_CLASS}
        {...(kind === "external" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }) =>
    typeof src === "string" ? (
      // A plain <img>: CMS image hosts are not in `images.remotePatterns`, and the
      // size is unknown, both of which next/image needs.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ""} className="h-auto max-w-full rounded-lg" />
    ) : null,
  code: ({ children }) => (
    <code className="rounded-sm bg-muted px-1 font-mono text-body-compact">{children}</code>
  ),
  pre: ({ children }) => (
    // Code keeps its line breaks, so a long line scrolls inside the block, not the page.
    <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-body-compact [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    // Wide tables scroll inside their own box so the page never scrolls sideways.
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-body-compact">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-3 py-2 align-top">{children}</td>,
};

export function CmsMarkdown({ content }: CmsMarkdownProps) {
  return (
    <div className="flex flex-col gap-4 text-body break-words">
      <Markdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {content}
      </Markdown>
    </div>
  );
}
