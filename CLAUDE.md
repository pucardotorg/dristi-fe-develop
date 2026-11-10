# Pucar Dristi 2.0

DRISTI is PUCAR's platform for running cheque-dishonour (NI Act §138) cases through
Indian courts. One shared core is deployed per state with local rules and languages.

All paths in agent instructions are relative to the repository root unless explicitly
described as skill-relative. Use `docs/README.md` when you need to locate a current
source; when the task gives exact paths, start there instead of reading the whole map.

## Working safely

- Design work lives in `pucardotorg/dristi-fe-design`. It starts on `feature/<kebab-case>`
  from `origin/main` and returns by PR into `main`, with the design owner's approval.
  Never commit directly to `main`. The old `design` branch is retired: do not branch from
  it or merge into it. The product repos (`dristi-fe`, `dristi-fe-develop`) pull from this
  repo's `main`; never push to them from here. DS upgrades also use a dedicated PR branch
  from `origin/main`; never fold a pin upgrade into an unrelated feature.
- Inspect branch, worktrees, and uncommitted changes before editing. If another tool
  is building in this checkout, use an isolated worktree. Do not switch its branch,
  overwrite its files, share build output, or stop its server.
- Before using a running app, follow `.agents/policies/dev-server.md`.

## Route the task

The coordinating agent owns completion and follows `.agents/policies/orchestration.md`.
Only an explicit owner-authored `@<agent-name>` tag authorizes spawning that named agent
for the current task. Complexity, a skill invocation, or a role named in these files
does not authorize spawning. Use the smallest workflow justified by consequence,
uncertainty, and scope; the coordinator performs untagged stages:

| Work | Tagged role / skill |
|---|---|
| Understand a product problem, brainstorm, choose a direction | `ux-designer` / `design-ui` |
| Implement agreed behavior | `ui-designer` / `pull-ui-from-ds` + `ui-craft` |
| Independently review behavior, DS consistency, accessibility | `ui-reviewer` / `review-ui-ds` |
| Record decisions and results for the owner | coordinator / `document-ui-feature` |

Explanations need no agent team. Clear, small corrections can be built directly.
Substantial features and consequential behavior changes require a separate review pass.
Invoke an independent `ui-reviewer` only when the owner tags it; otherwise the
coordinator reviews its own work separately and discloses that review was not
independent. A tag for one agent does not authorize any other agent.
An owner request to brainstorm returns a recommendation for the owner's decision; it
does not authorize implementation. Start building only on an explicit owner build request.

## Sources and context

- Product meaning comes from the current request and relevant `docs/product/` sources.
  Never invent product users, Jobs, legal claims, or system capabilities. Consult
  `docs/product/open-questions.md` when a missing fact affects the task.
- Before UI work, follow `.agents/policies/pucar-design-system.md`. The pinned DS is
  authoritative for UI rules; sync primitives, never hand-write or locally modify them.
  Load the compact `ui-craft` checklist and judge changed UI on the render.
- `docs/design/proposals/`, `docs/design/features/`, and past feature research and
  explorations are the owner's history, not routine planning context. Exclude them from
  broad searches for implementation guidance. Retrieve history only on explicit request.
  The documentation workflow may read the single target record to maintain it, without
  promoting its contents into current requirements.
- Reuse relevant material already read in this task while its version remains current.
  Load detailed references only when their subject applies.

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
