# Codex Operator SOP

## Setup

1. Work from the repository root.
2. Confirm no unrelated work will be overwritten:

```powershell
git status
```

3. Install dependencies:

```powershell
npm install
```

4. Confirm Cloudflare access is available through `wrangler login` or a scoped `CLOUDFLARE_API_TOKEN`.

## Local Dev

Run the Worker locally:

```powershell
npm run dev
```

Use the local Wrangler URL to inspect:

- `GET /`
- `GET /health`
- `POST /chat`
- `POST /analyze`

## Validation

Run the full project validation:

```powershell
npm run validate
```

This runs TypeScript build checks and the Vitest suite.

## Deploy Dry Run

Run a Wrangler dry run before deployment:

```powershell
npm run deploy:dry-run
```

If auth or account configuration blocks the command, capture the exact Wrangler error and resolve Cloudflare access before continuing.

## Deployment

Deploy only after validation and dry run pass:

```powershell
npm run deploy
```

After deployment, verify `GET /health` on the deployed Worker URL and run one safe `/analyze` request with non-sensitive test input.

## Rollback

1. Identify the previous good deployment in Cloudflare Workers deployments.
2. Use the Cloudflare dashboard rollback flow or the current Wrangler rollback command supported by the account.
3. Verify `GET /health` and route behavior after rollback.
4. Open a follow-up issue or commit with the failed deployment notes.

## Git Workflow

1. Start clean or document pre-existing uncommitted files.
2. Make focused edits only.
3. Run:

```powershell
npm run validate
npm run deploy:dry-run
git diff --stat
git status
```

4. Commit with a clear asset-oriented message:

```powershell
git add README.md docs/CODEX_OPERATOR_SOP.md docs/ASSET_REGISTER.md src/index.ts test/index.spec.ts
git commit -m "Convert hello-ai to BranchOps intake worker"
```

5. Push the active branch:

```powershell
git push origin HEAD
```
