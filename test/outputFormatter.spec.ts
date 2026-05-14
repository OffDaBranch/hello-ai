import { describe, expect, it } from "vitest";
import { formatBranchOpsOutputText } from "../src/outputFormatter";

describe("BranchOps output formatter", () => {
	it("formats generated results in deterministic business-asset order", () => {
		const text = formatBranchOpsOutputText({
			requestId: "req_123",
			mode: "Automation Workflow",
			timestamp: "2026-05-14T15:30:00.000Z",
			result: {
				objective: "Launch an operator follow-up system.",
				classification: "Automation",
				asset: "Lead routing playbook",
				execution_plan: ["Capture leads", "Send follow-up"],
				systems: ["BranchOps intake worker"],
				monetization_model: { primary: "subscription" },
				automation_opportunities: ["Auto-classify requests"],
				legal_compliance_risks: ["Review consent copy"],
				scaling_path: ["Pilot locally", "Expand by vertical"],
				long_term_value: "Reusable lead conversion asset.",
			},
		});

		expect(text.split("\n\n").map((section) => section.split("\n")[0])).toEqual([
			"Request ID",
			"Mode",
			"Timestamp",
			"Objective",
			"Classification",
			"Asset",
			"Execution Plan",
			"Systems",
			"Monetization Model",
			"Automation Opportunities",
			"Legal / Compliance Risks",
			"Scaling Path",
			"Long-Term Value",
		]);
		expect(text).toContain("- Capture leads");
		expect(text).toContain("Primary: subscription");
	});

	it("maps legacy aliases without changing the analyze contract", () => {
		const text = formatBranchOpsOutputText({
			result: {
				request_id: "req_alias",
				mode: "General Business Asset",
				created_at: "2026-05-14T15:30:00.000Z",
				next_actions: ["Draft the first offer"],
				systems_and_prompts: ["Prompt library"],
				risks: ["Review claims"],
			},
		});

		expect(text).toContain("Request ID\nreq_alias");
		expect(text).toContain("Execution Plan\n- Draft the first offer");
		expect(text).toContain("Systems\n- Prompt library");
		expect(text).toContain("Legal / Compliance Risks\n- Review claims");
	});

	it("reads root metadata fields while formatting nested response data", () => {
		const text = formatBranchOpsOutputText({
			result: {
				request_id: "req_nested",
				mode: "Operator Intake",
				createdAt: "2026-05-14T16:00:00.000Z",
				data: {
					objective: "Turn the generated plan into a reusable asset.",
					classification: "Business Asset",
				},
			},
		});

		expect(text).toContain("Request ID\nreq_nested");
		expect(text).toContain("Mode\nOperator Intake");
		expect(text).toContain("Timestamp\n2026-05-14T16:00:00.000Z");
		expect(text).toContain(
			"Objective\nTurn the generated plan into a reusable asset.",
		);
		expect(text).toContain("Classification\nBusiness Asset");
	});

	it("keeps missing fields explicit in the export", () => {
		const text = formatBranchOpsOutputText({
			requestId: "req_missing",
			result: {
				objective: "Prepare a reusable export.",
			},
		});

		expect(text).toContain("Classification\nNot returned by backend.");
		expect(text).toContain("Long-Term Value\nNot returned by backend.");
	});

	it("redacts secret-like values from formatted exports", () => {
		const text = formatBranchOpsOutputText({
			requestId: "req_456",
			mode: "General Business Asset",
			result: {
				objective: "Prepare a safe export.",
				classification: "Compliance",
				monetization_model: {
					admin_token: "adm-secret-token",
					public_summary: "Membership revenue",
				},
				legal_compliance_risks: ["Never print OPENAI_API_KEY=sk-test-secret"],
			},
		});

		expect(text).toContain("[redacted sensitive value]");
		expect(text).toContain("Public Summary: Membership revenue");
		expect(text).not.toContain("adm-secret-token");
		expect(text).not.toContain("sk-test-secret");
	});
});
