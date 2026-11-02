# DRISTI docs map

Orientation for this repo. Docs describe the product; they are
**not** the live case-management app (that lives in [Dristi App](../apps/dristi-app)).

**Domain detail source of truth:** [DRISTI 2.0 — Domain Model](https://dristidomain.netlify.app/)
(data under its `data/` folder). Snapshot date for product prose: **2026-07-30**.

## Sections

| Section | What it holds | Start here |
|---|---|---|
| **Product** | What DRISTI is — domain, journey, standards, open questions | [product/README.md](product/README.md) |
| **Principles** | Cross-cutting PUCAR design principles — convictions that resolve conflicts between good outcomes. Org-wide, not DRISTI-specific | [principles/](principles/) |
| **Feedback** | How reviewers comment on the running app; feedback → GitHub issues | [feedback-widget.md](feedback-widget.md) |

## Repo layers (outside `docs/`)

| Path | Role |
|---|---|
| `apps/dristi-app` | Dristi App (main product) |
| `docker/` | Production Dockerfile for the Dristi App (standalone Next.js server); no compose file |
| `.github/workflows/docker-publish.yml` | Builds `docker/Dockerfile` and pushes it to GHCR on pushes to `main` |

## Intentionally not here

- Full statutory text and growing datasets — pull from the domain site / its `data/`.
- Design work (design system, proposals, feature history) — lives in the separate design
  repo.
