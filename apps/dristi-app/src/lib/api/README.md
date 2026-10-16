# API layer — how the browser reaches the DRISTI backend

Every backend call goes through two pieces, and nothing else in the app talks HTTP to
the backend:

```
screen → store → repository (lib/<feature>/data/http.ts)
                    │
                    ▼
         lib/api  (this folder, browser)          app/api/v1/[...path]/route.ts
         api.get("locations") ───────────────────▶ lib/server/api-proxy.ts ──▶ ${API_BASE_URL}/locations/
           same-origin /api/v1/locations             (server, same origin)          Django
```

| File | Owns |
| --- | --- |
| `client.ts` | `api` and `createApiClient`: URL + query, JSON or multipart body, CSRF header on writes, timeout + cancellation, envelope removal, error mapping |
| `errors.ts` | `ApiError` (`kind`, `status`, `fieldErrors`, `retryAfterSeconds`, `code`) and the DRF error parser |
| `envelope.ts` | The backend's `meta` envelope; `Page<T>` for paginated lists |
| `csrf.ts` | Reading Django's `csrftoken` cookie |
| `../server/env.ts` | `API_BASE_URL`, validated, read per request (server only) |
| `../server/api-proxy.ts` | Forwarding: trailing slash, headers, cookies, path safety, 502/503/504 |

## Using it

```ts
import { api, isApiError, type Page } from "@/lib/api";

const courts = await api.get<Page<Court>>("organizations", { query: { page: 2 } });
await api.post("auth/otp/request", { mobile_number, purpose: "login" });
const pdf = await api.get<Blob>(`dristi-requests/${encodeURIComponent(id)}/documents/${docId}`, {
  responseType: "blob",
});

try {
  await api.post("users", { mobile_number, otp });
} catch (error) {
  if (!isApiError(error) || error.kind === "aborted") throw error;
  if (error.status === 429) startCooldown(error.retryAfterSeconds);
  setFieldError("otp", error.fieldError("otp"));
}
```

## Rules

- **Screens never import `api`.** They call a repository or store; the repository maps
  backend shapes to the app's types (`lib/<feature>/types.ts`). That keeps today's
  local repositories and tomorrow's HTTP ones interchangeable.
- **Paths are relative and slash-agnostic.** `"locations"` and `"/locations/"` are the
  same call. The proxy adds the trailing slash Django needs. Encode interpolated ids.
- **Show `error.message`, not `error.body`.** Messages are written for people; bodies are
  for debugging.
- **Ignore `kind === "aborted"`.** It means the caller cancelled (usually an unmount).
- **Server components cannot use `api` yet.** It is relative to the browser's origin and
  relies on the browser's cookies. Server-side fetching needs an absolute base URL and
  the incoming cookies forwarded — add it when the first server-rendered API screen
  needs it, via `createApiClient`.

## Configuration

`API_BASE_URL` — see `apps/dristi-app/.env.example`. Defaults to
`http://localhost:8000/api/v1` under `npm run dev` (`.env.development`). The backend must
trust this app's origin in `CSRF_TRUSTED_ORIGINS`.

Why the proxy is a route handler rather than `next.config` rewrites or `proxy.ts` is
recorded at the top of `lib/server/api-proxy.ts`.
