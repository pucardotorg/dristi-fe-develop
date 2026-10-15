# Contributing to Dristi

Thank you for considering a contribution to **Dristi**! We welcome bug reports, feature
requests, documentation improvements, and code.

---

## Getting Started

Set up the project locally first. Follow the [README](README.md) quick start.

**Prerequisites:**
- Node.js 22 or later, and npm
- Git, with access to GitHub (the install step clones the Pucar Design System)
- Basic familiarity with React, Next.js (App Router), TypeScript and Tailwind CSS

---

## How to Contribute

### 1. Get the Repository

**Members of `pucardotorg`** can clone the repository and push branches to it directly:

```bash
git clone https://github.com/pucardotorg/dristi-fe-develop.git
cd dristi-fe-develop
```

**External contributors** should fork it:

1. Click **Fork** at the top right of this repository.
2. Clone your fork:
   ```bash
   git clone https://github.com/{your-username}/dristi-fe-develop.git
   cd dristi-fe-develop
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/pucardotorg/dristi-fe-develop.git
   ```

### 2. Check for Existing Issues

Before you start:

1. **Check whether an issue already exists** for the bug or feature in
   [Issues](https://github.com/pucardotorg/dristi-fe-develop/issues).
2. **If not, open one** with the matching template:
   - **Bug Report** — something broken or behaving unexpectedly
   - **Feature Request** — a new capability
   - **Enhancement Request** — an improvement to something that already exists
3. **Wait for agreement** before starting a new screen, a change to a user journey, or
   anything that changes product behaviour. Product meaning comes from
   [docs/product/](docs/product/README.md). Don't invent users, legal rules, or system
   capabilities. If a fact you need is missing, check
   [docs/product/open-questions.md](docs/product/open-questions.md).
4. **Comment on the issue** so others know you're working on it.

### 3. Set Up Your Development Environment

1. Install dependencies. This also fetches the pinned design system into `vendor/`:
   ```bash
   npm install
   ```

2. (Optional) Configure the environment:
   ```bash
   cp apps/dristi-app/.env.example apps/dristi-app/.env.local
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Check that everything works:
   - App: http://localhost:3000/
   - Citizen sign-in: http://localhost:3000/citizen
   - Court sign-in: http://localhost:3000/employee/login

   The demo accounts for each role are listed in the [README](README.md#demo-accounts).

### 4. Create a Branch

Always branch from the latest `main`. Never commit to `main` directly.

```bash
git fetch origin
git checkout -b type/brief-description origin/main
```

**Branch name format:** `type/brief-description`, in kebab-case.

**Type** can be:
- `feature` — a new feature or screen
- `fix` — a bug fix
- `chore` — tooling, CI, dependencies, maintenance
- `docs` — documentation only
- `spec` — specifications for agents and fellow developers

**Examples:**
```bash
git checkout -b feature/scrutiny-trim-and-filing-samples origin/main
git checkout -b fix/hearing-date-overflow origin/main
git checkout -b chore/docker-build-push origin/main
git checkout -b docs/readme-setup origin/main
```

**Design-system upgrades get their own branch.** Change the pin in
[ds.lock.json](ds.lock.json) only with `npm run ds:bump`, on a dedicated branch with its
own PR. Never fold it into a feature.

### 5. Make and Test Changes

1. **Follow the design system.** The pinned Pucar Design System sets the rules for all UI:
   - Compose screens from the DS primitives in `apps/dristi-app/src/components/ui/`.
     These are synced copies. **Never edit them by hand.** To add or update one, run:
     ```bash
     npm run sync:ui -- <component>
     ```
     Then review the diff. If the DS can't do what you need, raise a DS request
     ([docs/design/ds-requests.md](docs/design/ds-requests.md)). Don't patch the primitive locally.
   - Use semantic tokens and named text roles (`text-body`, `text-title-*`). Don't use
     raw colours, ad-hoc font sizes, or off-ladder spacing.
   - Build tables from `apps/dristi-app/src/components/chrome/table-plate.ts`.
   - Meet the DS accessibility guidelines (`ACCESSIBILITY.md` in the design system),
     and check layouts at phone, tablet and desktop widths.

2. **Follow the code conventions:**
   - TypeScript throughout, matching the style of the surrounding code
   - Put domain logic, fixtures and copy in `apps/dristi-app/src/lib/`, and components in
     `apps/dristi-app/src/components/<feature>/`
   - Use clear names, and explain *why* in comments where the reason isn't obvious

3. **Check the design system is on the pinned version:**
   ```bash
   npm run check:ds-fresh
   ```

4. **Lint.** This runs ESLint plus the DS checks for tokens, typography, UI sync,
   spacing and table rows:
   ```bash
   npm run lint
   ```

5. **Run the tests:**
   ```bash
   npm run test:app
   ```

6. **Add tests** for bug fixes and new logic:
   - Put them next to the code as `*.test.ts` under `apps/dristi-app/src/lib/`
   - If you add a new folder, add its pattern to the `test` script in
     [apps/dristi-app/package.json](apps/dristi-app/package.json)

7. **If you changed the agent layer** (`.agents/`), regenerate and check the adapters:
   ```bash
   npm run sync:rails
   npm run verify:agents
   ```
   Edit the sources in `.agents/`. Never edit the generated copies in `.claude/`,
   `.cursor/` or `.codex/`.

### 6. Verify Application Functionality

Before opening a pull request:

1. **Run the full UI check:**
   ```bash
   npm run verify:ui
   ```

2. **Test your changes in the running app** (`npm run dev`):
   - [ ] The app runs without errors in the browser console or the terminal
   - [ ] The flow you changed works from start to finish for each role it affects
   - [ ] Empty, loading, error and long-content states look right
   - [ ] The layout works at phone width (no horizontal scroll), tablet and desktop
   - [ ] Keyboard navigation and focus order work, and controls have accessible names

3. **If you changed the Dockerfile or build configuration**, check the production build:
   ```bash
   npm run build
   ```
   Don't run this in a checkout where `npm run dev` is running, because they share
   `apps/dristi-app/.next`. Use a separate worktree or stop the dev server first.

### 7. Commit Changes

Write a short commit subject in the imperative mood that says what changed:

```
Brief description of the change

Optional longer description explaining what and why.
```

**Examples:**
```bash
git commit -m "Add CIN/PAN skip to the filing form"
git commit -m "Fix hearing date overflowing on phone widths"
git commit -m "Update README with setup and demo accounts"
```

**Commit message rules:**
- Use the imperative mood ("Add feature", not "Added feature" or "Adds feature")
- Keep the first line under 70 characters
- Group related changes into one commit, and keep unrelated changes apart
- Reference issues in the body: "Closes #123" or "Fixes #456"

### 8. Push and Open a Pull Request

1. **Sync with `main`:**
   ```bash
   git fetch origin            # or: git fetch upstream (fork)
   git rebase origin/main      # or: git rebase upstream/main
   ```

2. **Push your branch:**
   ```bash
   git push origin your-branch-name
   ```

3. **Open a pull request into `main`:**
   - Fill out the PR template completely
   - Link the related issue ("Closes #issue-number")
   - For UI changes, add screenshots or a short recording, including a phone-width view

4. **PR title:** a short summary in the same style as a commit subject.

   Examples:
   - `Trim scrutiny and add filing samples`
   - `Remove state-specific copy from citizen screens`
   - `Build and push Docker image to GHCR`

---

## PR Review Process

1. **Automated checks** run on every PR:
   - Agent rails (`npm run verify:agents`)

   CI doesn't yet run lint or unit tests. Reviewers expect `npm run verify:ui` and
   `npm run test:app` to pass locally.

2. **Code review:**
   - A maintainer reviews the change. For UI, the review covers DS consistency,
     accessibility and responsive behaviour as well as correctness.
   - Address the requested changes
   - Keep the discussion focused and professional

3. **Approval and merge:**
   - Once your PR is approved, a maintainer merges it into `main`
   - Each merge to `main` publishes a new Docker image to GitHub Container Registry

---

## Questions?

If you have questions:
- Check the [README](README.md) and [docs/](docs/README.md) first
- Search [existing issues](https://github.com/pucardotorg/dristi-fe-develop/issues)
- Contact the maintainers

---

## Code of Conduct

By participating in this project, you agree to:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Accept constructive criticism gracefully
- Focus on what is best for the community and the people who use Dristi
