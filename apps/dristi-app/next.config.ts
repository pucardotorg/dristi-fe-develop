import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/* Next 16 resolves a relative import here from the working directory, not this file's
   folder, so run Next from apps/dristi-app, as every npm script does. `next start
   apps/dristi-app` from the repo root fails to find this module. */
import { connectOriginsFromEnv, contentSecurityPolicy } from "./src/lib/security/csp";

/** Points next-intl at `src/i18n/request.ts`, its default location. */
const withNextIntl = createNextIntlPlugin();

const isStaticExport = process.env.STATIC_EXPORT === "true";

/**
 * Every response carries the Content-Security-Policy, so the browser loads nothing from
 * another origin (issue #44, `src/lib/security/csp.ts`). Read at build time, like the
 * `NEXT_PUBLIC_*` values it depends on. A static export has no server to send headers
 * (Next ignores them there and warns), so the web server in front must set the policy;
 * see docs/self-hosted-assets.md.
 */
const securityHeaders: Pick<NextConfig, "headers"> = isStaticExport
  ? {}
  : {
      async headers() {
        const policy = contentSecurityPolicy({
          dev: process.env.NODE_ENV === "development",
          connectOrigins: connectOriginsFromEnv({
            NEXT_PUBLIC_FASTERFIXES_PROJECT_ID: process.env.NEXT_PUBLIC_FASTERFIXES_PROJECT_ID,
            NEXT_PUBLIC_FASTERFIXES_API_ORIGIN: process.env.NEXT_PUBLIC_FASTERFIXES_API_ORIGIN,
          }),
        });
        return [
          { source: "/:path*", headers: [{ key: "Content-Security-Policy", value: policy }] },
        ];
      },
    };

const nextConfig: NextConfig = {
  /**
   * Next 16 blocks its own dev resources when the page is reached from a host it
   * does not consider the dev origin — including `127.0.0.1`, which is the URL
   * `.claude/rules/dev-server.md` tells everyone to use. The block is silent in
   * the browser: `/_next/webpack-hmr` 403s, the client runtime never boots, and
   * every screen that loads its data client-side sits on a spinner for ever,
   * with no console error to explain it. Only the server log says why.
   *
   * Both loopback names, so the documented URL works and the trap is closed.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  /**
   * `NEXT_OUTPUT=standalone` is set only by docker/Dockerfile: it emits a self-contained
   * server (`server.js` plus the traced node_modules) so the runtime image does not need
   * the full install. Netlify and local builds leave it unset and keep the default output.
   */
  output: isStaticExport
    ? "export"
    : process.env.NEXT_OUTPUT === "standalone"
      ? "standalone"
      : undefined,
  ...securityHeaders,
};

export default withNextIntl(nextConfig);
