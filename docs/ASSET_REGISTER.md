# Asset Register

| Field | Value |
| --- | --- |
| Asset ID | BOH-AI-INTAKE-001 |
| Asset Name | BranchOps AI Intake Worker |
| Owner Entity | Branch Off Holdings LLC |
| Runtime | Cloudflare Workers + Workers AI + D1 |
| Purpose | Convert raw founder/business ideas into structured BranchOps asset plans. |

## Revenue Model

The Worker supports intake for advisory, implementation, and licensing workflows. It can qualify raw ideas into paid planning engagements, productized implementation scopes, or recurring BranchOps platform opportunities.

The current intake modes cover business assets, royalty models, automation workflows, digital products/apps, content/media assets, grants/workforce programs, real estate/property systems, clothing/brand/IP assets, food or infused product R&D, and compliance/risk review.

Optional lead capture supports follow-up workflows when a submitter chooses to provide contact details. Captured lead records are export-ready through a bearer-token protected CSV route when `ADMIN_EXPORT_TOKEN` is configured.

The Airtable Lead Sync Queue adds a controlled CRM bridge: leads are stored in D1 first, queued server-side in `lead_sync_queue`, and manually synced to Airtable through an admin-token protected Worker route. This improves revenue operations by reducing manual CSV handoff while preserving the public-safe Worker boundary.

The browser surface now presents the asset as an app-style BranchOps workspace with visible feature navigation, mode-specific planner panels, recommended use cases, prompt helpers, result cards, lead capture, export/admin status, and health visibility.

## Licensing Potential

The structured intake contract can become a licensable module for founder studios, operators, agencies, and business formation workflows that need repeatable idea-to-asset planning.

## Asset Layers

| Layer | Value |
| --- | --- |
| BranchOps AI Intake Worker | Public-safe idea-to-asset intake and chat surface |
| D1 Event And Lead Store | Request metadata, voluntary lead fields, and export-ready operational records |
| Airtable Lead Sync Queue | Server-side queue for controlled CRM sync without exposing Airtable secrets to the browser |

## CRM And Revenue Value

The Airtable Lead Sync Queue supports follow-up speed, CRM hygiene, and revenue attribution. It lets operators move qualified inquiries from D1 into Airtable without asking browser users for admin tokens or Airtable credentials.

## Compliance Notes

- Keep requests public-safe and avoid sensitive personal, financial, legal, tax, health, or credential data.
- Treat generated plans as operational drafts requiring human review.
- Include attorney, tax, privacy, and compliance review before executing regulated recommendations.
- Do not hardcode secrets or private BranchOps operating records in this repository.
- Structured D1 logs should store request metadata, status, token usage, and error details only; do not store full idea, chat, or reply content by default.
- `intake_leads` may contain personal contact data when submitted voluntarily; export access must stay token-protected and the token must be stored as a Cloudflare secret.
- `lead_sync_queue` stores queue metadata only: request ID, destination, status, attempts, safe error text, and timestamps. It must not store full prompt content or Airtable secret values.
- Airtable API keys, base IDs, table names, and admin export tokens must stay in Worker environment secrets or equivalent server-side configuration.
- Browser UI must not request, display, persist, or transmit Airtable secrets. Do not store admin tokens or Airtable credentials in localStorage.
- Manual Airtable sync is protected by `ADMIN_EXPORT_TOKEN` and returns only safe summary metadata.
- Basic per-IP throttling is an abuse-control guardrail, not a substitute for authenticated platform-level rate limits.

## Promotion Path Into BranchOps Platform

1. Prove the public-safe intake schema through this Worker.
2. Use `request_id` and `intake_events` to trace public-safe route behavior.
3. Use `intake_leads` CSV export as the temporary bridge into manual review.
4. Use `lead_sync_queue` and the Airtable sync route as the controlled CRM bridge.
5. Use the sidebar workspace as the public-safe preview of future BranchOps Platform navigation.
6. Add authenticated intake capture and review queues in the internal BranchOps Platform.
7. Promote qualified plans into asset records, task workflows, and owner dashboards.
8. Add reporting for conversion, revenue attribution, licensing candidates, and compliance review status.
