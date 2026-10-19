# Pucar Dristi 2.0

PUCAR's DRISTI platform for running NI Act §138 (cheque-dishonour) cases through Indian
courts. One shared national core, deployed per state with local rules and languages.

This repository holds the **Dristi App** (the main product front end) and the product and
design docs behind it. It uses:

- **Next.js 16** (App Router) + **React 19** + **TypeScript** for the app
- **Tailwind CSS 4** with the **Pucar Design System** for UI. The DS is fetched
  automatically into `vendor/` on install and pinned to one commit; this repo does not fork it.
- **npm workspaces** for the monorepo (`apps/*`)
- **Node's built-in test runner** (via `tsx`) for unit tests
- **Docker** for a standalone production image
- **Netlify** for preview and review deployments
- **GitHub Actions** for agent-configuration checks and publishing Docker images to GHCR

> **This is a prototype.** There is no real authentication or back end yet: screens run
> on local fixtures, and demo accounts are listed below.

## Quick start

**Prerequisites:** Node.js 22 or later, npm, and Git. The install step clones the design
system, so Git and access to GitHub are required.

1. **Clone and install:**

   ```bash
   git clone https://github.com/pucardotorg/dristi-fe-develop.git
   cd dristi-fe-develop
   npm install          # also fetches the pinned design system into vendor/
   ```

   No sibling clones or home-directory configuration are needed. `npm install` places the
   design system at `vendor/pucar-design-system`, checks out the commit pinned in
   [ds.lock.json](ds.lock.json), and refuses a checkout from any organisation other than
   `pucardotorg`.

