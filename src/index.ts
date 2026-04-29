type AiOutputTextPart = {
	type: "output_text";
	text: string;
};

type AiMessageContentPart =
	| AiOutputTextPart
	| {
			type: string;
			text?: unknown;
	  };

type AiOutputItem =
	| {
			type: "message";
			content?: AiMessageContentPart[];
	  }
	| {
			type?: string;
			content?: unknown;
	  };

type AiRunResult = {
	output?: AiOutputItem[];
	response?: unknown;
	usage?: Record<string, unknown> | null;
};

type AiBinding = {
	run: (model: string, inputs: Record<string, unknown>) => Promise<AiRunResult>;
};

type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
	role: ChatRole;
	content: string;
};

type ChatRequestBody = {
	sessionId?: string;
	messages?: ChatMessage[];
	input?: string;
	instructions?: string;
	max_tokens?: number;
	temperature?: number;
};

type AnalyzeRequestBody = {
	input?: string;
	mode?: string;
	audience?: string;
	urgency?: string;
	budget?: string;
	instructions?: string;
	max_tokens?: number;
};

type ValidatedAnalyzeRequestBody = {
	input: string;
	mode?: string;
	audience?: string;
	urgency?: string;
	budget?: string;
	instructions?: string;
	max_tokens?: number;
};

type ValidatedChatRequestBody = {
	sessionId?: string;
	messages: ChatMessage[];
	instructions?: string;
	max_tokens?: number;
	temperature?: number;
};

export interface Env {
	AI: AiBinding;
	hello_ai_prod: D1Database;
}

export type BranchOpsResponse = {
	objective: string;
	classification: string;
	asset: Record<string, unknown>;
	execution_plan: string[];
	systems: string[];
	monetization_model: unknown;
	automation_opportunities: string[];
	legal_compliance_risks: string[];
	scaling_path: string[];
	long_term_value: string;
};

const SERVICE_NAME = "BranchOps AI Intake Worker";
const ASSET_ID = "BOH-AI-INTAKE-001";
const OWNER = "Branch Off Holdings LLC";
const VERSION = "0.1.0";
const MODEL = "@cf/openai/gpt-oss-120b";
const ROUTES = {
	root: "/",
	health: "/health",
	chat: "/chat",
	analyze: "/analyze",
} as const;
const REQUEST_CONTENT_TYPE = "application/json";
const INTAKE_MODES = [
	"General Business Asset",
	"Licensing / Royalty Model",
	"Automation Workflow",
	"Digital Product / App",
	"Content / Media Asset",
	"Grant / Workforce Program",
	"Real Estate / Property System",
	"Clothing / Brand / IP Asset",
	"Food / Infused Product R&D",
	"Compliance / Risk Review",
] as const;
const ANALYZE_ALLOWED_REQUEST_FIELDS = [
	"input",
	"mode",
	"audience",
	"urgency",
	"budget",
	"instructions",
	"max_tokens",
] as const;
const CHAT_ALLOWED_REQUEST_FIELDS = [
	"sessionId",
	"messages",
	"input",
	"instructions",
	"max_tokens",
	"temperature",
] as const;
const MAX_INPUT_CHARS = 8000;
const MAX_INSTRUCTIONS_CHARS = 2000;
const MAX_CONTEXT_FIELD_CHARS = 200;
const DEFAULT_MAX_TOKENS = 700;
const MAX_ALLOWED_TOKENS = 700;
const MAX_CHAT_TEMPERATURE = 2;
const THROTTLE_LIMIT = 30;
const THROTTLE_WINDOW_MS = 60 * 1000;
const THROTTLE_WINDOW_SECONDS = THROTTLE_WINDOW_MS / 1000;

type ThrottleBucket = {
	windowStartMs: number;
	count: number;
};

type IntakeEventStatus = "success" | "error" | "throttled";

type IntakeEvent = {
	requestId: string;
	route: string;
	mode?: string;
	status: IntakeEventStatus;
	timestamp: string;
	usage?: Record<string, unknown> | null;
	errorCode?: string;
	errorMessage?: string;
};

const throttleBuckets = new Map<string, ThrottleBucket>();

const DEFAULT_ANALYZE_INSTRUCTIONS =
	"Return valid JSON only with keys: objective, classification, asset, execution_plan, systems, monetization_model, automation_opportunities, legal_compliance_risks, scaling_path, long_term_value. Type rules: objective, classification, and long_term_value must be strings; asset and monetization_model must be objects; execution_plan, systems, automation_opportunities, legal_compliance_risks, and scaling_path must be arrays of strings. Build the response for BranchOps asset planning: convert raw founder/business ideas into a same-day structured asset plan owned by Branch Off Holdings LLC. Do not include Markdown or commentary.";

const DEFAULT_CHAT_INSTRUCTIONS = [
	"You are BranchOps AI Intake Worker for Branch Off Holdings LLC.",
	"You are a public-safe strategic assistant.",
	"Be direct, structured, and useful.",
	"Prefer ownership, automation, licensing, recurring revenue, and scalable systems when advising on business ideas.",
	"Flag legal, tax, privacy, safety, compliance, and IP risks when relevant.",
	"Do not invent facts. Say when information is missing.",
].join(" ");

const MAX_CHAT_MESSAGES = 20;

