# Hello AI

## Objective

Provide a Cloudflare-native AI prototype surface for:

- live browser chat
- route-based API experimentation
- hardened JSON-contract analysis

## Current Role

This repository is a public-safe prototype lane for Worker-based AI endpoints, not the canonical BranchOps internal control plane.

## Live Routes

- `GET /` — browser chat demo UI
- `GET /health` — health/status response
- `POST /chat` — conversational endpoint
- `POST /analyze` — structured JSON-contract endpoint

## Request Shapes

### Chat

```json
{
  "sessionId": "demo-session-001",
  "messages": [
    { "role": "user", "content": "What can this bot help with?" }
  ]
}
```

You can also send a single string with:

```json
{
  "input": "What can this bot help with?"
}
```

### Analyze

```json
{
  "input": "Turn this idea into a structured business asset."
}
```

## Local Development

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

After deploy, open the Worker root URL to use the built-in browser chat demo.

## Boundary Rules

- Keep internal business logic, private operating records, and sensitive production credentials out of this repository.
- Treat this repo as a public-safe prototype surface.
- Do not let prototype scope drift into the primary system-of-record lane.

## System of Record

- Prototype worker/API experimentation: this repository
- Internal operating platform: `OffDaBranch/branchops-platform`
- Public product narrative: `OffDaBranch/branchops-public`

## Next Hardening Steps

- add persistent memory with D1 or Durable Objects
- add rate limiting and abuse controls
- add prompt/version management
- add Airtable or webhook logging for qualified conversations
