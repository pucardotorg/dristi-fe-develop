import { proxyToApi } from "@/lib/server/api-proxy";
import { readApiOrigin } from "@/lib/server/env";

/**
 * `/api/v1/*` — the same-origin door to the DRISTI backend.
 *
 * Wiring only; the forwarding rules live in `lib/server/api-proxy.ts`. `API_ORIGIN` is
 * read on every request, so changing it needs a restart, never a rebuild.
 */
export const dynamic = "force-dynamic";

function handler(request: Request): Promise<Response> {
  return proxyToApi(request, { origin: readApiOrigin() });
}

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
