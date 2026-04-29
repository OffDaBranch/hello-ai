import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { type Env } from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

type RecordedStatement = {
	sql: string;
	params: unknown[];
};

type MockDb = D1Database & {
	statements: RecordedStatement[];
};

type DbMockOptions = {
	throwOnBatch?: boolean;
	throwOnAll?: boolean;
	leadRows?: Record<string, unknown>[];
	queueRows?: Record<string, unknown>[];
	syncRows?: Record<string, unknown>[];
};

function createDbMock(options: boolean | DbMockOptions = false): MockDb {
	const config: DbMockOptions =
		typeof options === "boolean" ? { throwOnBatch: options } : options;
	const statements: RecordedStatement[] = [];

	const statement = (
		sql: string,
		params: unknown[] = [],
	): D1PreparedStatement & RecordedStatement => {
		return {
			sql,
			params,
			bind: (...boundParams: unknown[]) => statement(sql, boundParams),
			all: async () => {
					if (config.throwOnAll) {
						throw new Error("D1 read failed");
					}
					if (sql.includes("FROM lead_sync_queue q")) {
						return {
							results: config.syncRows ?? [],
							success: true,
							meta: {},
						};
					}
					if (sql.includes("FROM lead_sync_queue")) {
						return {
							results: config.queueRows ?? [],
							success: true,
							meta: {},
						};
					}
					return {
						results: config.leadRows ?? [],
						success: true,
						meta: {},
					};
				},
		} as unknown as D1PreparedStatement & RecordedStatement;
	};

	return {
		prepare(sql: string) {
			return statement(sql);
		},
		batch: async (items: readonly D1PreparedStatement[]) => {
			if (config.throwOnBatch) {
				throw new Error("D1 write failed");
			}
			statements.push(
				...(items as unknown as RecordedStatement[]).map((item) => ({
					sql: item.sql,
					params: item.params,
				})),
			);
			return [] as unknown as D1Result[];
		},
		statements,
	} as unknown as MockDb;
}

function createEnv(
	response: Awaited<ReturnType<Env["AI"]["run"]>>,
	db: MockDb = createDbMock(),
	aiRequests: Record<string, unknown>[] = [],
	overrides: Partial<Env> = {},
): Env {
	return {
		AI: {
			run: async (_model, inputs) => {
				aiRequests.push(inputs);
				return response;
			},
		},
		hello_ai_prod: db,
		...overrides,
	};
}

function expectRequestId(payload: { request_id?: unknown }): void {
	expect(payload.request_id).toEqual(expect.any(String));
}

