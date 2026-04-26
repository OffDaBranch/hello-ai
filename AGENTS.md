# Cloudflare Workers Agent Instructions

## Owner

Branch Off Holdings

## Repo Purpose

`hello-ai` is a Cloudflare Workers AI demo and contract-hardening project. Keep this repo focused on Cloudflare Worker runtime behavior, Workers AI calls, route contracts, and safe validation.

## Cloudflare Docs Requirement

STOP. Your knowledge of Cloudflare Workers APIs and limits may be outdated. Always retrieve current documentation before any Workers, KV, R2, D1, Durable Objects, Queues, Vectorize, AI, or Agents SDK task.

## Docs

- https://developers.cloudflare.com/workers/
- MCP: `https://docs.mcp.cloudflare.com/mcp`

For all limits and quotas, retrieve from the product's `/platform/limits/` page. eg. `/workers/platform/limits`

## Commands

| Command | Purpose |
|---------|---------|
| `npx wrangler dev` | Local development |
| `npx wrangler deploy` | Deploy to Cloudflare |
| `npx wrangler types` | Generate TypeScript types |

Run `wrangler types` after changing bindings in `wrangler.jsonc`.

## Node.js Compatibility

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

## Errors

- **Error 1102** (CPU/Memory exceeded): Retrieve limits from `/workers/platform/limits/`
- **All errors**: https://developers.cloudflare.com/workers/observability/errors/

## Product Docs

Retrieve API references and limits from:

`/kv/` · `/r2/` · `/d1/` · `/durable-objects/` · `/queues/` · `/vectorize/` · `/workers-ai/` · `/agents/`

## Central AI Knowledge Routing

Use the BranchOps central AI knowledge system only for relevant patterns. Do not dump unrelated external repositories into this project.

Central registry:

```text
OffDaBranch/branchops-platform/registry/github-repo-registry.md
```

Central source policy:

```text
OffDaBranch/branchops-platform/docs/ai-source-policy.md
```

Codex control standard:

```text
OffDaBranch/branchops-platform/docs/codex-control-system.md
```

Relevant source categories for this repo:

- Cloudflare Workers
- Workers AI
- AI Gateway
- Cloudflare Agents
- OpenAI examples, only when directly relevant to API contracts or AI request handling

## Operating Rules

1. Inspect before editing.
2. Preserve the Cloudflare Worker runtime boundary.
3. Do not add unrelated app frameworks.
4. Do not expose secrets, tokens, API keys, or account IDs.
5. Do not copy external code without license review.
6. Make the smallest safe change.
7. Validate with available Wrangler or TypeScript commands before completion.

## Required Codex Output

```text
Files inspected:
Files changed:
Validation commands run:
Result:
Unresolved assumptions:
Recommended next step:
BranchOps asset note:
```