2. **(Optional) Configure environment:**

   ```bash
   cp apps/dristi-app/.env.example apps/dristi-app/.env.local
   ```

   Every variable is optional. See [Environment variables](#environment-variables).

3. **Start the dev server:**

   ```bash
   npm run dev
   ```

4. **Open the app:**

   | Area | URL | Who it is for |
   |---|---|---|
   | Home | http://localhost:3000/ | Entry point for both areas |
   | Citizen sign-in | http://localhost:3000/citizen | Advocates, advocates' clerks, litigants, parties in person |
   | Court sign-in | http://localhost:3000/employee/login | Magistrate, bench clerk, scrutiny officer, typist |
   | Today's hearings | http://localhost:3000/employee/hearings | Where court staff land after signing in |
   | DS audit | http://localhost:3000/ds-audit | Internal page for checking design-system primitives |

## Demo accounts

Nothing authenticates yet. These fixtures exist so each role's path can be reviewed.

**Court staff:** sign in with a username. Any non-empty password works, and usernames are
not case-sensitive. The sign-in screen also has a button to fill in each one. Source:
[apps/dristi-app/src/lib/employee/sign-in.ts](apps/dristi-app/src/lib/employee/sign-in.ts).

| Role | Username | Court rooms |
|---|---|---|
| Magistrate | `michaelGeorgeJudge` | Court 1 |
| Bench clerk | `uddipanBenchClerk` | Court 1 |
| Scrutiny officer | `bijuScrutinyOfficer` | Courts 1–5 |
| Typist | `sreelathaTypist` | Court 1 |

**Citizens:** sign in with a mobile number at `/citizen`. Any 6-digit OTP is accepted. Source:
[apps/dristi-app/src/lib/sign-in/demo-accounts.ts](apps/dristi-app/src/lib/sign-in/demo-accounts.ts).

| Mobile | Account |
|---|---|
| `8009460966` | Adv. Anjali Nair: an advocate who also holds a litigant profile |
| `7007663437` | Rajan K. Nair: a litigant who can add an advocate profile from Settings |

Any other number shows the unregistered-account state.

## Common commands

Run all commands from the repository root.

```bash
npm run dev               # Start the dev server on http://localhost:3000
npm run build             # Production build of the Dristi App
npm run start             # Serve the production build
npm run lint              # ESLint + every DS gate below
npm run test:app          # Unit tests (node --test via tsx)
```

**Design-system gates** (these also run inside `npm run lint`):

```bash
npm run check:ds-fresh    # vendor DS is on the commit pinned in ds.lock.json
npm run check:ui-sync     # synced primitives match the vendor DS exactly
npm run check:tokens      # only semantic DS tokens, no raw colours
npm run check:typography  # only named DS text roles
npm run check:spacing     # spacing stays on the DS ladder
npm run check:table-rows  # tables compose from the shared table plate
```

**Design-system maintenance:**

```bash
npm run setup:ds                    # Re-fetch / re-pin the vendor DS (runs on install)
npm run sync:ui -- button           # Copy a primitive from the vendor DS into the app
npm run sync:ui -- --tokens-only    # Sync tokens only
npm run ds:bump                     # Move the DS pin (dedicated upgrade branch only)
```

**Verification profiles** (from [.agents/verification.json](.agents/verification.json)):

```bash
npm run verify:ui         # check:ds-fresh + lint + check:rails
npm run verify:agents     # check:rails + test:rails (agent configuration)
```

## Working with the design system

The pinned Pucar Design System sets the rules for all UI. In practice:

- **Never edit synced primitives** in `apps/dristi-app/src/components/ui/`. Re-sync them
  with `npm run sync:ui -- <component>` and inspect the diff. If the DS can't do what a
  screen needs, raise a DS request. Don't patch it locally.
- Use semantic tokens and named text roles. `npm run lint` fails on raw colours,
  off-ladder spacing, or ad-hoc type.
- The pin in [ds.lock.json](ds.lock.json) changes only through `npm run ds:bump`, on its own
  branch and PR. Never fold a DS upgrade into a feature.
- `PUCAR_DS_ROOT` points the app at a local DS checkout **for local testing only**. Don't
  commit UI built against an override.

See [docs/design/design-system.md](docs/design/design-system.md) for the full overview.

## Documentation

- [docs/README.md](docs/README.md): map of all product and design docs. Start here.
- [docs/product/](docs/product/README.md): what DRISTI is: domain, journey, standards, open questions.
- [docs/design/design-system.md](docs/design/design-system.md): how Dristi UI is built from the DS.
- [docs/feedback-widget.md](docs/feedback-widget.md): how reviewers comment on a running deployment.
- [docs/design-mode.md](docs/design-mode.md): in-app design review mode (off by default).
- [docs/agent-orchestration.md](docs/agent-orchestration.md): how the AI-agent layer is generated and checked.
- [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md): entry point for AI coding assistants (Claude Code, Cursor, Codex).
- [CONTRIBUTING.MD](CONTRIBUTING.MD): how to propose and land changes.
- Domain source of truth: [DRISTI 2.0 — Domain Model](https://dristidomain.netlify.app/).

## Project structure

```
.
├── .github/
│   ├── workflows/              # agent-rails.yml, docker-publish.yml
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.MD
├── apps/
│   └── dristi-app/             # Dristi App (Next.js)
│       ├── public/             # Static assets, sample case files, demo PDFs
│       ├── scripts/            # DS resolver, sync, and lint gates
│       └── src/
│           ├── app/            # Routes (App Router)
│           │   ├── citizen/    #   Citizen sign-in
│           │   ├── employee/   #   Court-staff area (/employee/*)
│           │   ├── (app)/      #   Cases, applications, vakalatnama
│           │   ├── (portal)/   #   Advocate home, people, settings
│           │   ├── filings/    #   Case filing
│           │   ├── tasks/      #   Task flows (fix, sign, pay, submit)
│           │   └── ...
│           ├── components/     # Feature components; ui/ holds synced DS primitives
│           ├── hooks/
│           └── lib/            # Domain logic, fixtures, copy, and tests (*.test.ts)
├── docker/
│   └── Dockerfile              # Standalone production image
├── docs/                       # Product and design docs (see docs/README.md)
├── scripts/                    # DS fetch/bump, agent-rails generation and checks
├── vendor/                     # Pinned design system (gitignored; created by npm install)
├── .agents/                    # Canonical agent skills, roles, policies
├── .claude/ .cursor/ .codex/   # Generated tool adapters (do not edit by hand)
├── ds.lock.json                # Pinned design-system commit
├── netlify.toml                # Netlify build configuration
├── package.json                # Workspace root and scripts
├── AGENTS.md
├── CLAUDE.md
├── CONTRIBUTING.MD
└── README.md
```

## Environment variables

Copy [apps/dristi-app/.env.example](apps/dristi-app/.env.example) to
`apps/dristi-app/.env.local` (git-ignored) for local development. All variables are optional.

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_FASTERFIXES_PROJECT_ID` | Public project ID for the FasterFixes feedback widget. It's inlined into the client bundle at build time, so it isn't a secret. Leave it unset to disable the widget completely. | `proj_...` |
| `NEXT_PUBLIC_FASTERFIXES_CAPTURE_DIAGNOSTICS` | Set to `false` to stop attaching console logs and network requests to feedback items | `false` |
| `NEXT_PUBLIC_FASTERFIXES_API_ORIGIN` | Self-hosted FasterFixes origin. Unset uses the FasterFixes cloud. | `https://feedback.internal.example` |
| `PUCAR_DS_ROOT` | Use a local DS checkout instead of `vendor/`. For local testing only. | `/path/to/dristi-design-system` |
| `NEXT_OUTPUT` | Set to `standalone` to emit a self-contained server. The Dockerfile sets this. | `standalone` |
| `STATIC_EXPORT` | Set to `true` for a static export (`next export`) | `true` |

## Docker

The [docker/Dockerfile](docker/Dockerfile) is a three-stage build (deps → builder → runner)
that produces a standalone Next.js server on Node 22. The deps stage installs Git,
because `npm ci` fetches the pinned design system.

```bash
# Build (docker or podman)
docker build -t dristi-fe-develop:latest -f docker/Dockerfile .

# Run
docker run -p 3000:3000 dristi-fe-develop:latest
```

Build arguments:

| Arg | Default | Purpose |
|---|---|---|
| `NODE_VERSION` | `22` | Node base image version |
| `NEXT_PUBLIC_FASTERFIXES_PROJECT_ID` | project default | Feedback widget ID; pass an empty value to build without it |
| `GIT_COMMIT_SHA` | `unknown` | Recorded in the image for traceability |

There's no Compose file. The app has no back-end services to run alongside it yet.

> Don't run `npm run build` in a checkout where `npm run dev` is running. Both write to
> `apps/dristi-app/.next`. Build in a separate worktree, or stop the dev server first.

## Deployment

- **Netlify:** [netlify.toml](netlify.toml) builds from the repository root, so the
  postinstall DS fetch runs, then publishes `apps/dristi-app/.next` with the Next.js
  runtime plugin. Most routes are server-rendered on demand, so this isn't a static site.
- **Container image:** pushes to `main` publish `ghcr.io/pucardotorg/dristi-fe-develop`
  (see CI/CD below).

## CI/CD

- [.github/workflows/agent-rails.yml](.github/workflows/agent-rails.yml) runs
  `npm run verify:agents` on every pull request and on pushes to long-lived branches. It
  checks that generated agent adapters match their sources and doesn't need an install.
- [.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml) builds
  `docker/Dockerfile` and pushes it to GitHub Container Registry on every push to `main`.
  Tags are `main-<sha>` and `latest`.

CI doesn't yet run `npm run lint` or `npm run test:app`. Run them locally before opening
a PR (see [CONTRIBUTING.MD](CONTRIBUTING.MD)).
