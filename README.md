# hello-ai intake worker

Production-hardened Cloudflare Worker intake surface for normalized structured analysis.

## Route map

| Method | Path | Purpose | Success contract |
| --- | --- | --- | --- |
| `GET` | `/` | Inspect the runtime contract, limits, and required bindings | route map, request contract, runtime requirements, model |
| `POST` | `/` | Validate a request, run the model, and return normalized analysis JSON | `objective`, `classification`, `monetization_model`, `risks`, `next_actions` |

## Workflow

`request -> validate -> process -> respond`

1. Client sends `POST /` with `content-type: application/json`.
2. Worker rejects non-object payloads and unsupported fields.
3. Worker validates `input`, optional `instructions`, and optional `max_tokens`.
4. Worker calls the Cloudflare `AI` binding with the hardened prompt contract.
5. Worker normalizes model drift into the public response shape.
6. Worker returns a success envelope or an explicit error envelope.

## Request contract

`POST /` accepts only this JSON shape:

```json
{
  "input": "required non-empty string",
  "instructions": "optional non-empty string",
  "max_tokens": 700
}
```

Validation rules:

- `content-type` must include `application/json`
- request body must be a JSON object
- allowed fields are only `input`, `instructions`, and `max_tokens`
- `input` is required and capped at `8000` characters
- `instructions` is optional and capped at `2000` characters
- `max_tokens` is optional, must be an integer, and must be between `1` and `700`

## Response contract

Success envelope:

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

Error envelope:

```json
{
  "ok": false,
  "error": "Descriptive failure message",
  "route": "/"
}
```

`502` responses may also include `model` and `raw_text` when the model output fails the contract.

## Environment requirements

Runtime bindings:

- `AI`

Wrangler/operator requirements:

- authenticated Wrangler session via `wrangler login`, or
- `CLOUDFLARE_API_TOKEN` available in the shell environment

Worker config lives in `./wrangler.jsonc`.

## Validation commands

Run these from `C:\Users\embra\hello-ai\hello-ai`:

```powershell
git status --short --branch
git diff --stat
npm run build
npm run test
npx wrangler deploy --dry-run
```

Package scripts added in this repo:

```powershell
npm run build
npm run test
npm run deploy:dry-run
npm run validate
```

## Manual endpoint tests

Replace `<worker-url>` with the deployed Workers URL or a local `wrangler dev` URL:

```powershell
curl.exe https://<worker-url>/
curl.exe -X POST https://<worker-url>/ -H "content-type: application/json" --data "{\"input\":\"Analyze this inbound AI services lead and return the normalized intake contract.\"}"
```

## Reusable asset

This repo now serves as a reusable Cloudflare Worker intake template with:

- one explicit route map
- enforced request validation
- normalized AI response handling
- documented environment and validation commands
- explicit failure envelopes instead of silent failures
