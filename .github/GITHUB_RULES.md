# GitHub Rules for this Repository

This document defines how we use GitHub for this project: branching, reviews, checks, security, and database practices.

## Branching model
- Default branch: `master`.
- Create topic branches from `master`:
  - `feat/<short-name>` for features
  - `fix/<short-name>` for bug fixes
  - `chore/<short-name>` for non-functional changes
  - `docs/<short-name>` for documentation
  - `ci/<short-name>` for CI/CD changes
- Keep PRs small and focused (one logical change per PR).

## Pull requests
- Use the PR template: `.github/pull_request_template.md`.
- Link a related issue when applicable.
- Require at least 1 approval; resolve all review comments before merge.
- CI must be green (see Required checks below).
- No secrets or `.env` files in PRs (use GitHub Secrets for CI).
- Prefer Draft PRs for work-in-progress.

## Required checks (must pass)
- CI workflow: `.github/workflows/ci.yml`
  - `prisma`: validates `prisma/schema.prisma` (SQLite). Skips if schema is missing.
  - `frontend`: lints/builds/tests if a frontend `package.json` exists.
  - `backend`: lints/builds/tests if a backend `package.json` exists.
- Security workflow: `.github/workflows/security.yml`
  - CodeQL analysis for JavaScript/TypeScript.

Note: Frontend/backend jobs auto-detect common paths (`frontend`, `apps/frontend`, `backend`, `apps/backend`, `server`). If absent, the job is skipped and won’t block merges.

## Branch protection
- Apply GitHub Branch Protection to `master`:
  - Require PR before merging, 1+ approval, and conversation resolution.
  - Require status checks: `prisma`, `frontend`, `backend`, and `Security` (CodeQL) to pass.
  - Enforce for administrators.
- Details: see `docs/branch-protection.md`.

## Code owners
- `.github/CODEOWNERS` sets `@Anirach` as owner for all files. As the project grows, add paths for specific reviewers.

## Commits & messages
- Follow Conventional Commits where practical:
  - `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `build:`, `ci:`
- Commit early, push often; keep commits scoped and descriptive.

## Issues & labels
- Use issue templates in `.github/ISSUE_TEMPLATE/`:
  - `bug_report.md` for bugs
  - `feature_request.md` for enhancements
- Label issues appropriately (`bug`, `enhancement`, etc.).

## Security & secrets
- Vulnerability scanning: CodeQL runs on PRs, pushes, and weekly.
- Report vulnerabilities privately via GitHub Security Advisories if enabled; otherwise open an issue without sensitive details and tag `security`.
- Never commit secrets; use GitHub Actions secrets for CI.

## CI/CD expectations
- Node version: 20 (actions/setup-node@v4).
- Scripts should be wired in `package.json`:
  - `lint`, `build`, `test` (jobs use `--if-present`).
- Keep builds deterministic; prefer `npm ci` with a lockfile.

## Prisma + SQLite rules
- Schema file: `prisma/schema.prisma`.
- Local DB URL: set in `.env` as `DATABASE_URL="file:./prisma/dev.db"` (see `.env.example`).
- Do not commit SQLite database files; they are ignored via `.gitignore`.
- Before opening a PR that changes the schema:
  - Run `prisma validate` locally to ensure the schema is sound.
  - If using Prisma Migrate, include migration files. If not yet configured, at minimum include the schema changes and note migration steps in the PR description.

## Large files & artifacts
- Do not commit build outputs, archives, or binaries. Use Releases or an object store if needed.
- Consider Git LFS for legitimate large versioned assets.

## Documentation
- Keep `Spec.md` updated when scope or requirements change.
- Add new docs under `docs/` and link them from relevant PRs.

## Exceptions
- If a rule needs to be bypassed (e.g., emergency fix), explain the rationale in the PR and get an approval from a code owner.

---
Last updated: 2025-09-15
