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

type RouteRequestBody = {
	input?: string;
	instructions?: string;
	max_tokens?: number;
};

type ValidatedRouteRequestBody = {
	input: string;
	instructions?: string;
	max_tokens?: number;
};

export interface Env {
	AI: AiBinding;
}

export type BranchOpsResponse = {
	objective: string;
	classification: string;
	monetization_model: unknown;
	risks: string[];
	next_actions: string[];
};

const MODEL = "@cf/openai/gpt-oss-120b";
const ROUTES = {
	root: "/",
} as const;
const REQUEST_CONTENT_TYPE = "application/json";
const ALLOWED_REQUEST_FIELDS = ["input", "instructions", "max_tokens"] as const;
const MAX_INPUT_CHARS = 8000;
const MAX_INSTRUCTIONS_CHARS = 2000;
const DEFAULT_MAX_TOKENS = 700;
const MAX_ALLOWED_TOKENS = 700;
const DEFAULT_INSTRUCTIONS =
	"Return valid JSON only with keys: objective, classification, monetization_model, risks, next_actions. Type rules: objective must be a string, classification must be a single string label, monetization_model must be an object, risks must be an array of strings, and next_actions must be an array of strings. Do not return nested objects for classification or risks.";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
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
					.map((entry) =>
						includeKeys ? `${formatObjectKey(key)}: ${entry}` : entry,
					);
			}

			const stringValue = normalizeString(item);
			if (!stringValue) {
				return [];
			}

			return [includeKeys ? `${formatObjectKey(key)}: ${stringValue}` : stringValue];
		})
		.filter((item) => item.length > 0);

	return items.length > 0 ? items : null;
}

function normalizeBranchOpsResponse(value: unknown): BranchOpsResponse | null {
	if (!isRecord(value) || !("monetization_model" in value)) {
		return null;
	}

	const objective = normalizeString(value.objective);
	const classification = normalizeClassification(value.classification);
	const risks = normalizeStringList(value.risks, true);
	const nextActions = normalizeStringList(value.next_actions);

	if (!objective || !classification || !risks || !nextActions) {
		return null;
	}

	return {
		objective,
		classification,
		monetization_model: value.monetization_model,
		risks,
		next_actions: nextActions,
	};
}

function createErrorResponse(
	status: number,
	error: string,
	extra: Record<string, unknown> = {},
): Response {
	return Response.json({ ok: false, error, ...extra }, { status });
}

