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
	it("returns route instructions on GET /", async () => {
		const request = new IncomingRequest("http://example.com/");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			message:
				"Controlled intake worker. Use GET / for the contract map and POST / for normalized analysis.",
			route: "/",
			route_map: [
				{
					path: "/",
					method: "GET",
					purpose: "Inspect the runtime contract, limits, and required bindings.",
					response_fields: [
						"ok",
						"message",
						"route",
						"route_map",
						"request_contract",
						"runtime_requirements",
						"model",
					],
				},
				{
					path: "/",
					method: "POST",
					purpose:
						"Validate an intake payload, run the model, and return normalized analysis JSON.",
					request_body: {
						content_type: "application/json",
						required_fields: ["input"],
						optional_fields: ["instructions", "max_tokens"],
					},
					response_fields: [
						"objective",
						"classification",
						"monetization_model",
						"risks",
						"next_actions",
					],
				},
			],
			request_contract: {
				content_type: "application/json",
				required_fields: ["input"],
				optional_fields: ["instructions", "max_tokens"],
				limits: {
					input_max_chars: 8000,
					instructions_max_chars: 2000,
					max_tokens_default: 700,
					max_tokens_max: 700,
				},
			},
			runtime_requirements: {
				bindings: ["AI"],
				vars: [],
			},
			model: "@cf/openai/gpt-oss-120b",
		});
	});

	it("returns only parsed data and usage on successful POST", async () => {
		const request = new IncomingRequest("http://example.com/", {
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
		const request = new IncomingRequest("http://example.com/", {
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
		const request = new IncomingRequest("http://example.com/", {
			method: "PUT",
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(405);
		await expect(response.json()).resolves.toEqual({
			ok: false,
			error: "Method not allowed. Use GET or POST.",
			route: "/",
		});
	});

	it("returns 404 on unknown routes", async () => {
		const request = new IncomingRequest("http://example.com/unknown");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			ok: false,
			error: "Route not found.",
			route: "/unknown",
		});
	});

	it("rejects requests without application/json", async () => {
		const request = new IncomingRequest("http://example.com/", {
			method: "POST",
			headers: {
				"content-type": "text/plain",
			},
			body: "Analyze this startup",
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(415);
		await expect(response.json()).resolves.toEqual({
			ok: false,
			error: "Unsupported media type.",
			route: "/",
			expected_content_type: "application/json",
		});
	});

	it("rejects unsupported request fields", async () => {
		const request = new IncomingRequest("http://example.com/", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				input: "Analyze this startup",
				temperature: 0.2,
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			ok: false,
			error: "Unsupported request fields.",
			route: "/",
			unsupported_fields: ["temperature"],
		});
	});

	it("rejects max_tokens above the allowed limit", async () => {
		const request = new IncomingRequest("http://example.com/", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				input: "Analyze this startup",
				max_tokens: 701,
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			ok: false,
			error: "'max_tokens' must be between 1 and 700.",
			route: "/",
		});
	});

	it("returns 502 when the model emits non-JSON text", async () => {
		const request = new IncomingRequest("http://example.com/", {
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
			route: "/",
			model: "@cf/openai/gpt-oss-120b",
			raw_text: "not json",
		});
	});
});
