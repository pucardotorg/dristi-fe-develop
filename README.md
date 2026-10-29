# Pucar Dristi 2.0

PUCAR's DRISTI platform for running NI Act §138 (cheque-dishonour) cases through Indian
courts. One shared national core, deployed per state with local rules and languages.

This repository holds the **Dristi App** (the main product front end) and the product and
design docs behind it. It uses:

- **Next.js 16** (App Router) + **React 19** + **TypeScript** for the app
- **Tailwind CSS 4** with shadcn-style UI components in `apps/dristi-app/src/components/ui/`
- **npm workspaces** for the monorepo (`apps/*`)
- **Node's built-in test runner** (via `tsx`) for unit tests
- **Docker** for a standalone production image
- **Netlify** for preview and review deployments
- **GitHub Actions** for publishing Docker images to GHCR

> **This is a prototype.** There is no real authentication or back end yet: screens run
> on local fixtures, and demo accounts are listed below.

## Quick start

**Prerequisites:** Node.js 22 or later, npm, and Git.

1. **Clone and install:**

   ```bash
   git clone https://github.com/pucardotorg/dristi-fe-develop.git
   cd dristi-fe-develop
   npm install
   ```

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
npm run lint              # ESLint
npm run test:app          # Unit tests (node --test via tsx)
```

## Documentation

- [docs/README.md](docs/README.md): map of the product docs. Start here.
- [docs/product/](docs/product/README.md): what DRISTI is: domain, journey, standards, open questions.
- [docs/feedback-widget.md](docs/feedback-widget.md): how reviewers comment on a running deployment.
- [CLAUDE.md](CLAUDE.md): coding standards for Next.js, React and TypeScript in this repo
  (also read by Claude Code).
- [CONTRIBUTING.MD](CONTRIBUTING.MD): how to propose and land changes.
- Domain source of truth: [DRISTI 2.0 — Domain Model](https://dristidomain.netlify.app/).

## Project structure

```
.
├── .github/
│   ├── workflows/              # docker-publish.yml
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.MD
├── apps/
│   └── dristi-app/             # Dristi App (Next.js)
│       ├── public/             # Static assets, sample case files, demo PDFs
│       ├── scripts/            # Copies pdf.js / tesseract runtime assets into public/
│       └── src/
│           ├── app/            # Routes (App Router)
│           │   ├── citizen/    #   Citizen sign-in
│           │   ├── employee/   #   Court-staff area (/employee/*)
│           │   ├── (app)/      #   Cases, applications, vakalatnama
│           │   ├── (portal)/   #   Advocate home, people, settings
│           │   ├── filings/    #   Case filing
│           │   ├── tasks/      #   Task flows (fix, sign, pay, submit)
│           │   └── ...
│           ├── components/     # Feature components; ui/ holds the shared UI primitives
│           ├── hooks/
│           └── lib/            # Domain logic, fixtures, copy, and tests (*.test.ts)
├── docker/
│   └── Dockerfile              # Standalone production image
├── docs/                       # Product docs (see docs/README.md)
├── netlify.toml                # Netlify build configuration
├── package.json                # Workspace root and scripts
├── CLAUDE.md                   # Coding standards (also read by Claude Code)
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
| `NEXT_OUTPUT` | Set to `standalone` to emit a self-contained server. The Dockerfile sets this. | `standalone` |
| `STATIC_EXPORT` | Set to `true` for a static export (`next export`) | `true` |

## Docker

The [docker/Dockerfile](docker/Dockerfile) is a three-stage build (deps → builder → runner)
that produces a standalone Next.js server on Node 22.

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

- **Netlify:** [netlify.toml](netlify.toml) builds from the repository root and publishes `apps/dristi-app/.next` with the Next.js
  runtime plugin. Most routes are server-rendered on demand, so this isn't a static site.
- **Container image:** pushes to `main` publish `ghcr.io/pucardotorg/dristi-fe-develop`
  (see CI/CD below).

## CI/CD

- [.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml) builds
  `docker/Dockerfile` and pushes it to GitHub Container Registry on every push to `main`.
  Tags are `main-<sha>` and `latest`.

CI doesn't yet run `npm run lint` or `npm run test:app`. Run them locally before opening
a PR (see [CONTRIBUTING.MD](CONTRIBUTING.MD)).
