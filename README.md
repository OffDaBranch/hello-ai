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

## Route Map

| Method | Path | Purpose | Contract |
| --- | --- | --- | --- |
| `GET` | `/` | Serve the browser intake/chat demo UI | HTML demo surface |
| `GET` | `/health` | Return status, asset metadata, route contracts, and runtime requirements | JSON metadata and route contracts |
| `POST` | `/chat` | Run conversational chat and persist the transcript to D1 | `sessionId`, `reply`, `usage` |
| `POST` | `/analyze` | Convert a raw idea into a structured BranchOps asset plan | BranchOps planning schema |

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
  "instructions": "optional non-empty string",
  "max_tokens": 700
}
```

Validation rules:

- `content-type` must include `application/json`
- body must be a JSON object
- `/analyze` allows only `input`, `instructions`, and `max_tokens`
- `input` is required and capped at `8000` characters
- `instructions` is capped at `2000` characters
- `max_tokens` must be an integer between `1` and `700`
- `/chat` also supports `sessionId`, `messages`, and `temperature`

## Response Contracts

### Health

`GET /health` returns:

- `ok` and `status`
- service name
- asset ID
- owner
- version
- model
- route map
- request contracts
- runtime requirements

### Analyze Success

```json
{
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
  "ok": false,
  "error": "Descriptive failure message",
  "route": "/analyze"
}
```

`502` responses may also include `model` and `raw_text` when the model fails the contract.

## Environment Requirements

Runtime bindings:

- `AI`
- `hello_ai_prod`

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
```

## Boundary Rules

- Keep internal business logic, private operating records, and sensitive production credentials out of this repository.
- Treat this repo as a public-safe BranchOps intake surface.
- Do not let intake scope drift into the primary system-of-record lane.

## System Of Record

- BranchOps AI Intake Worker: this repository
- Internal operating platform: `OffDaBranch/branchops-platform`
- Public product narrative: `OffDaBranch/branchops-public`
