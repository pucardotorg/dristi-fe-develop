# syntax=docker/dockerfile:1

ARG NODE_VERSION=22

# ---- deps: install workspaces and fetch the pinned design system ----
FROM node:${NODE_VERSION}-slim AS deps

# git is needed by the postinstall step (scripts/ensure-ds.mjs), which clones
# pucardotorg/dristi-design-system into vendor/ and checks out the ds.lock.json pin.
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ds.lock.json ./
COPY apps/dristi-app/package.json apps/dristi-app/package.json
COPY scripts/ensure-ds.mjs scripts/ensure-ds.mjs
COPY apps/dristi-app/scripts/resolve-ds.mjs apps/dristi-app/scripts/resolve-ds.mjs
RUN npm ci

# ---- builder: build the Next.js app as a standalone server ----
FROM deps AS builder

COPY . .

# Public FasterFixes project ID, inlined into the client bundle at build time
# (same default as netlify.toml). Pass an empty value to build without the widget.
ARG NEXT_PUBLIC_FASTERFIXES_PROJECT_ID=proj_34da4857dae6d8831cbd098f
ENV NEXT_PUBLIC_FASTERFIXES_PROJECT_ID=${NEXT_PUBLIC_FASTERFIXES_PROJECT_ID} \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- runner: minimal runtime image ----
FROM node:${NODE_VERSION}-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

# Standalone output keeps the monorepo layout: server.js lives under apps/dristi-app.
# Static assets and public/ (including the generated public/vendor runtime assets)
# are not part of the standalone tree and are copied alongside it.
COPY --from=builder --chown=node:node /app/apps/dristi-app/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/dristi-app/.next/static ./apps/dristi-app/.next/static
COPY --from=builder --chown=node:node /app/apps/dristi-app/public ./apps/dristi-app/public

ARG GIT_COMMIT_SHA=unknown
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}

USER node

EXPOSE 3000

CMD ["node", "apps/dristi-app/server.js"]
