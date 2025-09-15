# Branch protection guidance

Recommended rules for `master` (and `main` if used):

1. Require a pull request before merging
   - Require approvals: 1+
   - Dismiss stale approvals when new commits are pushed
2. Require status checks to pass before merging
   - Required checks: `prisma`, `frontend`, `backend` (from CI workflow)
3. Require conversation resolution before merging
4. Require signed commits (optional)
5. Restrict who can push to matching branches (optional; use CODEOWNERS)
6. Enforce for administrators (recommended)

Notes:
- Checks only appear if the corresponding path exists. If you don’t have a frontend or backend yet, remove those checks or keep them optional.
- Keep `.env` files out of git. Use `.env.example` and GitHub Actions secrets for CI secrets.
