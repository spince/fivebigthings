# Engineering workflow

How changes ship for fivebigthings.app. The rule is simple: **nothing lands
on `main` without a pull request and green checks**, and every merge to
`main` is what staging runs.

## The flow

1. Branch from `main`, open a PR. (Muse assigns Spencer to every PR.)
2. CI runs on the PR (`.github/workflows/ci.yml`):
   - **tests** — pytest route/API/calendar tests + `node --check` on all JS.
   - **prek** — the hooks in `.pre-commit-config.yaml` (hygiene + ruff),
     the same checks you can run locally.
3. Merge when green. Merging triggers **Deploy to staging**
   (`.github/workflows/deploy-staging.yml`), bound to the GitHub
   **staging** environment.
4. Production is manual: run **Deploy to production**
   (`.github/workflows/deploy-production.yml`) from the Actions tab. The
   **production** environment requires a human approval (see below), and the
   deploy uses the `service_id` committed in `fastly.toml`.

Local checks before pushing:

```sh
pip install -r requirements-dev.txt prek
prek run --all-files
python -m pytest -q
```

(`.pre-commit-config.yaml` is read by both prek and the original pre-commit;
use whichever you have.)

## One-time GitHub settings (repo admin — do these once)

These live in GitHub settings, not in code, so they are set by hand:

### 1. Require PRs on `main` — Settings > Branches > Add rule for `main`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass: **tests** and **prek** (from the CI workflow)
- ✅ Require branches to be up to date before merging
- ✅ Do not allow force pushes / deletions
- (Optional, recommended) Require approvals: 1 — with a single-maintainer
  repo this mainly guards against accidental self-merges.

Do this **after** the CI workflow has run once, so the check names exist to select.

### 2. Environments — Settings > Environments
- **staging**
  - Variable: `FASTLY_STAGING_SERVICE_ID` = the staging Compute service id
  - Secret: `FASTLY_API_TOKEN` = a Fastly token that can deploy
  - No approval needed — merges to main deploy here automatically.
  - Create the staging service once by hand (duplicate the production
    service in Fastly, or `fastly compute deploy` against a new service),
    and attach a staging domain such as `staging.fivebigthings.app`.
- **production**
  - Secret: `FASTLY_API_TOKEN`
  - ✅ Required reviewers: Spencer — this is the approval gate on the
    manual production deploy workflow.

Until the staging variable/secret exist, the staging workflow runs on every
merge, reports what is missing, and skips the deploy (green), so turning
staging on later is just filling in those two values.
