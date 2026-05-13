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

## BranchOps Agency Review Protocol

Primary agency: AI Platform / Cloudflare Worker Agency.

Every Codex task in this repo must route work through real departments, name the roles involved, perform review, and produce a handoff before the job is considered complete.

Every final Codex response must include:
1. Objective
2. Classification
3. Primary Agency
4. Departments / Roles Involved table
5. Work Completed
6. Files Changed
7. Validation Performed
8. Risks / Compliance Notes
9. Source-of-Truth Updates Needed
10. Executive Review Board Decision: APPROVE / REVISE / BLOCK / ESCALATE
11. Handoff
12. Next Executable Codex Prompt

No task is complete unless the Executive Review Board decision is included.

Every task must state whether Airtable, Notion, GitHub, Cloudflare, Stripe, Mailchimp, or another system needs an update.

Always name the specific departments and roles involved. Do not say only: the agency handled it.

See docs/BRANCHOPS_REPO_OPERATING_PACK.md for the full department roster, templates, handoff rules, and prompt library.
