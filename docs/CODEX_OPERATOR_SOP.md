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
5. Confirm the D1 database has the current schema from `schema.sql`, including `intake_events`, `intake_leads`, and `lead_sync_queue`, before expecting structured event logs, lead export, or Airtable queue sync.
6. Configure `ADMIN_EXPORT_TOKEN` as a Cloudflare secret when admin CSV export or Airtable sync should be enabled. Do not commit or hardcode the token.
7. Configure Airtable sync server variables only in the Worker environment. Do not place Airtable keys in browser code, localStorage, README examples with real values, or committed config.

```powershell
npx wrangler secret put ADMIN_EXPORT_TOKEN
npx wrangler secret put AIRTABLE_API_KEY
npx wrangler secret put AIRTABLE_BASE_ID
npx wrangler secret put AIRTABLE_TABLE_NAME
```

Apply the D1 schema before testing lead queue behavior:

```powershell
npx wrangler d1 execute hello-ai-prod --file schema.sql --local
npx wrangler d1 execute hello-ai-prod --file schema.sql --remote
```

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

The browser page should show the BranchOps sidebar navigation, app dashboard, structured intake form, separate chat lane, optional contact info section, export/admin panel, and system health panel. `/chat` and `/analyze` JSON responses should include `request_id`.

Manual UI checks:

- Desktop shows a left sidebar with Dashboard, New Intake, Licensing Builder, Lead Capture, Export / Admin, and System Health.
- Mobile width shows the Menu button and opens the same feature navigation.
- Planner navigation changes the active analyzer mode text.
- Each planner panel shows a mode-specific title, recommended use case, prompt helper bullets, and the preselected analyze mode.
- Analyze intake renders result cards for objective, classification, asset, execution_plan, systems, monetization_model, automation_opportunities, legal_compliance_risks, scaling_path, and long_term_value.
- Lead Capture lists optional fields, what is stored, what is not stored, and the request_id linkage.
- Export / Admin lists CSV fields and a safe curl example with an ADMIN_EXPORT_TOKEN placeholder only.
- Export / Admin lists the Airtable Sync Queue, `GET /admin/export/sync-queue`, `POST /admin/sync/airtable`, required server vars, and the no-browser-secrets boundary.
- System Health fetches `/health` without requiring secrets.
- System Health renders readable capability cards plus expandable raw JSON.

## Validation

Run the full project validation:

```powershell
npm run build
npm run validate
```

`npm run validate` runs TypeScript build checks and the Vitest suite.

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
- `/analyze` accepts optional lead fields and rejects malformed email values.
- `/chat` and `/analyze` create public-safe `intake_events` rows without storing full content.
- lead submissions create `intake_leads` rows linked by `request_id` without storing full prompt content.
- lead submissions create `lead_sync_queue` rows with `destination = airtable`, `status = queued`, and no full prompt content.
- `GET /admin/export/intake-leads` returns `503` until `ADMIN_EXPORT_TOKEN` is configured.
- `GET /admin/export/sync-queue` returns `503` until `ADMIN_EXPORT_TOKEN` is configured and `401` with a missing or invalid bearer token.
- `POST /admin/sync/airtable` returns `503` with `Airtable sync is not configured.` until Airtable server variables are configured.
- `POST /admin/sync/airtable` returns a JSON summary with `processed`, `synced`, `failed`, and `skipped` when configured.
- Throttled requests return `429` with `request_id`.

Admin sync verification commands:

```powershell
curl.exe -H "Authorization: Bearer <ADMIN_EXPORT_TOKEN>" https://<worker-url>/admin/export/sync-queue
curl.exe -X POST -H "Authorization: Bearer <ADMIN_EXPORT_TOKEN>" https://<worker-url>/admin/sync/airtable
```

## Rollback

1. Identify the previous good deployment in Cloudflare Workers deployments.
2. Use the Cloudflare dashboard rollback flow or the current Wrangler rollback command supported by the account.
3. Verify `GET /health` and route behavior after rollback.
4. If rolling back the Airtable sync layer, leave the D1 `lead_sync_queue` table in place unless a separate data-retention decision is approved; removing the table is not required to restore prior route behavior.
5. Open a follow-up issue or commit with the failed deployment notes.

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
git commit -m "add Airtable lead sync queue"
```

5. Push the active branch:

```powershell
git push -u origin codex/airtable-lead-sync-queue
```
