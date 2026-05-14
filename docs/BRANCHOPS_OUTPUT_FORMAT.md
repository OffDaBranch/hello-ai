# BranchOps Output Format

BranchOps generated results are formatted as plain text in this deterministic order:

1. Request ID
2. Mode
3. Timestamp
4. Objective
5. Classification
6. Asset
7. Execution Plan
8. Systems
9. Monetization Model
10. Automation Opportunities
11. Legal / Compliance Risks
12. Scaling Path
13. Long-Term Value

The formatter accepts root response fields and nested `result`, `analysis`, or `data` response shapes. It also maps compatible aliases:

- `systems_and_prompts` -> Systems
- `next_actions` -> Execution Plan
- `risks` -> Legal / Compliance Risks
- `createdAt` or `created_at` -> Timestamp

Exports are plain text only. The output utility does not store results in a third-party service and does not add backend integrations. Secret-like nested fields and obvious credential-looking values are redacted before text export.
