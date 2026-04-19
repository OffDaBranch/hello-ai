import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker, { type Env } from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

type RecordedStatement = {
	sql: string;
	params: unknown[];
};

type MockDb = D1Database & {
	statements: RecordedStatement[];
};

function createDbMock(): MockDb {
	const statements: RecordedStatement[] = [];

	return {
		prepare(sql: string) {
			return {
				bind: (...params: unknown[]) =>
					({ sql, params }) as unknown as D1PreparedStatement,
			} as unknown as D1PreparedStatement;
		},
		batch: async (items: readonly D1PreparedStatement[]) => {
			statements.push(...(items as unknown as RecordedStatement[]));
			return [] as unknown as D1Result[];
		},
		statements,
	} as unknown as MockDb;
}

function createEnv(
	response: Awaited<ReturnType<Env["AI"]["run"]>>,
	db: MockDb = createDbMock(),
): Env {
	return {
		AI: {
			run: async () => response,
		},
		hello_ai_prod: db,
	};
}

describe("hello-ai worker", () => {
	it("returns the browser chat demo on GET /", async () => {
		const request = new IncomingRequest("http://example.com/");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		const html = await response.text();
		expect(html).toContain("<title>Hello AI</title>");
		expect(html).toContain("POST /chat");
	});

	it("returns an explicit route map on GET /health", async () => {
		const request = new IncomingRequest("http://example.com/health");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload).toMatchObject({
			ok: true,
			service: "hello-ai",
			model: "@cf/openai/gpt-oss-120b",
			routes: {
				root: "GET /",
				health: "GET /health",
				chat: "POST /chat",
				analyze: "POST /analyze",
			},
			runtime_requirements: {
				bindings: ["AI", "hello_ai_prod"],
				vars: [],
			},
		});
		expect(payload.route_map).toHaveLength(4);
		expect(payload.request_contracts.chat.content_type).toBe("application/json");
		expect(payload.request_contracts.analyze.response_fields).toEqual([
			"objective",
			"classification",
			"monetization_model",
			"risks",
			"next_actions",
		]);
	});

	it("returns a conversational response on POST /chat and persists it", async () => {
		const request = new IncomingRequest("http://example.com/chat", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				sessionId: "session-123",
				messages: [{ role: "user", content: "What can this bot help with?" }],
			}),
		});
		const ctx = createExecutionContext();
		const db = createDbMock();
		const response = await worker.fetch(
			request,
			createEnv(
				{
					output: [
						{
							type: "message",
							content: [
								{
									type: "output_text",
									text: "It can answer questions and help structure ideas.",
								},
							],
						},
					],
					usage: {
						input_tokens: 12,
						output_tokens: 15,
						total_tokens: 27,
					},
				},
				db,
			),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			sessionId: "session-123",
			model: "@cf/openai/gpt-oss-120b",
			reply: "It can answer questions and help structure ideas.",
			usage: {
				input_tokens: 12,
				output_tokens: 15,
				total_tokens: 27,
			},
		});
		expect(db.statements).toEqual([
			{
				sql: "INSERT OR IGNORE INTO chat_sessions (session_id) VALUES (?)",
				params: ["session-123"],
			},
			{
				sql: "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
				params: ["session-123", "user", "What can this bot help with?"],
			},
			{
				sql: "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
				params: [
					"session-123",
					"assistant",
					"It can answer questions and help structure ideas.",
				],
			},
		]);
	});

	it("rejects chat requests without application/json", async () => {
		const request = new IncomingRequest("http://example.com/chat", {
			method: "POST",
			headers: {
				"content-type": "text/plain",
			},
			body: "hello",
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(415);
		await expect(response.json()).resolves.toEqual({
			ok: false,
			error: "Unsupported media type.",
			route: "/chat",
			expected_content_type: "application/json",
		});
	});

	it("returns 400 when chat input is missing", async () => {
		const request = new IncomingRequest("http://example.com/chat", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			ok: false,
			error: "Missing 'messages' or 'input'.",
			route: "/chat",
		});
	});

	it("returns only parsed data and usage on successful POST /analyze", async () => {
		const request = new IncomingRequest("http://example.com/analyze", {
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
		const request = new IncomingRequest("http://example.com/analyze", {
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
										regulatory_compliance:
											"Training content may require certification review",
										data_privacy:
											"Employee performance data creates privacy obligations",
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

	it("rejects analyze requests without application/json", async () => {
		const request = new IncomingRequest("http://example.com/analyze", {
			method: "POST",
			headers: {
				"content-type": "text/plain",
			},
			body: "analyze this",
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(415);
		await expect(response.json()).resolves.toEqual({
			ok: false,
			error: "Unsupported media type.",
			route: "/analyze",
			expected_content_type: "application/json",
		});
	});

	it("rejects unsupported analyze request fields", async () => {
		const request = new IncomingRequest("http://example.com/analyze", {
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
			route: "/analyze",
			unsupported_fields: ["temperature"],
		});
	});

	it("rejects analyze max_tokens above the allowed limit", async () => {
		const request = new IncomingRequest("http://example.com/analyze", {
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
			route: "/analyze",
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
			error: "Not found.",
			available_routes: [
				"GET /",
				"GET /health",
				"POST /chat",
				"POST /analyze",
			],
		});
	});

	it("returns 502 when analyze emits non-JSON text", async () => {
		const request = new IncomingRequest("http://example.com/analyze", {
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
			route: "/analyze",
			model: "@cf/openai/gpt-oss-120b",
			raw_text: "not json",
		});
	});
});
