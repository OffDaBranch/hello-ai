# BranchOps AI Intake Worker

## Asset Metadata

| Field | Value |
| --- | --- |
| Asset Name | BranchOps AI Intake Worker |
| Asset ID | BOH-AI-INTAKE-001 |
| Owner | Branch Off Holdings LLC |
| Runtime | Cloudflare Workers + Workers AI + D1 |
| Purpose | Convert raw founder/business ideas into structured BranchOps asset plans. |

This repository is the public-safe same-day intake Worker for BranchOps asset planning. It is not the internal BranchOps control plane and should not contain private operating records, customer secrets, or production credentials.

## Identity Boundary

| Field | Value |
| --- | --- |
| Repository | `OffDaBranch/hello-ai` |
| Durable asset | BranchOps AI Intake Worker |
| Package identity | `branchops-ai-intake-worker` |
| Cloudflare Worker deploy target | `hello-ai` |
| D1 database | `hello-ai-prod` |

The package and asset identity remain `branchops-ai-intake-worker` / BranchOps AI Intake Worker. The current Cloudflare Workers Builds deploy target for this repository is `hello-ai`, with the `hello_ai_prod` binding pointed at the `hello-ai-prod` D1 database. Do not rename package, asset registry, or D1 identities just to match the Cloudflare service name.

## Route Map

| Method | Path | Purpose | Contract |
| --- | --- | --- | --- |
| `GET` | `/` | Serve the browser intake/chat demo UI | HTML demo surface |
| `GET` | `/output-utility` | Format generated BranchOps results for reuse | HTML output utility with copy/share/print/download actions |
| `GET` | `/health` | Return status, asset metadata, route contracts, and runtime requirements | JSON metadata and route contracts |
| `POST` | `/chat` | Run conversational chat and persist the transcript to D1 | `sessionId`, `reply`, `usage` |
| `POST` | `/analyze` | Convert a raw idea into a structured BranchOps asset plan | BranchOps planning schema |
| `GET` | `/admin/export/intake-leads` | Export captured lead records when admin export is configured | Bearer-token protected CSV |
| `GET` | `/admin/export/sync-queue` | Export lead sync queue records when admin export is configured | Bearer-token protected JSON |
| `POST` | `/admin/sync/airtable` | Manually sync queued lead records to Airtable | Bearer-token protected JSON summary |

The browser UI is an app-style BranchOps workspace with a desktop sidebar, mobile menu behavior, structured analyzer panel, separate chat lane, lead capture panel, admin export panel, and system health panel.

## Output Utility Layer

Generated BranchOps results can be reused as business assets through the browser output actions on the structured result panel:

- Copy Result
- Share Result, using Web Share when available and copy fallback otherwise
- Print / Save PDF through browser print
- Download TXT

`GET /output-utility` also serves a standalone formatter for pasted BranchOps JSON results. Both paths use the deterministic plain-text order documented in [BranchOps Output Format](docs/BRANCHOPS_OUTPUT_FORMAT.md). The utility does not add backend integrations, does not store results in third-party services, and redacts secret-like fields before export.

## UI Navigation

Sidebar sections:

- Dashboard
- New Intake
- Licensing Builder
- Automation Planner
- Digital Product Planner
- Content / Media Asset
- Grant / Workforce Program
- Real Estate System
- Brand / IP Asset
- Food / Product R&D
- Compliance Review
- Lead Capture
- Export / Admin
- System Health

Selecting a planner section updates the active analyzer mode and the mode description. The structured result area renders cards for the BranchOps schema fields after `/analyze` returns.

Planner panels include:

- mode-specific title and description
- recommended use case
- prompt helper bullets
- preselected `/analyze` mode

Operational panels show lead storage boundaries, CSV export requirements, Airtable sync queue metadata, route/capability health cards, and raw `/health` JSON for debugging.

## Workflow

`request -> validate -> process -> respond`

1. Client calls a single explicit route.
2. Worker enforces `content-type: application/json` on `POST` routes.
3. Worker rejects unsupported request fields.
4. Worker validates route-specific payload fields and limits.
5. Worker calls the Cloudflare `AI` binding.
6. Worker normalizes the model output into the public response contract.
7. Worker returns a structured success envelope or explicit error envelope.

