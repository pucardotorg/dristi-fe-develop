# Data: sandbox and API

This app runs in two modes from one codebase. `NEXT_PUBLIC_DATA_SOURCE` picks one:
`sandbox` (design work and demos: data lives in the browser) or `api` (the DRISTI
backend). A screen is the same file in both modes. Keep it so: that is what lets design
and engineering work in one repository without editing the same files.

Run the app for design work with `npm run dev:sandbox`: every feature on the sandbox,
demo sign-in with any 6-digit code, no backend needed.

## Where things live

Each feature keeps its data under `apps/dristi-app/src/lib/<feature>/`:

| File | What it is | Owner |
| --- | --- | --- |
| `types.ts` | What screens show: app shapes, not backend shapes | shared |
| `data/repository.ts` | The contract: every read and write a screen may do | shared, only grows |
| `data/indexeddb.ts` or `data/sandbox.ts` | The sandbox: IndexedDB, localStorage, fixtures, seeding, reset. Answers every contract method | design (yours) |
| `data/http.ts` | The backend implementation | engineering; never edit |
| `data/index.ts` | Picks one by the data source (`repositoryFor`) | shared; don't edit once it exists |
| Everything else in `lib/<feature>/` | Domain logic, the store, hooks, `content.ts`, tests, README | shared: either team adds; changes to someone else's logic go in their own commit |

Tasks (`apps/dristi-app/src/lib/tasks/data/`), e-filing
(`apps/dristi-app/src/lib/filing/data/`) and the cases list
(`apps/dristi-app/src/lib/cases/data/`) already follow this shape. Start every other
feature's data layer with `npm run new:data -- <feature>`: it writes these four files
(an IndexedDB sandbox, an empty `http.ts`), the same way every time. Designers may run
it; the empty `http.ts` is engineering's from then on, and engineering reviews the PR
that adds it. Only for read-only demo data that a server component renders, copy the
cases folder (`sandbox.ts` over fixtures) instead.

Two words used below:
- **Data** is anything the backend will keep or someone else should see (another person,
  device or tab). It always goes through a repository.
- A **UI preference** only changes how this browser shows things (a chosen filter, a
  collapsed panel, column widths). It uses `useLocalStorageValue`.

## Rules

1. Screens (`apps/dristi-app/src/components/`, `apps/dristi-app/src/app/`) get data only
   from the feature's `getRepository()` or its store or hook (for example `useTasks()`).
   Never import fixtures or other demo data, `data/indexeddb`, `data/sandbox`,
   `data/http` or `@/lib/api` into a screen, and never use IndexedDB, localStorage or
   sessionStorage in a screen for data. UI preferences (a chosen filter, a collapsed
   panel) use `useLocalStorageValue` from
   `apps/dristi-app/src/hooks/use-local-storage-value.ts`. `npm run lint` catches modules
   named `fixtures`, `data/indexeddb`, `data/sandbox` or `data/http`, the API and server
   code, and browser storage; demo modules with other names (`party-cases`,
   `*-dummy.json`, `demo-*`) are on you. In `lib/`, lint also rejects browser storage and
   `idb` outside a feature's `data/indexeddb.ts` or `data/sandbox.ts`. Files that broke
   these rules before they existed are listed in `apps/dristi-app/eslint.config.mjs` and
   come off the list when they are fixed.
   Prefer that a screen (a route's page or its `*-screen.tsx`) reads the store, hook or
   `getRepository()`, and that the components it renders take data and callbacks as
   props: a component used by more than one screen must, so it works with any source.
2. When a screen needs data that does not exist yet:
   0. if the feature has no `data/` folder yet (most older features, such as vakalatnama,
      applications and employee, keep data in a store that writes to browser storage),
      first run `npm run new:data -- <feature>` in its own commit, and move behind the
      contract only the records your change touches (a new field on a record moves that
      whole record). The old store then reads and writes through `getRepository()`,
      keeping the API its screens already use: a synchronous store loads from the
      repository into memory, shows loading until then, and writes through in the
      background. Old sandbox data in browser storage needn't be migrated; starting
      fresh is fine. In API mode the moved records then answer "not connected yet", as
      expected. Never add new data to an old browser-storage store;
   a. add or extend the type in `types.ts`;
   b. add a method to `data/repository.ts`, with a one-line comment on what it returns;
   c. answer it in the sandbox, from fixtures or IndexedDB;
   d. call it from the screen through the store, hook or `getRepository()`. Data the
      feature's store already holds (for tasks: tasks, people, cases) changes only through
      the store, which saves it, updates other tabs and respects `online`. Data the store
      doesn't hold may get its own hook in `lib/<feature>/`; say in the PR whether other
      tabs need to see it. A new feature starts with a hook
      (`lib/<feature>/use-<name>.ts`) that calls `getRepository()`; add a store only when
      several screens or tabs must share live state.
   A new optional field stays empty against the backend until engineering maps it in
   `http.ts`: list it in the PR under "Contract changes" so they can.
   Do not touch `http.ts`. Against the backend the new method answers "not connected
   to the backend yet" until engineering builds it. That is expected.
3. Contracts only grow. You may add methods, optional fields and new values in a union.
   Do not rename or remove a method or field, change its type, or make an optional field
   required. If you must, add the new one beside it, mark the old one
   `/** @deprecated use X */`, and list it under "Contract changes" in the PR. If
   `npm run typecheck` fails on your PR with "http.ts implements a method the contract
   no longer has" (reported in the feature's `data/index.ts`, naming the method), you
   changed something engineering relies on: undo it, or ask engineering in the PR.
4. Demo behaviour stays in the sandbox: seeding, reseeding on page load, "Reset sandbox
   data", "Viewing as" personas and demo accounts. Show sandbox-only controls (including
   "Sandbox: …" gateway and signing shortcuts) only when `IS_SANDBOX` is true (from
   `@/lib/data/source`).
5. Make the sandbox behave like a server: every method is async, can fail, and validates
   the way the backend will. Every screen shows loading, empty, error and "not connected
   yet" states. The sandbox file's header says whether its data survives a reload (the
   default from `npm run new:data`) or reseeds (tasks does, on every page load). If new data needs a product rule nobody has decided (who can see it, a
   limit, how long it is kept), choose the smallest reasonable one, say so in the PR and
   add it to `docs/product/open-questions.md`. Copy never promises privacy, security or a
   system action the backend does not provide yet.
6. Leave these to engineering, and open an issue if you need a change there:
   `apps/dristi-app/src/lib/api/`, `apps/dristi-app/src/lib/server/`,
   `apps/dristi-app/src/lib/data/`, `apps/dristi-app/src/app/api/v1/`, any
   `data/http.ts` (beyond the empty one `npm run new:data` creates),
   `apps/dristi-app/src/lib/auth/http.ts`, `docker/` and `.github/`.
