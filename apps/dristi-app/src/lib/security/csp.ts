/**
 * The Content-Security-Policy every response carries (`next.config.ts`). The browser
 * refuses any script, style, font, image, video, worker or frame from another origin, so
 * nothing is loaded from a public CDN (issue #44, docs/self-hosted-assets.md). Data calls
 * may reach only the origins in `connectOrigins`.
 *
 * `next.config.ts` imports this file, so it uses no `@/` imports.
 */

export type CspOptions = {
  /** `next dev`: React needs `eval` for its debugging stacks, and HMR a websocket. */
  dev: boolean;
  /** Other origins the browser may call for data (fetch, XHR), never for files. */
  connectOrigins: readonly string[];
};

/** The reference lookups the filing forms call from the browser
 * (`lib/filing/lookups.ts`, `lib/bulk/reference.ts`). */
export const LOOKUP_ORIGINS: readonly string[] = [
  "https://ifsc.razorpay.com",
  "https://api.postalpincode.in",
];

/** Where the FasterFixes widget sends feedback unless told otherwise (`@fasterfixes/core`). */
export const FASTERFIXES_DEFAULT_ORIGIN = "https://www.faster-fixes.com";

export function contentSecurityPolicy({ dev, connectOrigins }: CspOptions): string {
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    // 'unsafe-inline': the App Router's inline bootstrap scripts and next-themes' no-flash
    // script. Nonces would make every page render dynamically (Next's CSP guide, "Without
    // Nonces"); the rule that matters here, same origin only, holds either way.
    ["script-src", ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])]],
    // Inline <style> blocks (companion rail, hearing timeline, charts) and style attributes.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    // Uploads and scans preview from blob: URLs; a canvas snapshot is a data: URL.
    ["img-src", ["'self'", "data:", "blob:"]],
    ["font-src", ["'self'", "data:"]],
    // Uploaded and recorded video plays from blob: URLs.
    ["media-src", ["'self'", "blob:"]],
    // An uploaded PDF previews in an iframe from a blob: URL.
    ["frame-src", ["'self'", "blob:"]],
    // pdf.js runs its worker from /vendor/.
    ["worker-src", ["'self'", "blob:"]],
    [
      "connect-src",
      [
        "'self'",
        "blob:",
        "data:",
        ...connectOrigins,
        ...(dev ? ["ws://localhost:*", "ws://127.0.0.1:*"] : []),
      ],
    ],
    // Not 'none': Chrome shows a PDF through its viewer plugin, and a blob: PDF document
    // inherits this policy.
    ["object-src", ["'self'", "blob:"]],
    ["base-uri", ["'self'"]],
  ];
  return directives
    .map(([name, sources]) => `${name} ${[...new Set(sources)].join(" ")}`)
    .join("; ");
}

export type CspEnv = {
  NEXT_PUBLIC_FASTERFIXES_PROJECT_ID?: string;
  NEXT_PUBLIC_FASTERFIXES_API_ORIGIN?: string;
};

/**
 * The data origins this build calls: the lookups, and FasterFixes when its widget is on.
 * Mirrors `components/feedback-provider.tsx`, which mounts the widget only when a project
 * ID is set and points it at the API origin when one is given.
 */
export function connectOriginsFromEnv(env: CspEnv): string[] {
  const origins = [...LOOKUP_ORIGINS];
  if (env.NEXT_PUBLIC_FASTERFIXES_PROJECT_ID) {
    const api = originOf(env.NEXT_PUBLIC_FASTERFIXES_API_ORIGIN || FASTERFIXES_DEFAULT_ORIGIN);
    if (api) origins.push(api);
  }
  return origins;
}

/** `https://host[:port]` of an http(s) URL; `null` for anything else. */
function originOf(url: string): string | null {
  try {
    const { origin, protocol } = new URL(url.trim());
    return protocol === "https:" || protocol === "http:" ? origin : null;
  } catch {
    return null;
  }
}