## Request Contracts

### Chat

`POST /chat`

```json
{
  "sessionId": "optional non-empty string",
  "messages": [
    { "role": "user", "content": "How should this idea become an asset?" }
  ],
  "input": "optional fallback string",
  "instructions": "optional non-empty string",
  "max_tokens": 700,
  "temperature": 0.4
}
```

### Analyze

`POST /analyze`

```json
{
  "input": "required non-empty string",
  "mode": "optional intake menu value",
  "audience": "optional target audience",
  "urgency": "optional timing signal",
  "budget": "optional budget signal",
  "name": "optional lead name",
  "email": "optional lead email",
  "phone": "optional lead phone",
  "business_name": "optional business name",
  "location": "optional location",
  "preferred_contact": "optional contact preference",
  "instructions": "optional non-empty string",
  "max_tokens": 700
}
```

Validation rules:

- `content-type` must include `application/json`
- body must be a JSON object
- `/analyze` allows only `input`, `mode`, `audience`, `urgency`, `budget`, `name`, `email`, `phone`, `business_name`, `location`, `preferred_contact`, `instructions`, and `max_tokens`
- `input` is required and capped at `8000` characters
- `mode`, `audience`, `urgency`, and `budget` are capped at `200` characters each
- lead fields are optional and length-capped
- `email` must look like a valid email address when provided
- `phone` is lenient but capped at `40` characters
- `instructions` is capped at `2000` characters
- `max_tokens` must be an integer between `1` and `700`
- `/chat` also supports `sessionId`, `messages`, and `temperature`

Supported browser intake modes:

- General Business Asset
- Licensing / Royalty Model
- Automation Workflow
- Digital Product / App
- Content / Media Asset
- Grant / Workforce Program
- Real Estate / Property System
- Clothing / Brand / IP Asset
- Food / Infused Product R&D
- Compliance / Risk Review

## Response Contracts

### Health

`GET /health` returns:

- `request_id`
- `ok` and `status`
- service name
- asset ID
- owner
- version
- model
- route map
- request contracts
- runtime requirements
- safe Airtable sync metadata, including required variable names and route names only

### Analyze Success

```json
{
  "request_id": "uuid",
  "ok": true,
  "model": "@cf/openai/gpt-oss-120b",
  "data": {
    "objective": "string",
    "classification": "string",
    "asset": {},
    "execution_plan": ["string"],
    "systems": ["string"],
    "monetization_model": {},
    "automation_opportunities": ["string"],
    "legal_compliance_risks": ["string"],
    "scaling_path": ["string"],
    "long_term_value": "string"
  },
  "usage": {}
}
```

### Error Envelope

```json
{
  "request_id": "uuid",
  "ok": false,
  "error": "Descriptive failure message",
  "route": "/analyze"
}
```

`502` responses may also include `model` and `raw_text` when the model fails the contract.

Every JSON response includes `request_id`. `/chat` and `/analyze` use a safe default per-IP throttle of `30` requests per `60` seconds per route inside the active Worker isolate. A throttle response returns `429`, `request_id`, `retry_after_seconds`, and throttle metadata.

## Structured Event Logs

`/chat` and `/analyze` write best-effort D1 event rows to `intake_events`:

- `request_id`
- `route`
- `mode`
- `status`
- `timestamp`
- `token_usage`
- `error_code`
- `error_message`

The log intentionally does not store full prompt, chat, reply, or idea content by default.

## Lead Capture, Sync Queue, And Export

Optional lead fields on `/analyze` are stored in `intake_leads` only when at least one lead field is provided. The full private prompt is not stored in the lead table.

When an `intake_leads` insert succeeds, the Worker also creates a server-side `lead_sync_queue` row for Airtable:

- `request_id`
- `destination: airtable`
- `status: queued`
- `attempts: 0`

The queue table does not store full prompt content or Airtable secret values. If the queue insert fails, `/analyze` still returns the existing response contract and logs the failure server-side.

`GET /admin/export/intake-leads` returns a CSV export with:

- `request_id`
- `name`
- `email`
- `phone`
- `business_name`
- `location`
- `preferred_contact`
- `mode`
- `created_at`