function createSuccessResponse(
	data: BranchOpsResponse,
	usage: Record<string, unknown> | null | undefined,
): Response {
	return Response.json({
		ok: true,
		model: MODEL,
		data,
		usage: usage ?? null,
	});
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

async function parseRequestBody(
	request: Request,
): Promise<
	{ ok: true; body: ValidatedRouteRequestBody } | { ok: false; response: Response }
> {
	const contentType = request.headers.get("content-type");
	if (!contentType || !contentType.toLowerCase().includes(REQUEST_CONTENT_TYPE)) {
		return {
			ok: false,
			response: createErrorResponse(415, "Unsupported media type.", {
				route: ROUTES.root,
				expected_content_type: REQUEST_CONTENT_TYPE,
			}),
		};
	}

	let body: unknown;

	try {
		body = await request.json<unknown>();
	} catch {
		return {
			ok: false,
			response: createErrorResponse(400, "Invalid JSON body.", {
				route: ROUTES.root,
			}),
		};
	}

	if (!isRecord(body)) {
		return {
			ok: false,
			response: createErrorResponse(400, "Request body must be a JSON object.", {
				route: ROUTES.root,
			}),
		};
	}

	const unsupportedFields = Object.keys(body).filter(
		(key) =>
			!ALLOWED_REQUEST_FIELDS.includes(
				key as (typeof ALLOWED_REQUEST_FIELDS)[number],
			),
	);
	if (unsupportedFields.length > 0) {
		return {
			ok: false,
			response: createErrorResponse(400, "Unsupported request fields.", {
				route: ROUTES.root,
				unsupported_fields: unsupportedFields,
			}),
		};
	}

	const input = normalizeString(body.input);
	if (!input) {
		return {
			ok: false,
			response: createErrorResponse(400, "Missing 'input'.", {
				route: ROUTES.root,
			}),
		};
	}

	if (input.length > MAX_INPUT_CHARS) {
		return {
			ok: false,
			response: createErrorResponse(
				400,
				`'input' exceeds ${MAX_INPUT_CHARS} characters.`,
				{
					route: ROUTES.root,
				},
			),
		};
	}

	const validatedBody: ValidatedRouteRequestBody = { input };

	if ("instructions" in body && body.instructions !== undefined) {
		const instructions = normalizeString(body.instructions);
		if (!instructions) {
			return {
				ok: false,
				response: createErrorResponse(
					400,
					"'instructions' must be a non-empty string when provided.",
					{
						route: ROUTES.root,
					},
				),
			};
		}

		if (instructions.length > MAX_INSTRUCTIONS_CHARS) {
			return {
				ok: false,
				response: createErrorResponse(
					400,
					`'instructions' exceeds ${MAX_INSTRUCTIONS_CHARS} characters.`,
					{
						route: ROUTES.root,
					},
				),
			};
		}

		validatedBody.instructions = instructions;
	}

	if ("max_tokens" in body && body.max_tokens !== undefined) {
		if (
			typeof body.max_tokens !== "number" ||
			!Number.isInteger(body.max_tokens)
		) {
			return {
				ok: false,
				response: createErrorResponse(
					400,
					"'max_tokens' must be an integer when provided.",
					{
						route: ROUTES.root,
					},
				),
			};
		}

		if (body.max_tokens < 1 || body.max_tokens > MAX_ALLOWED_TOKENS) {
			return {
				ok: false,
				response: createErrorResponse(
					400,
					`'max_tokens' must be between 1 and ${MAX_ALLOWED_TOKENS}.`,
					{
						route: ROUTES.root,
					},
				),
			};
		}

		validatedBody.max_tokens = body.max_tokens;
	}

	return { ok: true, body: validatedBody };
}

async function handleAnalyze(request: Request, env: Env): Promise<Response> {
	const parsedBody = await parseRequestBody(request);
	if (!parsedBody.ok) {
		return parsedBody.response;
	}

	try {
		const raw = await env.AI.run(MODEL, {
			instructions: parsedBody.body.instructions ?? DEFAULT_INSTRUCTIONS,
			input: parsedBody.body.input,
			max_tokens: parsedBody.body.max_tokens ?? DEFAULT_MAX_TOKENS,
			temperature: 0.2,
		});

		const parsedResponse = parseModelResponse(raw);
		if ("error" in parsedResponse) {
			return createErrorResponse(502, parsedResponse.error, {
				route: ROUTES.root,
				model: MODEL,
				...(parsedResponse.rawText
					? {
							raw_text: parsedResponse.rawText,
					  }
					: {}),
			});
		}

		const normalized = normalizeBranchOpsResponse(parsedResponse.parsed);
		if (!normalized) {
			return createErrorResponse(502, "Model returned invalid JSON contract.", {
				route: ROUTES.root,
				model: MODEL,
				...(parsedResponse.rawText
					? {
							raw_text: parsedResponse.rawText,
					  }
					: {}),
			});
		}

		return createSuccessResponse(normalized, raw.usage);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return createErrorResponse(500, message, { route: ROUTES.root });
	}
}

function handleRoot(): Response {
	return Response.json({
		ok: true,
		message:
			"Controlled intake worker. Use GET / for the contract map and POST / for normalized analysis.",
		route: ROUTES.root,
		route_map: [
			{
				path: ROUTES.root,
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
				path: ROUTES.root,
				method: "POST",
				purpose:
					"Validate an intake payload, run the model, and return normalized analysis JSON.",
				request_body: {
					content_type: REQUEST_CONTENT_TYPE,
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
			content_type: REQUEST_CONTENT_TYPE,
			required_fields: ["input"],
			optional_fields: ["instructions", "max_tokens"],
			limits: {
				input_max_chars: MAX_INPUT_CHARS,
				instructions_max_chars: MAX_INSTRUCTIONS_CHARS,
				max_tokens_default: DEFAULT_MAX_TOKENS,
				max_tokens_max: MAX_ALLOWED_TOKENS,
			},
		},
		runtime_requirements: {
			bindings: ["AI"],
			vars: [],
		},
		model: MODEL,
	});
}

function handleMethodNotAllowed(): Response {
	return createErrorResponse(405, "Method not allowed. Use GET or POST.", {
		route: ROUTES.root,
	});
}

function handleNotFound(pathname: string): Response {
	return createErrorResponse(404, "Route not found.", { route: pathname });
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const pathname = new URL(request.url).pathname;
		if (pathname !== ROUTES.root) {
			return handleNotFound(pathname);
		}

		if (request.method === "GET") {
			return handleRoot();
		}

		if (request.method === "POST") {
			return handleAnalyze(request, env);
		}

		return handleMethodNotAllowed();
	},
} satisfies ExportedHandler<Env>;
