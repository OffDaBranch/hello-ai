type ResultValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| ResultValue[]
	| { [key: string]: ResultValue };

type BranchOpsOutputSource = {
	requestId?: string;
	mode?: string;
	timestamp?: string;
	result: unknown;
};

type OutputField = {
	key: string;
	title: string;
	aliases?: string[];
};

export type BranchOpsOutputSection = {
	key: string;
	title: string;
	value: string;
};

const EMPTY_VALUE = "Not returned by backend.";
const REDACTED_VALUE = "[redacted sensitive value]";

const OUTPUT_FIELDS: readonly OutputField[] = [
	{ key: "request_id", title: "Request ID" },
	{ key: "mode", title: "Mode" },
	{ key: "timestamp", title: "Timestamp", aliases: ["createdAt", "created_at"] },
	{ key: "objective", title: "Objective" },
	{ key: "classification", title: "Classification" },
	{ key: "asset", title: "Asset" },
	{ key: "execution_plan", title: "Execution Plan", aliases: ["next_actions"] },
	{ key: "systems", title: "Systems", aliases: ["systems_and_prompts"] },
	{ key: "monetization_model", title: "Monetization Model" },
	{ key: "automation_opportunities", title: "Automation Opportunities" },
	{
		key: "legal_compliance_risks",
		title: "Legal / Compliance Risks",
		aliases: ["risks"],
	},
	{ key: "scaling_path", title: "Scaling Path" },
	{ key: "long_term_value", title: "Long-Term Value" },
] as const;

const SENSITIVE_KEY_PATTERN =
	/(admin.*token|token|api.*key|secret|password|credential|private.*key)/i;
const SENSITIVE_VALUE_PATTERN =
	/(sk-[A-Za-z0-9_-]{6,}|[A-Z0-9_]*(TOKEN|SECRET|API_KEY|PASSWORD)[A-Z0-9_]*\s*=\s*\S+)/g;

export function buildBranchOpsOutputSections({
	requestId,
	mode,
	timestamp,
	result,
}: BranchOpsOutputSource): BranchOpsOutputSection[] {
	const source = readResultSource(result);

	return OUTPUT_FIELDS.map((field) => {
		const metadataValue =
			field.key === "request_id"
				? requestId ?? readField(source, field)
				: field.key === "mode"
					? mode ?? readField(source, field)
					: field.key === "timestamp"
						? timestamp ?? readField(source, field)
						: readField(source, field);

		return {
			key: field.key,
			title: field.title,
			value: formatResultValue(metadataValue),
		};
	});
}

export function formatBranchOpsOutputText(input: BranchOpsOutputSource): string {
	return buildBranchOpsOutputSections(input)
		.map((section) => `${section.title}\n${section.value}`)
		.join("\n\n");
}

export function formatResultValue(value: ResultValue, depth = 0): string {
	if (value === null || value === undefined || value === "") {
		return EMPTY_VALUE;
	}

	if (Array.isArray(value)) {
		const items = value
			.map((item) => formatArrayItem(item, depth))
			.filter((item) => item.trim().length > 0);
		return items.length > 0 ? items.join("\n") : EMPTY_VALUE;
	}

	if (typeof value === "object") {
		const entries = Object.entries(value).filter(
			([key]) => !SENSITIVE_KEY_PATTERN.test(key),
		);

		if (entries.length === 0) {
			return EMPTY_VALUE;
		}

		const indent = "  ".repeat(depth);
		return entries
			.map(([key, item]) => {
				const label = cleanResultLabel(key);

				if (isScalarResult(item)) {
					return `${indent}${label}: ${formatScalar(item)}`;
				}

				return `${indent}${label}:\n${formatResultValue(item, depth + 1)}`;
			})
			.join("\n");
	}

	return formatScalar(value);
}

export function cleanResultLabel(label: string) {
	return label
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim()
		.split(/\s+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

function readResultSource(value: unknown): Record<string, ResultValue> | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	for (const key of ["result", "analysis", "data"] as const) {
		if (isRecord(value[key])) {
			return value[key] as Record<string, ResultValue>;
		}
	}

	return value as Record<string, ResultValue>;
}

function readField(source: Record<string, ResultValue> | undefined, field: OutputField) {
	if (!source) {
		return undefined;
	}

	const keys = [field.key, ...(field.aliases ?? [])];
	for (const key of keys) {
		if (key in source) {
			return source[key];
		}
	}

	return undefined;
}

function formatArrayItem(item: ResultValue, depth: number) {
	const indent = "  ".repeat(depth);

	if (isScalarResult(item)) {
		return `${indent}- ${formatScalar(item)}`;
	}

	return `${indent}- ${formatResultValue(item, depth + 1).trimStart()}`;
}

function formatScalar(value: string | number | boolean | null | undefined) {
	if (value === null || value === undefined || value === "") {
		return EMPTY_VALUE;
	}

	return String(value).replace(SENSITIVE_VALUE_PATTERN, REDACTED_VALUE);
}

function isScalarResult(value: ResultValue) {
	return value === null || value === undefined || typeof value !== "object";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
