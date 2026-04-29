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
5. Confirm the D1 database has the current schema from `schema.sql`, including `intake_events`, before expecting structured event logs.

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

The browser page should show the BranchOps intake mode menu. `/chat` and `/analyze` JSON responses should include `request_id`.

## Validation

Run the full project validation:

```powershell
npm run validate
```

This runs TypeScript build checks and the Vitest suite.

Review dependency audit output separately:

```powershell
npm audit
```

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

Confirm:

- `request_id` appears on all JSON responses.
- `/analyze` accepts optional `mode`, `audience`, `urgency`, and `budget`.
- `/chat` and `/analyze` create public-safe `intake_events` rows without storing full content.
- Throttled requests return `429` with `request_id`.

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
npm audit
git diff --stat
git status
```

4. Commit with a clear asset-oriented message:

```powershell
git add README.md docs/CODEX_OPERATOR_SOP.md docs/ASSET_REGISTER.md schema.sql src/index.ts test/index.spec.ts
git commit -m "Add BranchOps intake controls and logs"
```

5. Push the active branch:

```powershell
git push origin HEAD
```
