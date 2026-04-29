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

The browser surface now presents the asset as an app-style BranchOps workspace with visible feature navigation, mode-specific planner panels, recommended use cases, prompt helpers, result cards, lead capture, export/admin status, and health visibility.

## Licensing Potential

The structured intake contract can become a licensable module for founder studios, operators, agencies, and business formation workflows that need repeatable idea-to-asset planning.

## Compliance Notes

- Keep requests public-safe and avoid sensitive personal, financial, legal, tax, health, or credential data.
- Treat generated plans as operational drafts requiring human review.
- Include attorney, tax, privacy, and compliance review before executing regulated recommendations.
- Do not hardcode secrets or private BranchOps operating records in this repository.
- Structured D1 logs should store request metadata, status, token usage, and error details only; do not store full idea, chat, or reply content by default.
- `intake_leads` may contain personal contact data when submitted voluntarily; export access must stay token-protected and the token must be stored as a Cloudflare secret.
- Basic per-IP throttling is an abuse-control guardrail, not a substitute for authenticated platform-level rate limits.

## Promotion Path Into BranchOps Platform

1. Prove the public-safe intake schema through this Worker.
2. Use `request_id` and `intake_events` to trace public-safe route behavior.
3. Use `intake_leads` CSV export as the temporary bridge into manual review.
4. Use the sidebar workspace as the public-safe preview of future BranchOps Platform navigation.
5. Add authenticated intake capture and review queues in the internal BranchOps Platform.
6. Promote qualified plans into asset records, task workflows, and owner dashboards.
7. Add reporting for conversion, revenue attribution, licensing candidates, and compliance review status.