const CHAT_DEMO_HTML = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>BranchOps AI Intake Worker</title>
	<style>
		:root {
			color-scheme: dark;
			font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			background: #0b0f14;
			color: #e7edf5;
		}
		* { box-sizing: border-box; }
		body {
			margin: 0;
			background: linear-gradient(180deg, #0b0f14 0%, #111827 100%);
			min-height: 100vh;
		}
		.wrapper {
			max-width: 960px;
			margin: 0 auto;
			padding: 24px 16px 48px;
		}
		.hero {
			margin-bottom: 16px;
		}
		h1 {
			margin: 0 0 8px;
			font-size: 2rem;
		}
		p, li, code, textarea, button, input, select, label {
			font-size: 0.98rem;
		}
		.small {
			color: #9fb0c3;
		}
		.panel {
			background: rgba(17, 24, 39, 0.92);
			border: 1px solid rgba(148, 163, 184, 0.2);
			border-radius: 16px;
			padding: 16px;
			box-shadow: 0 16px 48px rgba(0, 0, 0, 0.22);
		}
		.chat-log {
			min-height: 360px;
			max-height: 60vh;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: 12px;
			padding: 4px 2px 12px;
			margin-bottom: 16px;
		}
		.message {
			padding: 12px 14px;
			border-radius: 14px;
			white-space: pre-wrap;
			line-height: 1.45;
		}
		.message.user {
			background: rgba(59, 130, 246, 0.2);
			border: 1px solid rgba(96, 165, 250, 0.28);
		}
		.message.assistant {
			background: rgba(34, 197, 94, 0.14);
			border: 1px solid rgba(74, 222, 128, 0.22);
		}
		.message.system {
			background: rgba(148, 163, 184, 0.12);
			border: 1px solid rgba(148, 163, 184, 0.16);
		}
		.meta {
			font-size: 0.8rem;
			color: #9fb0c3;
			margin-bottom: 6px;
			text-transform: uppercase;
			letter-spacing: 0.04em;
		}
		form {
			display: grid;
			gap: 12px;
		}
		label {
			display: grid;
			gap: 6px;
			color: #9fb0c3;
		}
		select, textarea {
			width: 100%;
			padding: 14px;
			border-radius: 12px;
			border: 1px solid rgba(148, 163, 184, 0.24);
			background: #0f172a;
			color: #e7edf5;
		}
		textarea {
			min-height: 120px;
			resize: vertical;
		}
		.actions {
			display: flex;
			gap: 12px;
			flex-wrap: wrap;
		}
		button {
			padding: 12px 16px;
			border-radius: 12px;
			border: 1px solid rgba(148, 163, 184, 0.22);
			background: #111827;
			color: #e7edf5;
			cursor: pointer;
		}
		button.primary {
			background: #2563eb;
			border-color: #2563eb;
		}
		.routes {
			margin-top: 18px;
		}
		code {
			background: rgba(15, 23, 42, 0.9);
			padding: 2px 6px;
			border-radius: 8px;
		}
	</style>
</head>
<body>
	<div class="wrapper">
		<div class="hero">
			<h1>BranchOps AI Intake Worker</h1>
			<p>Cloudflare Worker for converting founder and business ideas into structured BranchOps asset plans.</p>
			<p class="small">This browser demo stores conversation history locally and sends the rolling transcript to <code>/chat</code>.</p>
		</div>

		<div class="panel">
			<div id="chatLog" class="chat-log"></div>

			<form id="chatForm">
				<label>
					Intake mode
					<select id="modeSelect">
						<option>General Business Asset</option>
						<option>Licensing / Royalty Model</option>
						<option>Automation Workflow</option>
						<option>Digital Product / App</option>
						<option>Content / Media Asset</option>
						<option>Grant / Workforce Program</option>
						<option>Real Estate / Property System</option>
						<option>Clothing / Brand / IP Asset</option>
						<option>Food / Infused Product R&amp;D</option>
						<option>Compliance / Risk Review</option>
					</select>
				</label>
				<textarea id="messageInput" placeholder="Ask a question, test a workflow, or describe an idea..."></textarea>
				<div class="actions">
					<button class="primary" type="submit">Send</button>
					<button id="clearBtn" type="button">Clear local chat</button>
				</div>
			</form>

			<div class="routes">
				<p class="small">API routes: <code>GET /health</code>, <code>POST /chat</code>, <code>POST /analyze</code></p>
			</div>
		</div>
	</div>

	<script>
		(function () {
			var STORAGE_KEY = 'hello-ai-demo-history';
			var SESSION_KEY = 'hello-ai-demo-session';
			var chatLog = document.getElementById('chatLog');
			var form = document.getElementById('chatForm');
			var input = document.getElementById('messageInput');
			var modeSelect = document.getElementById('modeSelect');
			var clearBtn = document.getElementById('clearBtn');

			var sessionId = localStorage.getItem(SESSION_KEY) || crypto.randomUUID();
			localStorage.setItem(SESSION_KEY, sessionId);

			var messages = [];
			try {
				var saved = localStorage.getItem(STORAGE_KEY);
				if (saved) {
					messages = JSON.parse(saved);
				}
			} catch (error) {
				messages = [];
			}

			if (!Array.isArray(messages) || messages.length === 0) {
				messages = [
					{
						role: 'assistant',
						content: 'BranchOps intake is live. Describe a business idea to structure it into an asset plan.'
					}
				];
				persist();
			}

			function persist() {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
			}

			function render() {
				chatLog.innerHTML = '';
				messages.forEach(function (message) {
					var wrapper = document.createElement('div');
					wrapper.className = 'message ' + message.role;

					var meta = document.createElement('div');
					meta.className = 'meta';
					meta.textContent = message.role;

					var content = document.createElement('div');
					content.textContent = message.content;

					wrapper.appendChild(meta);
					wrapper.appendChild(content);
					chatLog.appendChild(wrapper);
				});
				chatLog.scrollTop = chatLog.scrollHeight;
			}

			async function sendMessage(text) {
				messages.push({ role: 'user', content: text });
				render();
				persist();

				var pending = { role: 'assistant', content: 'Thinking...' };
				messages.push(pending);
				render();

				try {
					var response = await fetch('/chat', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							sessionId: sessionId,
							instructions: 'Use intake mode: ' + modeSelect.value + '. Keep the response public-safe and asset-oriented.',
							messages: messages.filter(function (message) {
								return message !== pending;
							})
						})
					});

					var payload = await response.json();

					if (!response.ok || !payload.ok) {
						throw new Error(payload.error || 'Request failed.');
					}

					sessionId = payload.sessionId || sessionId;
					localStorage.setItem(SESSION_KEY, sessionId);
					pending.content = payload.reply || 'No reply returned.';
				} catch (error) {
					pending.content = 'Error: ' + (error && error.message ? error.message : 'Unknown error');
				}

				render();
				persist();
			}

			form.addEventListener('submit', function (event) {
				event.preventDefault();
				var text = input.value.trim();
				if (!text) {
					return;
				}
				input.value = '';
				sendMessage(text);
			});

			clearBtn.addEventListener('click', function () {
				localStorage.removeItem(STORAGE_KEY);
				localStorage.removeItem(SESSION_KEY);
				sessionId = crypto.randomUUID();
				localStorage.setItem(SESSION_KEY, sessionId);
				messages = [
					{
						role: 'assistant',
						content: 'Local chat cleared. Start a new conversation.'
					}
				];
				persist();
				render();
			});

			render();
		})();
	</script>
