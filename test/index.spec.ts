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

function createDbMock(throwOnBatch = false): MockDb {
	const statements: RecordedStatement[] = [];

	return {
		prepare(sql: string) {
			return {
				bind: (...params: unknown[]) =>
					({ sql, params }) as unknown as D1PreparedStatement,
			} as unknown as D1PreparedStatement;
		},
		batch: async (items: readonly D1PreparedStatement[]) => {
			if (throwOnBatch) {
				throw new Error("D1 write failed");
			}
			statements.push(...(items as unknown as RecordedStatement[]));
			return [] as unknown as D1Result[];
		},
		statements,
	} as unknown as MockDb;
}

function createEnv(
	response: Awaited<ReturnType<Env["AI"]["run"]>>,
	db: MockDb = createDbMock(),
	aiRequests: Record<string, unknown>[] = [],
): Env {
	return {
		AI: {
			run: async (_model, inputs) => {
				aiRequests.push(inputs);
				return response;
			},
		},
		hello_ai_prod: db,
	};
}

function expectRequestId(payload: { request_id?: unknown }): void {
	expect(payload.request_id).toEqual(expect.any(String));
}

describe("BranchOps AI Intake Worker", () => {
	it("returns the browser chat demo on GET /", async () => {
		const request = new IncomingRequest("http://example.com/");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		const html = await response.text();
		expect(html).toContain("<title>BranchOps AI Intake Worker</title>");
		expect(html).toContain("POST /chat");
		expect(html).toContain("General Business Asset");
		expect(html).toContain("Licensing / Royalty Model");
		expect(html).toContain("Automation Workflow");
		expect(html).toContain("Digital Product / App");
		expect(html).toContain("Content / Media Asset");
		expect(html).toContain("Grant / Workforce Program");
		expect(html).toContain("Real Estate / Property System");
		expect(html).toContain("Clothing / Brand / IP Asset");
		expect(html).toContain("Food / Infused Product R&amp;D");
		expect(html).toContain("Compliance / Risk Review");
	});

	it("returns an explicit route map on GET /health", async () => {
		const request = new IncomingRequest("http://example.com/health");
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: true,
			status: "ok",
			service: "BranchOps AI Intake Worker",
			asset_id: "BOH-AI-INTAKE-001",
			owner: "Branch Off Holdings LLC",
			version: "0.1.0",
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
		expect(payload.request_contracts.analyze.optional_fields).toEqual([
			"mode",
			"audience",
			"urgency",
			"budget",
			"instructions",
			"max_tokens",
		]);
		expect(payload.request_contracts.analyze.intake_modes).toContain(
			"Automation Workflow",
		);
		expect(payload.request_contracts.analyze.response_fields).toEqual([
			"objective",
			"classification",
			"asset",
			"execution_plan",
			"systems",
			"monetization_model",
			"automation_opportunities",
			"legal_compliance_risks",
			"scaling_path",
			"long_term_value",
		]);
		expect(payload.throttle).toMatchObject({
			routes: ["/chat", "/analyze"],
			limit: 30,
			window_seconds: 60,
		});
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
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
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
		expect(db.statements).toEqual(
			expect.arrayContaining([
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
			]),
		);
		const event = db.statements.find((statement) =>
			statement.sql.startsWith("INSERT INTO intake_events"),
		);
		expect(event?.params).toEqual([
			payload.request_id,
			"/chat",
			"chat",
			"success",
			expect.any(String),
			JSON.stringify({
				input_tokens: 12,
				output_tokens: 15,
				total_tokens: 27,
			}),
			null,
			null,
		]);
		expect(event?.params).not.toContain("What can this bot help with?");
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
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
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
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: false,
			error: "Missing 'messages' or 'input'.",
			route: "/chat",
		});
	});

	it("returns 429 with request_id when the throttle is exceeded", async () => {
		let response: Response | null = null;

		for (let index = 0; index < 31; index += 1) {
			const request = new IncomingRequest("http://example.com/chat", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					"cf-connecting-ip": "198.51.100.77",
				},
				body: JSON.stringify({}),
			});
			const ctx = createExecutionContext();
			response = await worker.fetch(request, createEnv({}), ctx);
			await waitOnExecutionContext(ctx);
		}

		expect(response?.status).toBe(429);
		const payload = await response!.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: false,
			error: "Rate limit exceeded.",
			route: "/chat",
			throttle: {
				limit: 30,
				window_seconds: 60,
			},
		});
		expect(payload.retry_after_seconds).toEqual(expect.any(Number));
	});

	it("accepts mode context and returns parsed data on successful POST /analyze", async () => {
		const db = createDbMock();
		const aiRequests: Record<string, unknown>[] = [];
		const request = new IncomingRequest("http://example.com/analyze", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				input: "Analyze this startup",
				mode: "Automation Workflow",
				audience: "solo founder",
				urgency: "same-day",
				budget: "lean",
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
									asset: {
										name: "Sales Velocity Intake System",
										id: "draft",
										owner: "Branch Off Holdings LLC",
									},
									execution_plan: ["Interview three ICP customers"],
									systems: ["D1 intake log"],
									monetization_model: { type: "subscription" },
									automation_opportunities: ["Auto-score qualified leads"],
									legal_compliance_risks: ["Review claims before launch"],
									scaling_path: ["Package as a repeatable SaaS module"],
									long_term_value: "Creates a reusable intake and qualification asset.",
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
			}, db, aiRequests),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: true,
			model: "@cf/openai/gpt-oss-120b",
			data: {
				objective: "Increase B2B sales velocity",
				classification: "SaaS",
				asset: {
					name: "Sales Velocity Intake System",
					id: "draft",
					owner: "Branch Off Holdings LLC",
				},
				execution_plan: ["Interview three ICP customers"],
				systems: ["D1 intake log"],
				monetization_model: { type: "subscription" },
				automation_opportunities: ["Auto-score qualified leads"],
				legal_compliance_risks: ["Review claims before launch"],
				scaling_path: ["Package as a repeatable SaaS module"],
				long_term_value: "Creates a reusable intake and qualification asset.",
			},
			usage: {
				input_tokens: 101,
				output_tokens: 733,
				total_tokens: 834,
			},
		});
		expect(aiRequests[0].input).toContain("Mode: Automation Workflow");
		expect(aiRequests[0].input).toContain("Audience: solo founder");
		expect(aiRequests[0].input).toContain("Urgency: same-day");
		expect(aiRequests[0].input).toContain("Budget: lean");
		const event = db.statements.find((statement) =>
			statement.sql.startsWith("INSERT INTO intake_events"),
		);
		expect(event?.params).toEqual([
			payload.request_id,
			"/analyze",
			"Automation Workflow",
			"success",
			expect.any(String),
			JSON.stringify({
				input_tokens: 101,
				output_tokens: 733,
				total_tokens: 834,
			}),
			null,
			null,
		]);
		expect(event?.params).not.toContain("Analyze this startup");
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
									asset: {
										name: "Workforce Training System",
										asset_type: "Licensable operating system",
									},
									execution_plan: {
										validate: "Validate the first buyer segment",
										build: "Draft the pilot curriculum",
									},
									systems: {
										database: "D1 intake records",
										workflow: "Review queue",
									},
									monetization_model: {
										type: "subscription",
									},
									automation_opportunities: {
										intake: "Generate draft scopes from qualified submissions",
									},
									legal_compliance_risks: {
										regulatory_compliance:
											"Training content may require certification review",
										data_privacy:
											"Employee performance data creates privacy obligations",
									},
									scaling_path: ["Pilot", "Template", "License"],
									long_term_value:
										"Turns repeatable training delivery into a licensable asset.",
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
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: true,
			model: "@cf/openai/gpt-oss-120b",
			data: {
				objective: "Launch a licensable workforce training system",
				classification: "HR Technology | SaaS | Workforce compliance",
				asset: {
					name: "Workforce Training System",
					asset_type: "Licensable operating system",
				},
				execution_plan: [
					"Validate: Validate the first buyer segment",
					"Build: Draft the pilot curriculum",
				],
				systems: ["Database: D1 intake records", "Workflow: Review queue"],
				monetization_model: {
					type: "subscription",
				},
				automation_opportunities: [
					"Intake: Generate draft scopes from qualified submissions",
				],
				legal_compliance_risks: [
					"Regulatory Compliance: Training content may require certification review",
					"Data Privacy: Employee performance data creates privacy obligations",
				],
				scaling_path: ["Pilot", "Template", "License"],
				long_term_value:
					"Turns repeatable training delivery into a licensable asset.",
			},
			usage: {
				input_tokens: 120,
				output_tokens: 480,
				total_tokens: 600,
			},
		});
	});

	it("keeps analyze behavior working when event logging fails", async () => {
		const request = new IncomingRequest("http://example.com/analyze", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"cf-connecting-ip": "198.51.100.88",
			},
			body: JSON.stringify({
				input: "Analyze this startup",
				mode: "Licensing / Royalty Model",
			}),
		});
		const ctx = createExecutionContext();
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
									text: JSON.stringify({
										objective: "Package a royalty-backed asset",
										classification: "Licensing",
										asset: {
											name: "Royalty Asset Intake",
										},
										execution_plan: ["Define the licensable unit"],
										systems: ["D1 intake log"],
										monetization_model: { type: "royalty" },
										automation_opportunities: ["Draft license intake summary"],
										legal_compliance_risks: ["Attorney review required"],
										scaling_path: ["Template the license package"],
										long_term_value:
											"Creates a repeatable licensing evaluation workflow.",
									}),
								},
							],
						},
					],
				},
				createDbMock(true),
			),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: true,
			model: "@cf/openai/gpt-oss-120b",
			data: {
				classification: "Licensing",
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
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
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
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
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
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
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
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
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
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: false,
			error: "Model returned non-JSON text.",
			route: "/analyze",
			model: "@cf/openai/gpt-oss-120b",
			raw_text: "not json",
		});
	});
});
