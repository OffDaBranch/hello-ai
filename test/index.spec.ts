import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker, { type Env } from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

function createEnv(response: Awaited<ReturnType<Env["AI"]["run"]>>): Env {
	return {
		AI: {
			run: async () => response,
		},
	};
}

describe("hello-ai worker", () => {
	it("returns route instructions on GET", async () => {
		const request = new IncomingRequest("http://example.com");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			message: 'Send a POST request with JSON like { "input": "your prompt" }',
			route: "/",
			model: "@cf/openai/gpt-oss-120b",
		});
	});

	it("returns only parsed data and usage on successful POST", async () => {
		const request = new IncomingRequest("http://example.com", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				input: "Analyze this startup",
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			createEnv({
				output: [
					{ type: "reasoning" },
					{
						type: "message",
						content: [
							{
								type: "output_text",
								text: JSON.stringify({
									objective: "Increase B2B sales velocity",
									classification: "SaaS",
									monetization_model: { type: "subscription" },
									risks: ["Long enterprise sales cycle"],
									next_actions: ["Interview three ICP customers"],
								}),
							},
						],
					},
				],
				usage: {
					input_tokens: 101,
					output_tokens: 733,
					total_tokens: 834,
				},
			}),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			model: "@cf/openai/gpt-oss-120b",
			data: {
				objective: "Increase B2B sales velocity",
				classification: "SaaS",
				monetization_model: { type: "subscription" },
				risks: ["Long enterprise sales cycle"],
				next_actions: ["Interview three ICP customers"],
			},
			usage: {
				input_tokens: 101,
				output_tokens: 733,
				total_tokens: 834,
			},
		});
	});

	it("normalizes common model drift into the public contract", async () => {
		const request = new IncomingRequest("http://example.com", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				input: "Analyze this startup",
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			createEnv({
				output: [
					{
						type: "message",
						content: [
							{
								type: "output_text",
								text: JSON.stringify({
									objective: "Launch a licensable workforce training system",
									classification: {
										industry: "HR Technology",
										product_type: "SaaS",
										regulatory_category: "Workforce compliance",
									},
									monetization_model: {
										type: "subscription",
									},
									risks: {
										regulatory_compliance: "Training content may require certification review",
										data_privacy: "Employee performance data creates privacy obligations",
									},
									next_actions: [
										"Validate the first buyer segment",
										"Draft the pilot curriculum",
									],
								}),
							},
						],
					},
				],
				usage: {
					input_tokens: 120,
					output_tokens: 480,
					total_tokens: 600,
				},
			}),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			model: "@cf/openai/gpt-oss-120b",
			data: {
				objective: "Launch a licensable workforce training system",
				classification: "HR Technology | SaaS | Workforce compliance",
				monetization_model: {
					type: "subscription",
				},
				risks: [
					"Regulatory Compliance: Training content may require certification review",
					"Data Privacy: Employee performance data creates privacy obligations",
				],
				next_actions: [
					"Validate the first buyer segment",
					"Draft the pilot curriculum",
				],
			},
			usage: {
				input_tokens: 120,
				output_tokens: 480,
				total_tokens: 600,
			},
		});
	});

	it("rejects unsupported methods", async () => {
		const request = new IncomingRequest("http://example.com", {
			method: "PUT",
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(405);
		await expect(response.json()).resolves.toEqual({
			ok: false,
			error: "Method not allowed. Use POST.",
		});
	});

	it("returns 502 when the model emits non-JSON text", async () => {
		const request = new IncomingRequest("http://example.com", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				input: "Analyze this startup",
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			createEnv({
				output: [
					{
						type: "message",
						content: [
							{
								type: "output_text",
								text: "not json",
							},
						],
					},
				],
			}),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toEqual({
			ok: false,
			error: "Model returned non-JSON text.",
			model: "@cf/openai/gpt-oss-120b",
			raw_text: "not json",
		});
	});
});