Admin export is protected by `Authorization: Bearer <token>` when `ADMIN_EXPORT_TOKEN` is configured. If `ADMIN_EXPORT_TOKEN` is missing, the route returns `503` with a safe JSON message explaining that admin export is not configured. No secret is hardcoded in this repo.

`GET /admin/export/sync-queue` returns JSON queue records with the same bearer-token protection.

`POST /admin/sync/airtable` processes a modest batch of queued Airtable records. It reads lead data from `intake_leads` by `request_id`, posts to the Airtable REST API from the Worker runtime, and updates queue rows to `synced` or `error` with a safe `last_error`.

Successful sync responses include:

- `processed`
- `synced`
- `failed`
- `skipped`

No Airtable secret values are exposed in HTML, JSON responses, logs intended for clients, or browser storage.

## Airtable Sync Configuration

Required server variables:

- `ADMIN_EXPORT_TOKEN`
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE_NAME`

Configure them as Wrangler secrets:

```powershell
npx wrangler secret put ADMIN_EXPORT_TOKEN
npx wrangler secret put AIRTABLE_API_KEY
npx wrangler secret put AIRTABLE_BASE_ID
npx wrangler secret put AIRTABLE_TABLE_NAME
```

Apply the D1 schema locally or remotely as appropriate:

```powershell
npx wrangler d1 execute hello-ai-prod --file schema.sql --local
npx wrangler d1 execute hello-ai-prod --file schema.sql --remote
```

Admin route checks:

```powershell
curl.exe -H "Authorization: Bearer <ADMIN_EXPORT_TOKEN>" https://<worker-url>/admin/export/sync-queue
curl.exe -X POST -H "Authorization: Bearer <ADMIN_EXPORT_TOKEN>" https://<worker-url>/admin/sync/airtable
```

## Environment Requirements

Runtime bindings:

- `AI`
- `hello_ai_prod`

D1 schema:

- `chat_sessions`
- `chat_messages`
- `intake_events`
- `intake_leads`
- `lead_sync_queue`

Operator requirements:

- authenticated Wrangler session via `wrangler login`, or
- `CLOUDFLARE_API_TOKEN` in the shell environment

Worker config lives in `./wrangler.jsonc`.

## Local Development

```powershell
npm install
npm run dev
```

## Validation Commands

Run these from the repository root:

```powershell
npm install
npm run validate
npm run deploy:dry-run
git diff --stat
git status
```

Package scripts:

```powershell
npm run build
npm run test
npm run deploy:dry-run
npm run validate
npm run deploy
```

## Manual Endpoint Tests

Replace `<worker-url>` with the deployed Worker URL or a local `wrangler dev` URL:

```powershell
curl.exe https://<worker-url>/
curl.exe https://<worker-url>/health
curl.exe -X POST https://<worker-url>/chat -H "content-type: application/json" --data "{\"sessionId\":\"demo-session-001\",\"messages\":[{\"role\":\"user\",\"content\":\"How should this idea become an asset?\"}]}"
curl.exe -X POST https://<worker-url>/analyze -H "content-type: application/json" --data "{\"input\":\"Turn this founder idea into a structured BranchOps asset plan.\"}"
curl.exe -H "Authorization: Bearer <ADMIN_EXPORT_TOKEN>" https://<worker-url>/admin/export/sync-queue
curl.exe -X POST -H "Authorization: Bearer <ADMIN_EXPORT_TOKEN>" https://<worker-url>/admin/sync/airtable
```

## Boundary Rules

- Keep internal business logic, private operating records, and sensitive production credentials out of this repository.
- Treat this repo as a public-safe BranchOps intake surface.
- Do not let intake scope drift into the primary system-of-record lane.
- Keep Airtable API keys, base IDs, table names, and admin tokens server-side.
- Do not ask users to enter Airtable secrets in the browser.
- Do not store admin tokens or Airtable secrets in `localStorage`.

## System Of Record

- BranchOps AI Intake Worker: this repository
- Internal operating platform: `OffDaBranch/branchops-platform`
- Public product narrative: `OffDaBranch/branchops-public`