describe("BranchOps AI Intake Worker", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

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
		expect(html).toContain("Dashboard");
		expect(html).toContain("New Intake");
		expect(html).toContain("Licensing Builder");
		expect(html).toContain("Automation Planner");
		expect(html).toContain("Lead Capture");
		expect(html).toContain("Export / Admin");
		expect(html).toContain("System Health");
		expect(html).toContain("General Business Asset");
		expect(html).toContain("Licensing / Royalty Model");
		expect(html).toContain("Automation Workflow");
		expect(html).toContain("Digital Product / App");
		expect(html).toContain("Content / Media Asset");
		expect(html).toContain("Grant / Workforce Program");
		expect(html).toContain("Real Estate System");
		expect(html).toContain("Brand / IP Asset");
		expect(html).toContain("Food / Infused Product R&amp;D");
		expect(html).toContain("Compliance / Risk Review");
		expect(html).toContain("Optional contact info for follow-up");
		expect(html).toContain("Business name");
		expect(html).toContain("Preferred contact");
		expect(html).toContain("Analyze intake");
		expect(html).toContain("Structured results");
		expect(html).toContain("Request ID");
		expect(html).toContain("Throttle Limit");
		expect(html).toContain("D1 Logging");
		expect(html).toContain("CSV fields");
		expect(html).toContain("ADMIN_EXPORT_TOKEN");
		expect(html).toContain("Airtable Sync Queue");
		expect(html).toContain("GET /admin/export/sync-queue");
		expect(html).toContain("POST /admin/sync/airtable");
		expect(html).toContain("AIRTABLE_API_KEY");
		expect(html).toContain("AIRTABLE_BASE_ID");
		expect(html).toContain("AIRTABLE_TABLE_NAME");
		expect(html).toContain("Recommended use case");
		expect(html).toContain("Prompt helper bullets");
		expect(html).toContain("Raw /health JSON");
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
				admin_export_intake_leads: "GET /admin/export/intake-leads",
				admin_export_sync_queue: "GET /admin/export/sync-queue",
				admin_sync_airtable: "POST /admin/sync/airtable",
			},
			runtime_requirements: {
				bindings: ["AI", "hello_ai_prod"],
				vars: [
					"ADMIN_EXPORT_TOKEN optional for admin export",
					"AIRTABLE_API_KEY optional for Airtable sync",
					"AIRTABLE_BASE_ID optional for Airtable sync",
					"AIRTABLE_TABLE_NAME optional for Airtable sync",
				],
			},
		});
		expect(payload.route_map).toHaveLength(7);
		expect(payload.request_contracts.chat.content_type).toBe("application/json");
		expect(payload.request_contracts.analyze.optional_fields).toEqual([
			"mode",
			"audience",
			"urgency",
			"budget",
			"name",
			"email",
			"phone",
			"business_name",
			"location",
			"preferred_contact",
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
		expect(payload.lead_capture).toMatchObject({
			enabled: true,
			fields: [
				"name",
				"email",
				"phone",
				"business_name",
				"location",
				"preferred_contact",
			],
			stores_full_prompt: false,
		});
		expect(payload.admin_export).toMatchObject({
			route: "/admin/export/intake-leads",
			configured: false,
			content_type: "text/csv",
		});
		expect(payload.airtable_sync).toMatchObject({
			enabled: true,
			configured: false,
			required_vars: [
				"AIRTABLE_API_KEY",
				"AIRTABLE_BASE_ID",
				"AIRTABLE_TABLE_NAME",
			],
			routes: {
				queue_export: "GET /admin/export/sync-queue",
				manual_sync: "POST /admin/sync/airtable",
			},
			destination: "airtable",
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
				name: "Avery Founder",
				email: "avery@example.com",
				phone: "+1 555 0100",
				business_name: "Avery Ops LLC",
				location: "Detroit, MI",
				preferred_contact: "email",
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
		expect(aiRequests[0].input).not.toContain("avery@example.com");
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
		const lead = db.statements.find((statement) =>
			statement.sql.startsWith("INSERT INTO intake_leads"),
		);
		expect(lead?.params).toEqual([
			payload.request_id,
			"Avery Founder",
			"avery@example.com",
			"+1 555 0100",
			"Avery Ops LLC",
			"Detroit, MI",
			"email",
			"Automation Workflow",
		]);
		expect(lead?.params).not.toContain("Analyze this startup");
		const syncQueue = db.statements.find((statement) =>
			statement.sql.startsWith("INSERT INTO lead_sync_queue"),
		);
		expect(syncQueue?.params).toEqual([
			payload.request_id,
			"airtable",
			"queued",
			0,
		]);
		expect(syncQueue?.params).not.toContain("Analyze this startup");
	});

	it("rejects invalid analyze lead email", async () => {
		const request = new IncomingRequest("http://example.com/analyze", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				input: "Analyze this startup",
				email: "not-an-email",
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
			error: "'email' must be a valid email address when provided.",
			route: "/analyze",
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

	it("keeps analyze behavior working when lead persistence fails", async () => {
		const request = new IncomingRequest("http://example.com/analyze", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"cf-connecting-ip": "198.51.100.88",
			},
			body: JSON.stringify({
				input: "Analyze this startup",
				mode: "Licensing / Royalty Model",
				name: "Jordan Founder",
				email: "jordan@example.com",
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

	it("returns 503 for admin lead export when token is not configured", async () => {
		const request = new IncomingRequest(
			"http://example.com/admin/export/intake-leads",
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(503);
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: false,
			error: "Admin export is not configured.",
			route: "/admin/export/intake-leads",
			required_env_var: "ADMIN_EXPORT_TOKEN",
		});
	});

	it("requires bearer token for configured admin lead export", async () => {
		const request = new IncomingRequest(
			"http://example.com/admin/export/intake-leads",
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			createEnv({}, createDbMock(), [], { ADMIN_EXPORT_TOKEN: "secret-token" }),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(401);
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: false,
			error: "Unauthorized.",
			route: "/admin/export/intake-leads",
		});
	});

	it("exports intake leads as CSV when bearer token is valid", async () => {
		const request = new IncomingRequest(
			"http://example.com/admin/export/intake-leads",
			{
				headers: {
					authorization: "Bearer secret-token",
				},
			},
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			createEnv(
				{},
				createDbMock({
					leadRows: [
						{
							request_id: "req-123",
							name: "Avery Founder",
							email: "avery@example.com",
							phone: "+1 555 0100",
							business_name: "Avery Ops LLC",
							location: "Detroit, MI",
							preferred_contact: "email",
							mode: "Automation Workflow",
							created_at: "2026-04-29T00:00:00.000Z",
						},
					],
				}),
				[],
				{ ADMIN_EXPORT_TOKEN: "secret-token" },
			),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/csv");
		expect(response.headers.get("x-request-id")).toEqual(expect.any(String));
		const csv = await response.text();
		expect(csv).toContain(
			"request_id,name,email,phone,business_name,location,preferred_contact,mode,created_at",
		);
		expect(csv).toContain('"req-123","Avery Founder","avery@example.com"');
	});

	it("returns 503 for sync queue export when token is not configured", async () => {
		const request = new IncomingRequest(
			"http://example.com/admin/export/sync-queue",
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, createEnv({}), ctx);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(503);
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: false,
			error: "Admin export is not configured.",
			route: "/admin/export/sync-queue",
			required_env_var: "ADMIN_EXPORT_TOKEN",
		});
	});

	it("requires bearer token for configured sync queue export", async () => {
		const request = new IncomingRequest(
			"http://example.com/admin/export/sync-queue",
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			createEnv({}, createDbMock(), [], { ADMIN_EXPORT_TOKEN: "secret-token" }),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(401);
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: false,
			error: "Unauthorized.",
			route: "/admin/export/sync-queue",
		});
	});

	it("exports sync queue records as JSON when bearer token is valid", async () => {
		const request = new IncomingRequest(
			"http://example.com/admin/export/sync-queue",
			{
				headers: {
					authorization: "Bearer secret-token",
				},
			},
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			createEnv(
				{},
				createDbMock({
					queueRows: [
						{
							id: 1,
							request_id: "req-123",
							destination: "airtable",
							status: "queued",
							attempts: 0,
							last_error: null,
							created_at: "2026-04-29T00:00:00.000Z",
							updated_at: "2026-04-29T00:00:00.000Z",
						},
					],
				}),
				[],
				{ ADMIN_EXPORT_TOKEN: "secret-token" },
			),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: true,
			data: {
				records: [
					{
						id: 1,
						request_id: "req-123",
						destination: "airtable",
						status: "queued",
						attempts: 0,
						last_error: null,
					},
				],
			},
		});
		expect(JSON.stringify(payload)).not.toContain("secret-token");
	});

	it("requires bearer token for configured Airtable sync", async () => {
		const request = new IncomingRequest("http://example.com/admin/sync/airtable", {
			method: "POST",
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			createEnv({}, createDbMock(), [], { ADMIN_EXPORT_TOKEN: "secret-token" }),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(401);
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: false,
			error: "Unauthorized.",
			route: "/admin/sync/airtable",
		});
	});

	it("returns 503 for Airtable sync when Airtable vars are missing", async () => {
		const request = new IncomingRequest("http://example.com/admin/sync/airtable", {
			method: "POST",
			headers: {
				authorization: "Bearer secret-token",
			},
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			createEnv({}, createDbMock(), [], { ADMIN_EXPORT_TOKEN: "secret-token" }),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(503);
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: false,
			error: "Airtable sync is not configured.",
			route: "/admin/sync/airtable",
			required_env_vars: [
				"AIRTABLE_API_KEY",
				"AIRTABLE_BASE_ID",
				"AIRTABLE_TABLE_NAME",
			],
		});
	});

	it("syncs queued leads to Airtable and marks queue rows synced", async () => {
		const airtableFetch = vi.fn(async () => {
			return new Response(JSON.stringify({ records: [{ id: "rec-123" }] }), {
				status: 200,
				headers: {
					"content-type": "application/json",
				},
			});
		});
		vi.stubGlobal("fetch", airtableFetch);

		const request = new IncomingRequest("http://example.com/admin/sync/airtable", {
			method: "POST",
			headers: {
				authorization: "Bearer secret-token",
			},
		});
		const db = createDbMock({
			syncRows: [
				{
					id: 1,
					request_id: "req-123",
					destination: "airtable",
					status: "queued",
					attempts: 0,
					last_error: null,
					created_at: "2026-04-29T00:00:00.000Z",
					updated_at: "2026-04-29T00:00:00.000Z",
					name: "Avery Founder",
					email: "avery@example.com",
					phone: "+1 555 0100",
					business_name: "Avery Ops LLC",
					location: "Detroit, MI",
					preferred_contact: "email",
					mode: "Automation Workflow",
					lead_created_at: "2026-04-29T00:00:00.000Z",
				},
			],
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			createEnv({}, db, [], {
				ADMIN_EXPORT_TOKEN: "secret-token",
				AIRTABLE_API_KEY: "fake-airtable-key",
				AIRTABLE_BASE_ID: "appFakeBase",
				AIRTABLE_TABLE_NAME: "Leads",
			} as unknown as Partial<Env>),
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		const payload = await response.json();
		expectRequestId(payload);
		expect(payload).toMatchObject({
			ok: true,
			data: {
				summary: {
					processed: 1,
					synced: 1,
					failed: 0,
					skipped: 0,
				},
			},
		});
		expect(airtableFetch).toHaveBeenCalledWith(
			"https://api.airtable.com/v0/appFakeBase/Leads",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer fake-airtable-key",
					"Content-Type": "application/json",
				}),
				body: JSON.stringify({
					records: [
						{
							fields: {
								"Request ID": "req-123",
								Name: "Avery Founder",
								Email: "avery@example.com",
								Phone: "+1 555 0100",
								"Business Name": "Avery Ops LLC",
								Location: "Detroit, MI",
								"Preferred Contact": "email",
								Mode: "Automation Workflow",
								"Created At": "2026-04-29T00:00:00.000Z",
							},
						},
					],
				}),
			}),
		);
		expect(db.statements).toEqual(
			expect.arrayContaining([
				{
					sql: "UPDATE lead_sync_queue SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?",
					params: ["synced", null, expect.any(String), 1],
				},
			]),
		);
		expect(JSON.stringify(payload)).not.toContain("fake-airtable-key");
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
				"GET /admin/export/intake-leads",
				"GET /admin/export/sync-queue",
				"POST /admin/sync/airtable",
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
