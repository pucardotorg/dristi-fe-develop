# Pucar Dristi 2.0

DRISTI is PUCAR's platform for running cheque-dishonour (NI Act §138) cases through
Indian courts. This repo is the front end: a Next.js app in an npm-workspaces monorepo.
Design and engineering both work here. Sign-in talks to the DRISTI backend; most other
screens still run on an in-browser sandbox (fixtures, IndexedDB) until their backend is
connected. See "Data" below.

Product meaning comes from `docs/product/` and the current request. Never invent users,
legal rules, or system capabilities; check `docs/product/open-questions.md` when a fact is
missing.

This file is shared by both teams and written by hand; change it by PR. `CLAUDE.md`
includes it.

## Design work

For UI planning, building or review with the Pucar design system, first read
`.agents/policies/project.md`: it routes the task to the design roles and skills in
`.agents/` and sets their checks. Run the app with `npm run dev:sandbox`. The design
system itself is fetched on demand with `npm run setup:ds`.

## Stack

- Next.js 16 (App Router), React 19, TypeScript (strict)
- Tailwind CSS 4, shadcn-style components on Radix / Base UI, `lucide-react` icons
- npm workspaces: the app is `apps/dristi-app` (`@pucar/dristi-app`)
- Tests: Node's built-in test runner via `tsx`

## Commands

Run from the repo root.

```bash
npm run dev            # dev server on http://localhost:3000: sandbox data, real sign-in
npm run dev:sandbox    # everything in the sandbox, no backend needed (design work, demos)
npm run build          # production build
npm run lint           # ESLint (next/core-web-vitals + next/typescript + data rules)
npm run typecheck      # next typegen + tsc --noEmit
npm run test:app       # unit tests
npm run verify:agents  # agent rails: after changing .agents/ (then npm run sync:rails)
```

Before finishing a change, run `npm run lint`, `npm run typecheck` and `npm run test:app`.
Run `npm run build` when you touch routing, config, server/client boundaries, or the
Dockerfile. CI runs all of these on every PR.

Never run `npm run build` in a checkout where `npm run dev` is running — both write to
`apps/dristi-app/.next`. Don't start, stop, or restart a dev server the user is running.

## Data: one codebase, two modes

Screens never know where their data comes from. `NEXT_PUBLIC_DATA_SOURCE` decides, per
build (`lib/data/source.ts`):

- `sandbox`: data lives in the browser (IndexedDB, fixtures, demo seeding). `npm run dev`
  uses it today, with sign-in against the backend (`NEXT_PUBLIC_AUTH_SOURCE=api` in
  `.env.development`); `npm run dev:sandbox` puts sign-in in the sandbox too.
- `api`, the default when nothing is set: the DRISTI backend. Set it in
  `.env.development.local` to see which screens already work against the backend.

Each feature keeps its data in `lib/<feature>/data/`: `repository.ts` (the contract,
shared, only grows), the sandbox (`indexeddb.ts` or `sandbox.ts`, owned by design),
`http.ts` (owned by engineering) and `index.ts`, which picks one with `repositoryFor`.
A contract method that `http.ts` does not implement yet rejects with `NotIntegratedError`
("tasks.listPeople is not connected to the backend yet").

- Screens get data only from the feature's store or hook, or `getRepository()`. They never
  import fixtures, sandbox code, `http.ts` or `@/lib/api`, or use browser storage for data
  (UI preferences use `useLocalStorageValue`). `npm run lint` catches imports of
  `fixtures`, `data/indexeddb`, `data/sandbox`, `data/http`, `lib/api` and `lib/server`, and
  browser storage; other demo modules (such as `party-cases`, `*-dummy.json`) are on you.
- Engineering connects a feature by adding methods to its `http.ts`, never by editing a
  screen. When the backend behaves differently from the sandbox, update the sandbox too.
- Design adds data by extending the contract and the sandbox, never `http.ts`.
- Contracts only grow: add methods and optional fields; renaming, removing or retyping
  needs both teams in one PR, listed under "Contract changes".
- Demo-only controls (reset, "Viewing as") render only when `IS_SANDBOX` (from `@/lib/data/source`) is true.
- Full rules: `.agents/policies/data-seam.md`. Reviewers: `.github/CODEOWNERS`.

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
    data/       The data-source switch (source.ts)
    <feature>/  Domain logic, types, fixtures, copy, stores, data/, and their *.test.ts
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
- Data access goes through the feature's repository in `lib/<feature>/data/` (see
  `lib/tasks/data/`), so a real API can replace the sandbox without touching screens.
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
  `docs/`). Never commit to `main` directly. Keep PRs small.
- Commit subjects are imperative and under 70 characters. Keep unrelated changes apart.
- Open PRs into `main` using the PR template. See `CONTRIBUTING.MD`.
