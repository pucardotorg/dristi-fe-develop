# Pucar Dristi 2.0

DRISTI is PUCAR's platform for running cheque-dishonour (NI Act §138) cases through
Indian courts. This repo is the front end: a Next.js app in an npm-workspaces monorepo.
It is a prototype — there is no real back end or authentication yet; screens run on local
fixtures and browser storage.

Product meaning comes from `docs/product/` and the current request. Never invent users,
legal rules, or system capabilities; check `docs/product/open-questions.md` when a fact is
missing. Design work (design system, proposals, feature history) lives in a separate repo.

## Stack

- Next.js 16 (App Router), React 19, TypeScript (strict)
- Tailwind CSS 4, shadcn-style components on Radix / Base UI, `lucide-react` icons
- npm workspaces: the app is `apps/dristi-app` (`@pucar/dristi-app`)
- Tests: Node's built-in test runner via `tsx`

## Commands

Run from the repo root.

```bash
npm run dev        # dev server on http://localhost:3000
npm run build      # production build
npm run lint       # ESLint (next/core-web-vitals + next/typescript)
npm run test:app   # unit tests
```

Before finishing a change, run `npm run lint` and `npm run test:app`. Run `npm run build`
when you touch routing, config, server/client boundaries, or the Dockerfile.

Never run `npm run build` in a checkout where `npm run dev` is running — both write to
`apps/dristi-app/.next`. Don't start, stop, or restart a dev server the user is running.

## Layout

```
apps/dristi-app/src/
  app/          Routes (App Router). Route groups: (app), (portal); areas: citizen/, employee/, filings/, tasks/ …
  components/
    ui/         Shared primitives (button, dialog, table, field …). Reuse before building new ones.
    chrome/     Shared style helpers (table-plate, pill-plate, rail-plate, motion)
    shell/      App frame: sidebar, top bar, page-frame constants, profile, locale
    <feature>/  Feature components (cases, filing, employee, vakalatnama …)
  hooks/        Generic React hooks (use-media-query, use-debounced-value …)
  lib/
    <feature>/  Domain logic, types, fixtures, copy, stores, and their *.test.ts
    utils.ts    cn() for class names
```

Put domain logic in `lib/<feature>/` as plain TypeScript, not inside components. Components
render and wire events; `lib/` decides.

## Reuse before you build (DRY)

Don't build a component, icon, or type that already exists. Search the codebase first and
reuse or extend what's there; if the same logic appears in 2+ places, extract it once.

## TypeScript

- `strict` is on. Don't use `any`; use `unknown` and narrow, or a precise type.
- Avoid non-null `!` and `as` casts. If one is needed, the comment says why it is safe.
- Prefer `type` aliases and string-literal unions for domain values
  (`type CreatorRole = "advocate" | "litigant"`) over enums.
- Put a feature's shared types in `lib/<feature>/types.ts`; import them with `import type`.
- Export explicit types for public function parameters and return values in `lib/`.
- Use the `@/` alias (`@/components/ui/button`, `@/lib/cases/…`) instead of long relative
  paths. Relative imports are fine within the same feature folder.

## React and Next.js

- **Server Components by default.** Add `"use client"` only to the component that needs
  state, effects, event handlers, or browser APIs, and keep that boundary as low in the
  tree as possible. Many existing screens are client components because they read
  browser-side stores; don't copy that onto new code that doesn't need it.
- Use the App Router file conventions: `page.tsx`, `layout.tsx`, `loading.tsx`,
  `error.tsx`, `not-found.tsx`. Export `metadata` (or `generateMetadata`) from pages.
- In Next 16, `params` and `searchParams` are Promises: `await` them in server
  components, or `use()` them in client components.
- Navigate with `next/link` and `useRouter` from `next/navigation`; use `next/image` for
  images.
- Guard browser-only APIs (`window`, `localStorage`) with
  `typeof window === "undefined"` and wrap storage access in `try/catch`.
- Data access goes through a store or repository module in `lib/<feature>/` (see
  `lib/vakalatnama/store.ts`) so a real API can replace it without touching screens.
- Components: named exports (`export function CaseCard()`), one main component per file,
  props typed with a `type …Props`. Default exports only where Next requires them (pages,
  layouts).
- Hooks follow the Rules of Hooks; custom hooks start with `use` and live in `hooks/`
  (generic) or the feature's folder (feature-specific).
- Derive values during render instead of syncing them with `useEffect`. Reach for
  `useMemo` / `useCallback` only when there's a measured or obvious need.
- Give every list item a stable `key` from the data, never the array index for lists that
  reorder.
- Only `NEXT_PUBLIC_*` env vars reach the browser; never put secrets in them.

## Styling and UI

- Compose screens from `components/ui/` and `components/chrome/` before writing new UI.
  If a primitive can't do what's needed, extend it with a variant rather than forking a
  copy.
- Use the theme tokens in `src/app/globals.css` (`bg-background`, `text-muted-foreground`,
  `text-title`, `text-body` …), not raw colours or arbitrary pixel values.
- Merge class names with `cn()` from `@/lib/utils`.
- Page frames use the constants in `components/shell/page-frame.ts`; tables use the
  helpers in `components/chrome/table-plate.ts`.
- Every screen works at phone width without horizontal scroll, at tablet, and at desktop.
- Accessibility: semantic elements, labels on every control, visible focus, keyboard
  operation, and sufficient contrast. Icon-only buttons need an `aria-label`.
- Handle empty, loading, error, and long-content states.

## Code style

- Files and folders are kebab-case (`case-review.ts`, `hearing-overview-screen.tsx`).
  Components are PascalCase, functions and variables camelCase, constants
  `SCREAMING_SNAKE_CASE`.
- Small, focused functions. Pure functions in `lib/` wherever possible — they're easy to
  test.
- Comments explain *why*, not *what*. Match the comment density of the surrounding code.
- Don't leave unused imports, variables, or commented-out code.
- User-facing copy lives in the feature's `content.ts` / copy module, not scattered in JSX.

## Tests

- Put tests next to the code: `lib/<feature>/<name>.test.ts`, using `node:test` and
  `node:assert/strict`.
- Add a test with every bug fix and every new piece of domain logic.
- A new test folder must be added to the `test` script in `apps/dristi-app/package.json`.

## Git

- Branch from the latest `main` as `type/brief-description` (`feature/`, `fix/`, `chore/`,
  `docs/`). Never commit to `main` directly.
- Commit subjects are imperative and under 70 characters. Keep unrelated changes apart.
- Open PRs into `main` using the PR template. See `CONTRIBUTING.MD`.