</body>
</html>`;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isChatRole(value: unknown): value is ChatRole {
	return value === "system" || value === "user" || value === "assistant";
}

function normalizeString(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function formatObjectKey(key: string): string {
	const words = key.replace(/[_-]+/g, " ").trim().split(/\s+/);
	return words
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

function normalizeClassification(value: unknown): string | null {
	const directValue = normalizeString(value);
	if (directValue) {
		return directValue;
	}

	if (Array.isArray(value)) {
		const parts = value
			.map((item) => normalizeString(item))
			.filter((item): item is string => item !== null);
		return parts.length > 0 ? parts.join(" | ") : null;
	}

	if (!isRecord(value)) {
		return null;
	}

	const prioritizedKeys = ["label", "industry", "category", "product_type", "segment"];
	const prioritizedParts = prioritizedKeys
		.map((key) => normalizeString(value[key]))
		.filter((item): item is string => item !== null);

	const remainingParts = Object.entries(value)
		.filter(([key]) => !prioritizedKeys.includes(key))
		.map(([, item]) => normalizeString(item))
		.filter((item): item is string => item !== null);

	const parts = [...new Set([...prioritizedParts, ...remainingParts])];
	return parts.length > 0 ? parts.join(" | ") : null;
}

function normalizeStringList(value: unknown, includeKeys = false): string[] | null {
	if (isStringArray(value)) {
		const items = value
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
		return items.length > 0 ? items : null;
	}

	const directValue = normalizeString(value);
	if (directValue) {
		return [directValue];
	}

	if (!isRecord(value)) {
		return null;
	}

	const items = Object.entries(value)
		.flatMap(([key, item]) => {
			if (isStringArray(item)) {
				return item
					.map((entry) => entry.trim())
					.filter((entry) => entry.length > 0)
					.map((entry) => (includeKeys ? formatObjectKey(key) + ": " + entry : entry));
			}

			const stringValue = normalizeString(item);
			if (!stringValue) {
				return [];
			}

			return [includeKeys ? formatObjectKey(key) + ": " + stringValue : stringValue];
		})
		.filter((item) => item.length > 0);

	return items.length > 0 ? items : null;
}

function normalizeBranchOpsResponse(value: unknown): BranchOpsResponse | null {
	if (!isRecord(value)) {
		return null;
	}

	const objective = normalizeString(value.objective);
	const classification = normalizeClassification(value.classification);
	const asset = isRecord(value.asset) ? value.asset : null;
	const executionPlan = normalizeStringList(value.execution_plan, true);
	const systems = normalizeStringList(value.systems, true);
	const automationOpportunities = normalizeStringList(
		value.automation_opportunities,
		true,
	);
	const legalComplianceRisks = normalizeStringList(
		value.legal_compliance_risks,
		true,
	);
	const scalingPath = normalizeStringList(value.scaling_path, true);
	const longTermValue = normalizeString(value.long_term_value);

	if (
		!objective ||
		!classification ||
		!asset ||
		!executionPlan ||
		!systems ||
		!("monetization_model" in value) ||
		!automationOpportunities ||
		!legalComplianceRisks ||
		!scalingPath ||
		!longTermValue
	) {
		return null;
	}

	return {
		objective,
		classification,
		asset,
		execution_plan: executionPlan,
		systems,
		monetization_model: value.monetization_model,
		automation_opportunities: automationOpportunities,
		legal_compliance_risks: legalComplianceRisks,
		scaling_path: scalingPath,
		long_term_value: longTermValue,
	};
}

export function extractOutputText(result: AiRunResult): string | null {
	const outputs = result.output;
	if (!Array.isArray(outputs)) {
		return null;
	}

	for (const item of outputs) {
		if (item.type !== "message" || !Array.isArray(item.content)) {
			continue;
		}

		for (const part of item.content) {
			if (part.type === "output_text" && typeof part.text === "string") {
				return part.text;
			}
		}
	}

	return null;
}

function getModelText(raw: AiRunResult): string | null {
	if (typeof raw.response === "string") {
		const trimmed = raw.response.trim();
		return trimmed ? trimmed : null;
	}

	const outputText = extractOutputText(raw);
	if (outputText) {
		return outputText;
	}

	if (raw.response !== undefined) {
		try {
			return JSON.stringify(raw.response);
		} catch {
			return null;
		}
	}

	return null;
}

function parseModelResponse(
	raw: AiRunResult,
): { parsed: unknown; rawText: string | null } | { error: string; rawText: string | null } {
	if (raw.response !== undefined) {
		if (typeof raw.response === "string") {
			try {
				return { parsed: JSON.parse(raw.response), rawText: raw.response };
			} catch {
				return { error: "Model returned non-JSON text.", rawText: raw.response };
			}
		}

		return { parsed: raw.response, rawText: null };
	}

	const outputText = extractOutputText(raw);
	if (!outputText) {
		return { error: "Model returned no output_text.", rawText: null };
	}

	try {
		return { parsed: JSON.parse(outputText), rawText: outputText };
	} catch {
		return { error: "Model returned non-JSON text.", rawText: outputText };
	}
}

function sanitizeMessages(value: unknown): ChatMessage[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.flatMap((item) => {
			if (!isRecord(item) || !isChatRole(item.role)) {
				return [];
			}

			const content = normalizeString(item.content);
			if (!content) {
				return [];
			}

			return [{ role: item.role, content }];
		})
		.slice(-MAX_CHAT_MESSAGES);
}

function buildConversationInput(messages: ChatMessage[]): string {
	return messages
		.map((message) => message.role.toUpperCase() + ": " + message.content)
		.join("\n\n");
}

function getSessionId(value: string | undefined): string {
	return value ?? crypto.randomUUID();
}

function createRequestId(): string {
	if (typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function getClientIp(request: Request): string {
	const forwardedFor = request.headers.get("x-forwarded-for");
	const forwardedIp = forwardedFor?.split(",")[0]?.trim();

	return (
		request.headers.get("cf-connecting-ip")?.trim() ||
		forwardedIp ||
		request.headers.get("x-real-ip")?.trim() ||
		"unknown"
	);
}

function checkThrottle(
	request: Request,
	route: string,
): { ok: true } | { ok: false; retryAfterSeconds: number } {
	const now = Date.now();
	const key = `${route}:${getClientIp(request)}`;
	const existing = throttleBuckets.get(key);

	for (const [bucketKey, bucket] of throttleBuckets.entries()) {
		if (now - bucket.windowStartMs >= THROTTLE_WINDOW_MS) {
			throttleBuckets.delete(bucketKey);
		}
	}

	if (!existing || now - existing.windowStartMs >= THROTTLE_WINDOW_MS) {
		throttleBuckets.set(key, { windowStartMs: now, count: 1 });
		return { ok: true };
	}

	if (existing.count >= THROTTLE_LIMIT) {
		return {
			ok: false,
			retryAfterSeconds: Math.max(
				1,
				Math.ceil((THROTTLE_WINDOW_MS - (now - existing.windowStartMs)) / 1000),
			),
		};
	}

	existing.count += 1;
	return { ok: true };
}

async function persistIntakeEvent(env: Env, event: IntakeEvent): Promise<void> {
	try {
		await env.hello_ai_prod.batch([
			env.hello_ai_prod
				.prepare(
					[
						"INSERT INTO intake_events",
						"(request_id, route, mode, status, timestamp, token_usage, error_code, error_message)",
						"VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
					].join(" "),
				)
				.bind(
					event.requestId,
					event.route,
					event.mode ?? null,
					event.status,
					event.timestamp,
					event.usage ? JSON.stringify(event.usage) : null,
					event.errorCode ?? null,
					event.errorMessage ?? null,
				),
		]);
	} catch (error) {
		console.error("Failed to persist intake event.", error);
	}
}

function queueIntakeEvent(
	ctx: ExecutionContext,
	env: Env,
	event: Omit<IntakeEvent, "timestamp">,
): void {
	ctx.waitUntil(
		persistIntakeEvent(env, {
			...event,
			timestamp: new Date().toISOString(),
		}),
	);
}

function getAnalyzeMode(body: Pick<ValidatedAnalyzeRequestBody, "mode">): string {
	return body.mode ?? "General Business Asset";
}

function buildAnalyzeInput(body: ValidatedAnalyzeRequestBody): string {
	const context = [
		["Mode", body.mode],
		["Audience", body.audience],
		["Urgency", body.urgency],
		["Budget", body.budget],
	]
		.filter(([, value]) => value)
		.map(([label, value]) => `${label}: ${value}`)
		.join("\n");

	if (!context) {
		return body.input;
	}

	return `${context}\n\nRaw idea:\n${body.input}`;
}

async function persistChatMessages(
	env: Env,
	sessionId: string,
	messages: ChatMessage[],
	reply: string,
): Promise<void> {
	const statements: D1PreparedStatement[] = [
		env.hello_ai_prod
			.prepare("INSERT OR IGNORE INTO chat_sessions (session_id) VALUES (?)")
			.bind(sessionId),
		...messages.map((message) =>
			env.hello_ai_prod
				.prepare(
					"INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
				)
				.bind(sessionId, message.role, message.content),
		),
		env.hello_ai_prod
			.prepare("INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)")
			.bind(sessionId, "assistant", reply),
	];

	await env.hello_ai_prod.batch(statements);
}

function corsHeaders(): HeadersInit {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type",
		"Cache-Control": "no-store",
	};
}

function jsonResponse(
	body: unknown,
	requestId: string,
	init?: ResponseInit,
): Response {
	const headers = new Headers(init?.headers);
	for (const [key, value] of Object.entries(corsHeaders())) {
		headers.set(key, value);
	}
	headers.set("Content-Type", "application/json; charset=utf-8");
	const payload = isRecord(body)
		? { ...body, request_id: requestId }
		: { data: body, request_id: requestId };

	return new Response(JSON.stringify(payload, null, 2), {
		...init,
		headers,
	});
}

function htmlResponse(html: string, init?: ResponseInit): Response {
	const headers = new Headers(init?.headers);
	for (const [key, value] of Object.entries(corsHeaders())) {
		headers.set(key, value);
	}
	headers.set("Content-Type", "text/html; charset=utf-8");
	return new Response(html, {
		...init,
		headers,
	});
}

function errorResponse(
	route: string,
	status: number,
	error: string,
	requestId: string,
	extra: Record<string, unknown> = {},
): Response {
	return jsonResponse({ ok: false, error, route, ...extra }, requestId, { status });
}

async function readJson<T>(request: Request): Promise<T> {
	return (await request.json()) as T;
}

async function parseJsonObject(
	request: Request,
	route: string,
	requestId: string,
): Promise<
	{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }
> {
	const contentType = request.headers.get("content-type");
	if (!contentType || !contentType.toLowerCase().includes(REQUEST_CONTENT_TYPE)) {
		return {
			ok: false,
			response: errorResponse(
				route,
				415,
				"Unsupported media type.",
				requestId,
				{
					expected_content_type: REQUEST_CONTENT_TYPE,
				},
			),
		};
	}

	let body: unknown;

	try {
		body = await readJson<unknown>(request);
	} catch {
		return {
			ok: false,
			response: errorResponse(route, 400, "Invalid JSON body.", requestId),
		};
	}

	if (!isRecord(body)) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				"Request body must be a JSON object.",
				requestId,
			),
		};
	}

	return { ok: true, body };
}

function getUnsupportedFields(
	body: Record<string, unknown>,
	allowedFields: readonly string[],
): string[] {
	return Object.keys(body).filter((key) => !allowedFields.includes(key));
}

function validateInput(
	value: unknown,
	route: string,
	requestId: string,
	required = true,
): { ok: true; value?: string } | { ok: false; response: Response } {
	if (value === undefined) {
		if (required) {
			return {
				ok: false,
				response: errorResponse(route, 400, "Missing 'input'.", requestId),
			};
		}

		return { ok: true, value: undefined };
	}

	const input = normalizeString(value);
	if (!input) {
		return {
			ok: false,
			response: errorResponse(route, 400, "Missing 'input'.", requestId),
		};
	}

	if (input.length > MAX_INPUT_CHARS) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				`'input' exceeds ${MAX_INPUT_CHARS} characters.`,
				requestId,
			),
		};
	}

	return { ok: true, value: input };
}

function validateInstructions(
	value: unknown,
	route: string,
	requestId: string,
): { ok: true; value?: string } | { ok: false; response: Response } {
	if (value === undefined) {
		return { ok: true, value: undefined };
	}

	const instructions = normalizeString(value);
	if (!instructions) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				"'instructions' must be a non-empty string when provided.",
				requestId,
			),
		};
	}

	if (instructions.length > MAX_INSTRUCTIONS_CHARS) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				`'instructions' exceeds ${MAX_INSTRUCTIONS_CHARS} characters.`,
				requestId,
			),
		};
	}

	return { ok: true, value: instructions };
}

function validateOptionalContextField(
	value: unknown,
	fieldName: string,
	route: string,
	requestId: string,
): { ok: true; value?: string } | { ok: false; response: Response } {
	if (value === undefined) {
		return { ok: true, value: undefined };
	}

	const text = normalizeString(value);
	if (!text) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				`'${fieldName}' must be a non-empty string when provided.`,
				requestId,
			),
		};
	}

	if (text.length > MAX_CONTEXT_FIELD_CHARS) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				`'${fieldName}' exceeds ${MAX_CONTEXT_FIELD_CHARS} characters.`,
				requestId,
			),
		};
	}

	return { ok: true, value: text };
}

function validateMaxTokens(
	value: unknown,
	route: string,
	requestId: string,
): { ok: true; value?: number } | { ok: false; response: Response } {
	if (value === undefined) {
		return { ok: true, value: undefined };
	}

	if (typeof value !== "number" || !Number.isInteger(value)) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				"'max_tokens' must be an integer when provided.",
				requestId,
			),
		};
	}

	if (value < 1 || value > MAX_ALLOWED_TOKENS) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				`'max_tokens' must be between 1 and ${MAX_ALLOWED_TOKENS}.`,
				requestId,
			),
		};
	}

	return { ok: true, value };
}

function validateTemperature(
	value: unknown,
	route: string,
	requestId: string,
): { ok: true; value?: number } | { ok: false; response: Response } {
	if (value === undefined) {
		return { ok: true, value: undefined };
	}

	if (typeof value !== "number" || Number.isNaN(value)) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				"'temperature' must be a number when provided.",
				requestId,
			),
		};
	}

	if (value < 0 || value > MAX_CHAT_TEMPERATURE) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				`'temperature' must be between 0 and ${MAX_CHAT_TEMPERATURE}.`,
				requestId,
			),
		};
	}

	return { ok: true, value };
}

function validateSessionId(
	value: unknown,
	route: string,
	requestId: string,
): { ok: true; value?: string } | { ok: false; response: Response } {
	if (value === undefined) {
		return { ok: true, value: undefined };
	}

	const sessionId = normalizeString(value);
	if (!sessionId) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				"'sessionId' must be a non-empty string when provided.",
				requestId,
			),
		};
	}

	return { ok: true, value: sessionId };
}

async function parseAnalyzeRequestBody(
	request: Request,
	requestId: string,
): Promise<
	{ ok: true; body: ValidatedAnalyzeRequestBody } | { ok: false; response: Response }
> {
	const parsed = await parseJsonObject(request, ROUTES.analyze, requestId);
	if (!parsed.ok) {
		return parsed;
	}

	const unsupportedFields = getUnsupportedFields(
		parsed.body,
		ANALYZE_ALLOWED_REQUEST_FIELDS,
	);
	if (unsupportedFields.length > 0) {
		return {
			ok: false,
			response: errorResponse(
				ROUTES.analyze,
				400,
				"Unsupported request fields.",
				requestId,
				{
					unsupported_fields: unsupportedFields,
				},
			),
		};
	}

	const input = validateInput(parsed.body.input, ROUTES.analyze, requestId);
	if (!input.ok) {
		return input;
	}

	const mode = validateOptionalContextField(
		parsed.body.mode,
		"mode",
		ROUTES.analyze,
		requestId,
	);
	if (!mode.ok) {
		return mode;
	}

	const audience = validateOptionalContextField(
		parsed.body.audience,
		"audience",
		ROUTES.analyze,
		requestId,
	);
	if (!audience.ok) {
		return audience;
	}

	const urgency = validateOptionalContextField(
		parsed.body.urgency,
		"urgency",
		ROUTES.analyze,
		requestId,
	);
	if (!urgency.ok) {
		return urgency;
	}

	const budget = validateOptionalContextField(
		parsed.body.budget,
		"budget",
		ROUTES.analyze,
		requestId,
	);
	if (!budget.ok) {
		return budget;
	}

	const instructions = validateInstructions(
		parsed.body.instructions,
		ROUTES.analyze,
		requestId,
	);
	if (!instructions.ok) {
		return instructions;
	}

	const maxTokens = validateMaxTokens(
		parsed.body.max_tokens,
		ROUTES.analyze,
		requestId,
	);
	if (!maxTokens.ok) {
		return maxTokens;
	}

	return {
		ok: true,
		body: {
			input: input.value!,
			mode: mode.value,
			audience: audience.value,
			urgency: urgency.value,
			budget: budget.value,
			instructions: instructions.value,
			max_tokens: maxTokens.value,
		},
	};
}

async function parseChatRequestBody(
	request: Request,
	requestId: string,
): Promise<
	{ ok: true; body: ValidatedChatRequestBody } | { ok: false; response: Response }
> {
	const parsed = await parseJsonObject(request, ROUTES.chat, requestId);
	if (!parsed.ok) {
		return parsed;
	}

	const unsupportedFields = getUnsupportedFields(parsed.body, CHAT_ALLOWED_REQUEST_FIELDS);
	if (unsupportedFields.length > 0) {
		return {
			ok: false,
			response: errorResponse(
				ROUTES.chat,
				400,
				"Unsupported request fields.",
				requestId,
				{
					unsupported_fields: unsupportedFields,
				},
			),
		};
	}

	const sessionId = validateSessionId(
		parsed.body.sessionId,
		ROUTES.chat,
		requestId,
	);
	if (!sessionId.ok) {
		return sessionId;
	}

	const instructions = validateInstructions(
		parsed.body.instructions,
		ROUTES.chat,
		requestId,
	);
	if (!instructions.ok) {
		return instructions;
	}

	const maxTokens = validateMaxTokens(
		parsed.body.max_tokens,
		ROUTES.chat,
		requestId,
	);
	if (!maxTokens.ok) {
		return maxTokens;
	}

	const temperature = validateTemperature(
		parsed.body.temperature,
		ROUTES.chat,
		requestId,
	);
	if (!temperature.ok) {
		return temperature;
	}

	const sanitizedMessages = sanitizeMessages(parsed.body.messages);
	const fallbackInput = validateInput(
		parsed.body.input,
		ROUTES.chat,
		requestId,
		false,
	);
	if (!fallbackInput.ok) {
		return fallbackInput;
	}

	const messages =
		sanitizedMessages.length > 0
			? sanitizedMessages
			: fallbackInput.value
				? [{ role: "user" as const, content: fallbackInput.value }]
				: [];

	if (messages.length === 0) {
		return {
			ok: false,
			response: errorResponse(
				ROUTES.chat,
				400,
				"Missing 'messages' or 'input'.",
				requestId,
			),
		};
	}

	return {
		ok: true,
		body: {
			sessionId: sessionId.value,
			messages,
			instructions: instructions.value,
			max_tokens: maxTokens.value,
			temperature: temperature.value,
		},
	};
}

function handleHealth(requestId: string): Response {
	return jsonResponse({
		ok: true,
		status: "ok",
		service: SERVICE_NAME,
		asset_id: ASSET_ID,
		owner: OWNER,
		version: VERSION,
		model: MODEL,
		routes: {
			root: "GET /",
			health: "GET /health",
			chat: "POST /chat",
			analyze: "POST /analyze",
		},
		route_map: [
			{
				path: ROUTES.root,
				method: "GET",
				purpose: "Serve the browser chat demo UI.",
			},
			{
				path: ROUTES.health,
				method: "GET",
				purpose: "Inspect route contracts, limits, and runtime requirements.",
			},
			{
				path: ROUTES.chat,
				method: "POST",
				purpose: "Run conversational chat and persist the transcript to D1.",
			},
			{
				path: ROUTES.analyze,
				method: "POST",
				purpose: "Run structured JSON-contract intake analysis.",
			},
		],
		request_contracts: {
			chat: {
				content_type: REQUEST_CONTENT_TYPE,
				required_one_of: ["messages", "input"],
				optional_fields: ["sessionId", "instructions", "max_tokens", "temperature"],
				limits: {
					input_max_chars: MAX_INPUT_CHARS,
					instructions_max_chars: MAX_INSTRUCTIONS_CHARS,
					max_tokens_default: DEFAULT_MAX_TOKENS,
					max_tokens_max: MAX_ALLOWED_TOKENS,
					max_messages: MAX_CHAT_MESSAGES,
					temperature_min: 0,
					temperature_max: MAX_CHAT_TEMPERATURE,
				},
			},
			analyze: {
				content_type: REQUEST_CONTENT_TYPE,
				required_fields: ["input"],
				optional_fields: [
					"mode",
					"audience",
					"urgency",
					"budget",
					"instructions",
					"max_tokens",
				],
				intake_modes: INTAKE_MODES,
				limits: {
					input_max_chars: MAX_INPUT_CHARS,
					context_field_max_chars: MAX_CONTEXT_FIELD_CHARS,
					instructions_max_chars: MAX_INSTRUCTIONS_CHARS,
					max_tokens_default: DEFAULT_MAX_TOKENS,
					max_tokens_max: MAX_ALLOWED_TOKENS,
				},
				response_fields: [
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
				],
			},
		},
		runtime_requirements: {
			bindings: ["AI", "hello_ai_prod"],
			vars: [],
		},
		throttle: {
			routes: [ROUTES.chat, ROUTES.analyze],
			limit: THROTTLE_LIMIT,
			window_seconds: THROTTLE_WINDOW_SECONDS,
			key: "client IP when available",
		},
	}, requestId);
}

function handleMethodNotAllowed(pathname: string, requestId: string): Response {
	const allowedMethod =
		pathname === ROUTES.root || pathname === ROUTES.health ? "GET" : "POST";
	return errorResponse(
		pathname,
		405,
		`Method not allowed. Use ${allowedMethod}.`,
		requestId,
	);
}

function handleNotFound(requestId: string): Response {
	return jsonResponse(
		{
			ok: false,
			error: "Not found.",
			available_routes: [
				"GET /",
				"GET /health",
				"POST /chat",
				"POST /analyze",
			],
		},
		requestId,
		{ status: 404 },
	);
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const requestId = createRequestId();

		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders(),
			});
		}

		if (request.method === "GET" && url.pathname === ROUTES.root) {
			return htmlResponse(CHAT_DEMO_HTML);
		}

		if (request.method === "GET" && url.pathname === ROUTES.health) {
			return handleHealth(requestId);
		}

		if (request.method === "POST" && url.pathname === ROUTES.chat) {
			const throttle = checkThrottle(request, ROUTES.chat);
			if (!throttle.ok) {
				queueIntakeEvent(ctx, env, {
					requestId,
					route: ROUTES.chat,
					mode: "chat",
					status: "throttled",
					errorCode: "429",
					errorMessage: "Rate limit exceeded.",
				});
				return errorResponse(
					ROUTES.chat,
					429,
					"Rate limit exceeded.",
					requestId,
					{
						retry_after_seconds: throttle.retryAfterSeconds,
						throttle: {
							limit: THROTTLE_LIMIT,
							window_seconds: THROTTLE_WINDOW_SECONDS,
						},
					},
				);
			}

			const parsedBody = await parseChatRequestBody(request, requestId);
			if (!parsedBody.ok) {
				queueIntakeEvent(ctx, env, {
					requestId,
					route: ROUTES.chat,
					mode: "chat",
					status: "error",
					errorCode: String(parsedBody.response.status),
					errorMessage: "Request validation failed.",
				});
				return parsedBody.response;
			}

			try {
				const raw = await env.AI.run(MODEL, {
					instructions: parsedBody.body.instructions ?? DEFAULT_CHAT_INSTRUCTIONS,
					input: buildConversationInput(parsedBody.body.messages),
					max_tokens: parsedBody.body.max_tokens ?? DEFAULT_MAX_TOKENS,
					temperature: parsedBody.body.temperature ?? 0.4,
				});

				const reply = getModelText(raw);
				if (!reply) {
					queueIntakeEvent(ctx, env, {
						requestId,
						route: ROUTES.chat,
						mode: "chat",
						status: "error",
						usage: raw.usage ?? null,
						errorCode: "502",
						errorMessage: "Model returned no usable chat text.",
					});
					return errorResponse(
						ROUTES.chat,
						502,
						"Model returned no usable chat text.",
						requestId,
						{ model: MODEL },
					);
				}

				const sessionId = getSessionId(parsedBody.body.sessionId);

				try {
					await persistChatMessages(env, sessionId, parsedBody.body.messages, reply);
				} catch (error) {
					console.error("Failed to persist chat transcript.", error);
				}

				queueIntakeEvent(ctx, env, {
					requestId,
					route: ROUTES.chat,
					mode: "chat",
					status: "success",
					usage: raw.usage ?? null,
				});

				return jsonResponse({
					ok: true,
					sessionId,
					model: MODEL,
					reply,
					usage: raw.usage ?? null,
				}, requestId);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unknown error";
				queueIntakeEvent(ctx, env, {
					requestId,
					route: ROUTES.chat,
					mode: "chat",
					status: "error",
					errorCode: "500",
					errorMessage: message,
				});
				return errorResponse(ROUTES.chat, 500, message, requestId);
			}
		}

		if (request.method === "POST" && url.pathname === ROUTES.analyze) {
			const throttle = checkThrottle(request, ROUTES.analyze);
			if (!throttle.ok) {
				queueIntakeEvent(ctx, env, {
					requestId,
					route: ROUTES.analyze,
					status: "throttled",
					errorCode: "429",
					errorMessage: "Rate limit exceeded.",
				});
				return errorResponse(
					ROUTES.analyze,
					429,
					"Rate limit exceeded.",
					requestId,
					{
						retry_after_seconds: throttle.retryAfterSeconds,
						throttle: {
							limit: THROTTLE_LIMIT,
							window_seconds: THROTTLE_WINDOW_SECONDS,
						},
					},
				);
			}

			const parsedBody = await parseAnalyzeRequestBody(request, requestId);
			if (!parsedBody.ok) {
				queueIntakeEvent(ctx, env, {
					requestId,
					route: ROUTES.analyze,
					status: "error",
					errorCode: String(parsedBody.response.status),
					errorMessage: "Request validation failed.",
				});
				return parsedBody.response;
			}

			try {
				const raw = await env.AI.run(MODEL, {
					instructions:
						parsedBody.body.instructions ?? DEFAULT_ANALYZE_INSTRUCTIONS,
					input: buildAnalyzeInput(parsedBody.body),
					max_tokens: parsedBody.body.max_tokens ?? DEFAULT_MAX_TOKENS,
					temperature: 0.2,
				});

				const parsedResponse = parseModelResponse(raw);
				if ("error" in parsedResponse) {
					queueIntakeEvent(ctx, env, {
						requestId,
						route: ROUTES.analyze,
						mode: getAnalyzeMode(parsedBody.body),
						status: "error",
						usage: raw.usage ?? null,
						errorCode: "502",
						errorMessage: parsedResponse.error,
					});
					return errorResponse(
						ROUTES.analyze,
						502,
						parsedResponse.error,
						requestId,
						{
							model: MODEL,
							...(parsedResponse.rawText
								? { raw_text: parsedResponse.rawText }
								: {}),
						},
					);
				}

				const normalized = normalizeBranchOpsResponse(parsedResponse.parsed);
				if (!normalized) {
					queueIntakeEvent(ctx, env, {
						requestId,
						route: ROUTES.analyze,
						mode: getAnalyzeMode(parsedBody.body),
						status: "error",
						usage: raw.usage ?? null,
						errorCode: "502",
						errorMessage: "Model returned invalid JSON contract.",
					});
					return errorResponse(
						ROUTES.analyze,
						502,
						"Model returned invalid JSON contract.",
						requestId,
						{
							model: MODEL,
							...(parsedResponse.rawText
								? { raw_text: parsedResponse.rawText }
								: {}),
						},
					);
				}

				queueIntakeEvent(ctx, env, {
					requestId,
					route: ROUTES.analyze,
					mode: getAnalyzeMode(parsedBody.body),
					status: "success",
					usage: raw.usage ?? null,
				});

				return jsonResponse({
					ok: true,
					model: MODEL,
					data: normalized,
					usage: raw.usage ?? null,
				}, requestId);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unknown error";
				queueIntakeEvent(ctx, env, {
					requestId,
					route: ROUTES.analyze,
					mode: getAnalyzeMode(parsedBody.body),
					status: "error",
					errorCode: "500",
					errorMessage: message,
				});
				return errorResponse(ROUTES.analyze, 500, message, requestId);
			}
		}

		if (
			url.pathname === ROUTES.root ||
			url.pathname === ROUTES.health ||
			url.pathname === ROUTES.chat ||
			url.pathname === ROUTES.analyze
		) {
			return handleMethodNotAllowed(url.pathname, requestId);
		}

		return handleNotFound(requestId);
	},
} satisfies ExportedHandler<Env>;
