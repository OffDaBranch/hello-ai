# Hello AI

## Objective

Provide a Cloudflare-native AI prototype surface for:

- live browser chat
- route-based API experimentation
- hardened JSON-contract analysis

## Current Role

This repository is a public-safe prototype lane for Worker-based AI endpoints, not the canonical BranchOps internal control plane.

## Route Map

| Method | Path | Purpose | Contract |
| --- | --- | --- | --- |
| `GET` | `/` | Serve the browser chat demo UI | HTML demo surface |
| `GET` | `/health` | Return the explicit route map, request contracts, and runtime requirements | JSON metadata and route contracts |
| `POST` | `/chat` | Run conversational chat and persist the transcript to D1 | `sessionId`, `reply`, `usage` |
| `POST` | `/analyze` | Run structured JSON-contract intake analysis | `objective`, `classification`, `monetization_model`, `risks`, `next_actions` |

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
    { "role": "user", "content": "What can this bot help with?" }
  ],
  "input": "optional fallback string",
  "instructions": "optional non-empty string",
  "max_tokens": 700,
  "temperature": 0.4
}
```

Validation rules:

- `content-type` must include `application/json`
- body must be a JSON object
- allowed fields are `sessionId`, `messages`, `input`, `instructions`, `max_tokens`, and `temperature`
- request must include at least one valid `messages` entry or a fallback `input`
- `input` is capped at `8000` characters when provided
- `instructions` is capped at `2000` characters
- `max_tokens` must be an integer between `1` and `700`
- `temperature` must be a number between `0` and `2`

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
- allowed fields are `input`, `instructions`, and `max_tokens`
- `input` is required and capped at `8000` characters
- `instructions` is capped at `2000` characters
- `max_tokens` must be an integer between `1` and `700`

## Response Contracts

### Chat success

```json
{
  "ok": true,
  "sessionId": "string",
  "model": "@cf/openai/gpt-oss-120b",
  "reply": "string",
  "usage": {}
}
```

### Analyze success

```json
{
  "ok": true,
  "model": "@cf/openai/gpt-oss-120b",
  "data": {
    "objective": "string",
    "classification": "string",
    "monetization_model": {},
    "risks": ["string"],
    "next_actions": ["string"]
  },
  "usage": {}
}
```

### Error envelope

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

Run these from `C:\Users\embra\hello-ai\hello-ai`:

```powershell
git status --short --branch
git diff --stat
npm run build
npm run test
npx wrangler deploy --dry-run
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
curl.exe -X POST https://<worker-url>/chat -H "content-type: application/json" --data "{\"sessionId\":\"demo-session-001\",\"messages\":[{\"role\":\"user\",\"content\":\"What can this bot help with?\"}]}"
curl.exe -X POST https://<worker-url>/analyze -H "content-type: application/json" --data "{\"input\":\"Turn this idea into a structured business asset.\"}"
```

## Boundary Rules

- Keep internal business logic, private operating records, and sensitive production credentials out of this repository.
- Treat this repo as a public-safe prototype surface.
- Do not let prototype scope drift into the primary system-of-record lane.

## System Of Record

- Prototype worker/API experimentation: this repository
- Internal operating platform: `OffDaBranch/branchops-platform`
- Public product narrative: `OffDaBranch/branchops-public`

## Next Hardening Steps

- add rate limiting and abuse controls
- add prompt/version management
- add Airtable or webhook logging for qualified conversations
- add live deploy verification for route contracts after merge
