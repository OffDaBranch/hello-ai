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
	name?: string;
	email?: string;
	phone?: string;
	business_name?: string;
	location?: string;
	preferred_contact?: string;
	instructions?: string;
	max_tokens?: number;
};

type LeadFields = {
	name?: string;
	email?: string;
	phone?: string;
	business_name?: string;
	location?: string;
	preferred_contact?: string;
};

type LeadExportRow = LeadFields & {
	request_id: string;
	mode: string | null;
	created_at: string;
};

type LeadSyncQueueRecord = {
	id: number;
	request_id: string;
	destination: string;
	status: string;
	attempts: number;
	last_error: string | null;
	created_at: string;
	updated_at: string;
};

type AirtableLeadSyncRow = LeadSyncQueueRecord &
	LeadFields & {
		mode: string | null;
		lead_created_at: string | null;
	};

type AirtableSyncSummary = {
	processed: number;
	synced: number;
	failed: number;
	skipped: number;
};

type ValidatedAnalyzeRequestBody = {
	input: string;
	mode?: string;
	audience?: string;
	urgency?: string;
	budget?: string;
	lead: LeadFields;
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
	ADMIN_EXPORT_TOKEN?: string;
	AIRTABLE_API_KEY?: string;
	AIRTABLE_BASE_ID?: string;
	AIRTABLE_TABLE_NAME?: string;
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
	outputUtility: "/output-utility",
	health: "/health",
	chat: "/chat",
	analyze: "/analyze",
	adminExportIntakeLeads: "/admin/export/intake-leads",
	adminExportSyncQueue: "/admin/export/sync-queue",
	adminSyncAirtable: "/admin/sync/airtable",
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
	"name",
	"email",
	"phone",
	"business_name",
	"location",
	"preferred_contact",
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
const LEAD_FIELD_LIMITS = {
	name: 120,
	email: 254,
	phone: 40,
	business_name: 160,
	location: 160,
	preferred_contact: 80,
} as const;
const AIRTABLE_DESTINATION = "airtable";
const AIRTABLE_SYNC_BATCH_LIMIT = 10;
const AIRTABLE_REQUIRED_ENV_VARS = [
	"AIRTABLE_API_KEY",
	"AIRTABLE_BASE_ID",
	"AIRTABLE_TABLE_NAME",
] as const;
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
			color-scheme: light;
			font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			background: #f5f7fb;
			color: #18212f;
		}
		* { box-sizing: border-box; }
		[hidden] { display: none !important; }
		body {
			margin: 0;
			min-height: 100vh;
			background: #eef3f8;
		}
		button, input, select, textarea {
			font: inherit;
		}
		button {
			cursor: pointer;
		}
		.app-shell {
			display: grid;
			grid-template-columns: 292px minmax(0, 1fr);
			min-height: 100vh;
		}
		.sidebar {
			position: sticky;
			top: 0;
			height: 100vh;
			padding: 18px 14px;
			background: #111827;
			color: #e5edf6;
			overflow-y: auto;
			border-right: 1px solid rgba(148, 163, 184, 0.22);
		}
		.brand {
			padding: 10px 10px 18px;
			border-bottom: 1px solid rgba(148, 163, 184, 0.22);
			margin-bottom: 14px;
		}
		.brand-mark {
			width: 40px;
			height: 40px;
			display: grid;
			place-items: center;
			border-radius: 8px;
			background: #f8fafc;
			color: #111827;
			font-weight: 800;
			margin-bottom: 10px;
		}
		.brand h1 {
			font-size: 1.1rem;
			line-height: 1.2;
			margin: 0 0 4px;
		}
		.brand p, .sidebar-label {
			margin: 0;
			color: #9fb0c3;
			font-size: 0.82rem;
		}
		.sidebar-label {
			text-transform: uppercase;
			letter-spacing: 0.08em;
			padding: 12px 10px 6px;
		}
		.nav-group {
			display: grid;
			gap: 4px;
		}
		.nav-button {
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 10px;
			border: 0;
			border-radius: 8px;
			padding: 10px;
			background: transparent;
			color: #d7e1ed;
			text-align: left;
		}
		.nav-button:hover,
		.nav-button.active {
			background: #233044;
			color: #ffffff;
		}
		.nav-tag {
			font-size: 0.72rem;
			color: #93c5fd;
		}
		.mobile-topbar {
			display: none;
			position: sticky;
			top: 0;
			z-index: 20;
			align-items: center;
			justify-content: space-between;
			padding: 12px 16px;
			background: #111827;
			color: #ffffff;
		}
		.menu-button {
			border: 1px solid rgba(255, 255, 255, 0.24);
			border-radius: 8px;
			background: transparent;
			color: #ffffff;
			padding: 8px 10px;
		}
		.main {
			min-width: 0;
			padding: 24px;
		}
		.workspace-header {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 18px;
			margin-bottom: 18px;
		}
		.eyebrow {
			margin: 0 0 6px;
			font-size: 0.78rem;
			color: #526174;
			text-transform: uppercase;
			letter-spacing: 0.08em;
		}
		h2, h3, p {
			margin-top: 0;
		}
		h2 {
			margin-bottom: 8px;
			font-size: 1.6rem;
			letter-spacing: 0;
		}
		h3 {
			margin-bottom: 10px;
			font-size: 1rem;
		}
		.muted {
			color: #637083;
		}
		.status-strip {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			justify-content: flex-end;
		}
		.pill {
			display: inline-flex;
			align-items: center;
			min-height: 30px;
			border: 1px solid #d9e2ec;
			border-radius: 8px;
			padding: 5px 8px;
			background: #ffffff;
			color: #415064;
			font-size: 0.82rem;
		}
		.card-grid {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 12px;
			margin-bottom: 18px;
		}
		.card, .panel {
			border: 1px solid #dbe3ed;
			border-radius: 8px;
			background: #ffffff;
			box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
		}
		.card {
			padding: 14px;
			min-height: 112px;
		}
		.card-title {
			margin: 0 0 8px;
			font-weight: 700;
			color: #18212f;
		}
		.card p {
			margin-bottom: 0;
			color: #637083;
			line-height: 1.45;
		}
		.panel {
			padding: 16px;
			margin-bottom: 18px;
		}
		.two-column {
			display: grid;
			grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.9fr);
			gap: 16px;
			align-items: start;
		}
		form {
			display: grid;
			gap: 12px;
		}
		label {
			display: grid;
			gap: 6px;
			color: #4f5f73;
			font-size: 0.92rem;
		}
		select, textarea, input {
			width: 100%;
			border: 1px solid #ced8e5;
			border-radius: 8px;
			background: #ffffff;
			color: #18212f;
			padding: 11px 12px;
		}
		textarea {
			min-height: 140px;
			resize: vertical;
			line-height: 1.45;
		}
		.form-grid, .lead-grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px;
		}
		details {
			border: 1px solid #dbe3ed;
			border-radius: 8px;
			padding: 12px;
			background: #f8fafc;
		}
		summary {
			cursor: pointer;
			font-weight: 700;
			color: #243044;
		}
		.actions {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
		}
		.primary-button, .secondary-button {
			border-radius: 8px;
			padding: 10px 13px;
			border: 1px solid #cbd5e1;
		}
		.primary-button {
			background: #1d4ed8;
			border-color: #1d4ed8;
			color: #ffffff;
		}
		.secondary-button {
			background: #ffffff;
			color: #243044;
		}
		.result-grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px;
		}
		.output-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
			margin: 10px 0 12px;
		}
		.output-status {
			min-height: 20px;
			margin-bottom: 10px;
			color: #1d4ed8;
			font-size: 0.88rem;
			font-weight: 700;
		}
		.print-output {
			display: none;
		}
		.result-card {
			border: 1px solid #dbe3ed;
			border-radius: 8px;
			background: #f8fafc;
			padding: 12px;
			min-height: 104px;
		}
		.result-card h4 {
			margin: 0 0 8px;
			font-size: 0.88rem;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: #526174;
		}
		.result-card p,
		.result-card li {
			color: #243044;
			line-height: 1.45;
		}
		.result-card ul {
			margin: 0;
			padding-left: 18px;
		}
		.chat-log {
			min-height: 260px;
			max-height: 420px;
			overflow-y: auto;
			display: grid;
			align-content: start;
			gap: 10px;
			padding: 4px 2px 12px;
		}
		.message {
			border-radius: 8px;
			padding: 10px 12px;
			line-height: 1.45;
			white-space: pre-wrap;
			background: #f1f5f9;
		}
		.message.user {
			background: #e0edff;
		}
		.message.assistant {
			background: #ecfdf5;
		}
		.meta {
			margin-bottom: 4px;
			color: #64748b;
			font-size: 0.74rem;
			text-transform: uppercase;
			letter-spacing: 0.06em;
		}
		.route-list {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 10px;
		}
		.route-item {
			border: 1px solid #dbe3ed;
			border-radius: 8px;
			background: #f8fafc;
			padding: 10px;
		}
		.metric-value {
			display: block;
			margin-top: 8px;
			font-size: 1.35rem;
			font-weight: 800;
			color: #172033;
		}
		.planner-grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 12px;
			margin-bottom: 12px;
		}
		.helper-list {
			margin: 0;
			padding-left: 18px;
			color: #243044;
			line-height: 1.5;
		}
		.callout {
			border: 1px solid #bfdbfe;
			border-radius: 8px;
			background: #eff6ff;
			padding: 12px;
		}
		.callout strong {
			display: block;
			margin-bottom: 6px;
		}
		.health-grid {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 12px;
			margin-bottom: 12px;
		}
		code {
			background: #eef3f8;
			border-radius: 6px;
			padding: 2px 5px;
		}
		pre {
			white-space: pre-wrap;
			overflow: auto;
			max-height: 360px;
			border: 1px solid #dbe3ed;
			border-radius: 8px;
			background: #0f172a;
			color: #e5edf6;
			padding: 12px;
		}
		@media (max-width: 1040px) {
			.app-shell {
				grid-template-columns: 1fr;
			}
			.mobile-topbar {
				display: flex;
			}
			.sidebar {
				position: fixed;
				z-index: 30;
				inset: 0 auto 0 0;
				width: min(86vw, 320px);
				transform: translateX(-100%);
				transition: transform 160ms ease;
			}
			body.sidebar-open .sidebar {
				transform: translateX(0);
			}
			.main {
				padding: 16px;
			}
			.two-column, .card-grid {
				grid-template-columns: 1fr;
			}
			.workspace-header {
				display: block;
			}
			.status-strip {
				justify-content: flex-start;
				margin-top: 10px;
			}
		}
		@media (max-width: 640px) {
			.form-grid, .lead-grid, .result-grid, .route-list, .planner-grid, .health-grid {
				grid-template-columns: 1fr;
			}
			.card {
				min-height: 0;
			}
		}
		@media print {
			body.output-printing {
				background: #ffffff;
			}
			body.output-printing .mobile-topbar,
			body.output-printing .sidebar,
			body.output-printing .workspace-header,
			body.output-printing .panel,
			body.output-printing .actions,
			body.output-printing button {
				display: none !important;
			}
			body.output-printing .main {
				padding: 0;
			}
			body.output-printing .print-output {
				display: block !important;
				white-space: pre-wrap;
				color: #0f172a;
				background: #ffffff;
				border: 0;
				max-height: none;
				padding: 0;
			}
		}
	</style>
</head>
<body>
	<div class="mobile-topbar">
		<strong>BranchOps AI Intake Worker</strong>
		<button id="menuButton" class="menu-button" type="button">Menu</button>
	</div>
	<div class="app-shell">
		<aside id="sidebar" class="sidebar" aria-label="BranchOps feature navigation">
			<div class="brand">
				<div class="brand-mark">BO</div>
				<h1>BranchOps AI Intake Worker</h1>
				<p>BOH-AI-INTAKE-001</p>
			</div>
			<p class="sidebar-label">Workspace</p>
			<nav class="nav-group">
				<button class="nav-button active" type="button" data-nav="dashboard" data-panel="dashboard">Dashboard<span class="nav-tag">Home</span></button>
				<button class="nav-button" type="button" data-nav="new-intake" data-panel="intake" data-mode="General Business Asset">New Intake<span class="nav-tag">Analyze</span></button>
				<button class="nav-button" type="button" data-nav="licensing" data-panel="intake" data-mode="Licensing / Royalty Model">Licensing Builder</button>
				<button class="nav-button" type="button" data-nav="automation" data-panel="intake" data-mode="Automation Workflow">Automation Planner</button>
				<button class="nav-button" type="button" data-nav="digital-product" data-panel="intake" data-mode="Digital Product / App">Digital Product Planner</button>
				<button class="nav-button" type="button" data-nav="content-media" data-panel="intake" data-mode="Content / Media Asset">Content / Media Asset</button>
				<button class="nav-button" type="button" data-nav="grant-workforce" data-panel="intake" data-mode="Grant / Workforce Program">Grant / Workforce Program</button>
				<button class="nav-button" type="button" data-nav="real-estate" data-panel="intake" data-mode="Real Estate / Property System">Real Estate System</button>
				<button class="nav-button" type="button" data-nav="brand-ip" data-panel="intake" data-mode="Clothing / Brand / IP Asset">Brand / IP Asset</button>
				<button class="nav-button" type="button" data-nav="food-product" data-panel="intake" data-mode="Food / Infused Product R&amp;D">Food / Product R&amp;D</button>
				<button class="nav-button" type="button" data-nav="compliance" data-panel="intake" data-mode="Compliance / Risk Review">Compliance Review</button>
			</nav>
			<p class="sidebar-label">Operations</p>
			<nav class="nav-group">
				<button class="nav-button" type="button" data-nav="lead-capture" data-panel="lead">Lead Capture</button>
				<button class="nav-button" type="button" data-nav="export-admin" data-panel="admin">Export / Admin</button>
				<button class="nav-button" type="button" data-nav="system-health" data-panel="health">System Health</button>
			</nav>
		</aside>

		<main class="main">
			<header class="workspace-header">
				<div>
					<p class="eyebrow">Branch Off Holdings LLC</p>
					<h2 id="activeTitle">Dashboard</h2>
					<p id="activeDescription" class="muted">A public-safe intake workspace for turning raw ideas into structured BranchOps asset plans.</p>
				</div>
				<div class="status-strip" aria-label="Active routes">
					<span class="pill">GET /</span>
					<span class="pill">POST /analyze</span>
					<span class="pill">POST /chat</span>
					<span class="pill">GET /health</span>
				</div>
			</header>

			<section id="dashboardPanel" data-panel-section="dashboard">
				<div id="dashboardCards" class="card-grid">
					<div class="card"><p class="card-title">Intake Modes</p><p>Active planner lanes</p><span id="intakeModeCount" class="metric-value">10</span></div>
					<div class="card"><p class="card-title">Lead Capture</p><p>Optional fields linked by request_id</p><span id="leadCaptureStatus" class="metric-value">Enabled</span></div>
					<div class="card"><p class="card-title">Export Configured</p><p>ADMIN_EXPORT_TOKEN status</p><span id="exportConfiguredStatus" class="metric-value">Checking</span></div>
					<div class="card"><p class="card-title">D1 Logging</p><p>Events and leads tables</p><span class="metric-value">Active</span></div>
					<div class="card"><p class="card-title">Throttle Limit</p><p>Per route client guard</p><span id="throttleLimit" class="metric-value">30 / 60s</span></div>
					<div class="card"><p class="card-title">Current Route Map</p><p>Published Worker routes</p><span id="routeCount" class="metric-value">5</span></div>
				</div>
				<div class="panel">
					<h3>Current route map</h3>
					<div id="dashboardRoutes" class="route-list">
						<div class="route-item"><strong>GET /</strong><br />Sidebar workspace UI</div>
						<div class="route-item"><strong>POST /analyze</strong><br />Structured BranchOps asset plan</div>
						<div class="route-item"><strong>POST /chat</strong><br />Separate conversational lane</div>
						<div class="route-item"><strong>GET /health</strong><br />Capabilities and route metadata</div>
						<div class="route-item"><strong>GET /admin/export/intake-leads</strong><br />Bearer-protected CSV export</div>
					</div>
				</div>
				<div class="panel">
					<h3>BranchOps schema cards</h3>
					<div id="schemaPreview" class="result-grid" aria-label="BranchOps schema preview"></div>
				</div>
			</section>

			<section id="intakePanel" data-panel-section="intake" hidden>
				<div class="two-column">
					<div class="panel">
						<h3 id="modeTitle">New Intake</h3>
						<p id="modeDescription" class="muted">General Business Asset turns an early idea into a structured BranchOps asset plan.</p>
						<div class="planner-grid">
							<div class="route-item">
								<strong>Recommended use case</strong>
								<p id="modeUseCase" class="muted">Use this when a raw business idea needs a same-day asset map.</p>
							</div>
							<div class="route-item">
								<strong>Preselected analyze mode</strong>
								<p id="modeActiveLabel" class="muted">General Business Asset</p>
							</div>
						</div>
						<div class="callout">
							<strong>Prompt helper bullets</strong>
							<ul id="modePromptHelpers" class="helper-list"></ul>
						</div>
						<form id="intakeForm">
							<label>
								Active intake mode
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
							<textarea id="ideaInput" placeholder="Describe the business idea, asset, process, offer, or risk to structure..."></textarea>
							<div class="form-grid">
								<label>Audience<input id="audienceInput" placeholder="founders, operators, buyers..." /></label>
								<label>Urgency<input id="urgencyInput" placeholder="same-day, this week, exploratory..." /></label>
								<label>Budget<input id="budgetInput" placeholder="lean, pilot, funded..." /></label>
								<label>Extra instructions<input id="instructionsInput" placeholder="optional analyst direction" /></label>
							</div>
							<details>
								<summary>Optional contact info for follow-up</summary>
								<p class="muted">Only add contact details when follow-up is wanted. Leave blank for an anonymous draft.</p>
								<div class="lead-grid">
									<label>Name<input id="leadName" autocomplete="name" /></label>
									<label>Email<input id="leadEmail" type="email" autocomplete="email" /></label>
									<label>Phone<input id="leadPhone" autocomplete="tel" /></label>
									<label>Business name<input id="leadBusinessName" autocomplete="organization" /></label>
									<label>Location<input id="leadLocation" autocomplete="address-level2" /></label>
									<label>Preferred contact<input id="leadPreferredContact" placeholder="email, phone, text..." /></label>
								</div>
							</details>
							<div class="actions">
								<button class="primary-button" type="submit">Analyze intake</button>
								<button id="clearIntakeBtn" class="secondary-button" type="button">Clear intake</button>
							</div>
						</form>
					</div>
					<div class="panel">
						<h3>Structured results</h3>
						<p id="requestIdLine" class="muted">Request ID appears after analysis.</p>
						<div class="output-actions" aria-label="BranchOps output actions">
							<button id="copyResultBtn" class="secondary-button" type="button">Copy Result</button>
							<button id="shareResultBtn" class="secondary-button" type="button">Share Result</button>
							<button id="printResultBtn" class="secondary-button" type="button">Print / Save PDF</button>
							<button id="downloadResultBtn" class="secondary-button" type="button">Download TXT</button>
						</div>
						<div id="outputActionStatus" class="output-status" role="status"></div>
						<div id="resultCards" class="result-grid"></div>
					</div>
				</div>
				<div class="panel">
					<h3>Chat lane</h3>
					<div id="chatLog" class="chat-log"></div>
					<form id="chatForm">
						<textarea id="chatInput" placeholder="Ask a quick public-safe follow-up..."></textarea>
						<div class="actions">
							<button class="primary-button" type="submit">Send chat</button>
							<button id="clearChatBtn" class="secondary-button" type="button">Clear chat</button>
						</div>
					</form>
				</div>
			</section>

			<section id="leadPanel" data-panel-section="lead" hidden>
				<div class="panel">
					<h3>Lead Capture</h3>
					<p class="muted">Lead capture is optional. Records use request_id, mode, and submitted contact fields. Full prompt content is not stored in the lead table.</p>
					<div class="route-list">
						<div class="route-item"><strong>Optional lead fields</strong><br />name, email, phone, business_name, location, preferred_contact</div>
						<div class="route-item"><strong>Stored in D1</strong><br /><code>request_id</code>, lead fields, selected mode, created_at</div>
						<div class="route-item"><strong>Not stored</strong><br />Full private prompt content is not written to intake_leads.</div>
						<div class="route-item"><strong>Linked request_id</strong><br />The analyze response request_id becomes the bridge from plan to lead record.</div>
					</div>
				</div>
			</section>

			<section id="adminPanel" data-panel-section="admin" hidden>
				<div class="panel">
					<h3>Export / Admin</h3>
					<p class="muted">Admin export requires ADMIN_EXPORT_TOKEN. The browser does not ask for, store, or expose the token.</p>
					<div class="route-list">
						<div class="route-item"><strong>Route</strong><br /><code>GET /admin/export/intake-leads</code></div>
						<div class="route-item"><strong>Token required</strong><br />Bearer token via configured ADMIN_EXPORT_TOKEN environment secret</div>
						<div class="route-item"><strong>CSV fields</strong><br />request_id, name, email, phone, business_name, location, preferred_contact, mode, created_at</div>
						<div class="route-item"><strong>Missing token</strong><br />503 admin export is not configured</div>
					</div>
					<div class="callout">
						<strong>Airtable Sync Queue</strong>
						<p class="muted">Leads are stored in D1 first. The sync queue is server-side, no Airtable secrets are stored in the browser, and manual sync is admin-token protected.</p>
					</div>
					<div class="route-list">
						<div class="route-item"><strong>Queue route</strong><br /><code>GET /admin/export/sync-queue</code></div>
						<div class="route-item"><strong>Sync route</strong><br /><code>POST /admin/sync/airtable</code></div>
						<div class="route-item"><strong>Required server vars</strong><br /><code>AIRTABLE_API_KEY</code>, <code>AIRTABLE_BASE_ID</code>, <code>AIRTABLE_TABLE_NAME</code>, <code>ADMIN_EXPORT_TOKEN</code></div>
						<div class="route-item"><strong>Secrets boundary</strong><br />Airtable keys stay in Worker environment secrets and are never requested by this browser UI.</div>
					</div>
					<div class="callout">
						<h3>Safe curl example</h3>
						<pre>curl.exe -H "Authorization: Bearer &lt;ADMIN_EXPORT_TOKEN&gt;" https://&lt;worker-url&gt;/admin/export/intake-leads</pre>
					</div>
				</div>
			</section>

			<section id="healthPanel" data-panel-section="health" hidden>
				<div class="panel">
					<h3>System Health</h3>
					<div class="actions">
						<button id="refreshHealthBtn" class="primary-button" type="button">Refresh health</button>
					</div>
					<div id="healthCards" class="health-grid">
						<div class="route-item"><strong>Status</strong><br /><span id="healthStatus">Not loaded</span></div>
						<div class="route-item"><strong>Admin export</strong><br /><span id="healthExport">Not loaded</span></div>
						<div class="route-item"><strong>Airtable sync</strong><br /><span id="healthAirtableSync">Not loaded</span></div>
						<div class="route-item"><strong>Routes</strong><br /><span id="healthRouteCount">Not loaded</span></div>
					</div>
					<div id="healthRoutes" class="route-list"></div>
					<details>
						<summary>Raw /health JSON</summary>
						<pre id="healthOutput">Health data has not been loaded.</pre>
					</details>
				</div>
			</section>
		</main>
	</div>
	<pre id="printOutput" class="print-output"></pre>

	<script>
		(function () {
			var STORAGE_KEY = 'branchops-intake-chat-history';
			var SESSION_KEY = 'branchops-intake-session';
			var modeDetails = {
				'General Business Asset': {
					title: 'New Intake',
					description: 'Turns an early idea into a structured BranchOps asset plan.',
					useCase: 'Use when a raw founder or business idea needs a same-day asset map.',
					helpers: ['Describe the customer and outcome.', 'Name the asset you want to create.', 'List the first practical constraint.']
				},
				'Licensing / Royalty Model': {
					title: 'Licensing Builder',
					description: 'Shapes royalty, license, and reusable rights models.',
					useCase: 'Use when an idea could become licensed IP, a royalty stream, or a repeatable rights package.',
					helpers: ['Identify what can be licensed.', 'Describe who pays and why.', 'Name exclusivity, territory, or usage questions.']
				},
				'Automation Workflow': {
					title: 'Automation Planner',
					description: 'Maps manual work into automations, systems, and triggers.',
					useCase: 'Use when repeated tasks, intake steps, or follow-up workflows should become a system.',
					helpers: ['List the current manual steps.', 'Identify trigger events and handoffs.', 'Name data that should be logged.']
				},
				'Digital Product / App': {
					title: 'Digital Product Planner',
					description: 'Frames app, tool, portal, and digital product plans.',
					useCase: 'Use when the asset might become software, a portal, an app, or a paid digital workflow.',
					helpers: ['Describe the user role.', 'Name the core action the product enables.', 'List must-have screens or outputs.']
				},
				'Content / Media Asset': {
					title: 'Content / Media Asset',
					description: 'Packages media, content, channel, and audience assets.',
					useCase: 'Use when content, education, media, or audience trust can become a business asset.',
					helpers: ['Define the audience promise.', 'List reusable content formats.', 'Name distribution and monetization paths.']
				},
				'Grant / Workforce Program': {
					title: 'Grant / Workforce Program',
					description: 'Structures workforce, grant, and program delivery assets.',
					useCase: 'Use when a program needs eligibility, partners, deliverables, funding, and compliance review.',
					helpers: ['Describe the served population.', 'List program outcomes and reporting needs.', 'Name likely funders or partners.']
				},
				'Real Estate / Property System': {
					title: 'Real Estate System',
					description: 'Plans property, asset management, and real estate systems.',
					useCase: 'Use when a property, location, lease, or operating process needs a repeatable system.',
					helpers: ['Describe the property or geography.', 'List revenue and operating assumptions.', 'Name legal, zoning, or maintenance risks.']
				},
				'Clothing / Brand / IP Asset': {
					title: 'Brand / IP Asset',
					description: 'Organizes brand, apparel, IP, and licensing pathways.',
					useCase: 'Use when a clothing, identity, design, or trademarkable idea needs structure.',
					helpers: ['Name the brand promise.', 'List products or marks involved.', 'Identify manufacturing, IP, and channel risks.']
				},
				'Food / Infused Product R&D': {
					title: 'Food / Product R&D',
					description: 'Frames product R&D, operational needs, and compliance risk.',
					useCase: 'Use when food, beverage, infused, or formulated product ideas need a safe planning frame.',
					helpers: ['Describe the product and intended market.', 'List ingredients or production assumptions.', 'Flag safety, labeling, and regulatory questions.']
				},
				'Compliance / Risk Review': {
					title: 'Compliance Review',
					description: 'Surfaces legal, privacy, tax, safety, and operating risks.',
					useCase: 'Use when an idea needs risk mapping before execution or promotion.',
					helpers: ['Describe the planned activity.', 'List sensitive data, regulated claims, or contracts.', 'Name decisions that require professional review.']
				}
			};
			var activeTitle = document.getElementById('activeTitle');
			var activeDescription = document.getElementById('activeDescription');
			var modeTitle = document.getElementById('modeTitle');
			var modeDescription = document.getElementById('modeDescription');
			var modeUseCase = document.getElementById('modeUseCase');
			var modeActiveLabel = document.getElementById('modeActiveLabel');
			var modePromptHelpers = document.getElementById('modePromptHelpers');
			var modeSelect = document.getElementById('modeSelect');
			var ideaInput = document.getElementById('ideaInput');
			var audienceInput = document.getElementById('audienceInput');
			var urgencyInput = document.getElementById('urgencyInput');
			var budgetInput = document.getElementById('budgetInput');
			var instructionsInput = document.getElementById('instructionsInput');
			var resultCards = document.getElementById('resultCards');
			var requestIdLine = document.getElementById('requestIdLine');
			var outputActionStatus = document.getElementById('outputActionStatus');
			var printOutput = document.getElementById('printOutput');
			var exportConfiguredStatus = document.getElementById('exportConfiguredStatus');
			var intakeModeCount = document.getElementById('intakeModeCount');
			var leadCaptureStatus = document.getElementById('leadCaptureStatus');
			var throttleLimit = document.getElementById('throttleLimit');
			var routeCount = document.getElementById('routeCount');
			var dashboardRoutes = document.getElementById('dashboardRoutes');
			var healthStatus = document.getElementById('healthStatus');
			var healthExport = document.getElementById('healthExport');
			var healthAirtableSync = document.getElementById('healthAirtableSync');
			var healthRouteCount = document.getElementById('healthRouteCount');
			var healthRoutes = document.getElementById('healthRoutes');
			var healthOutput = document.getElementById('healthOutput');
			var chatLog = document.getElementById('chatLog');
			var chatInput = document.getElementById('chatInput');
			var leadInputs = {
				name: document.getElementById('leadName'),
				email: document.getElementById('leadEmail'),
				phone: document.getElementById('leadPhone'),
				business_name: document.getElementById('leadBusinessName'),
				location: document.getElementById('leadLocation'),
				preferred_contact: document.getElementById('leadPreferredContact')
			};
			var resultOrder = [
				'objective',
				'classification',
				'asset',
				'execution_plan',
				'systems',
				'monetization_model',
				'automation_opportunities',
				'legal_compliance_risks',
				'scaling_path',
				'long_term_value'
			];
			var resultLabels = {
				objective: 'objective',
				classification: 'classification',
				asset: 'asset',
				execution_plan: 'execution_plan',
				systems: 'systems',
				monetization_model: 'monetization_model',
				automation_opportunities: 'automation_opportunities',
				legal_compliance_risks: 'legal_compliance_risks',
				scaling_path: 'scaling_path',
				long_term_value: 'long_term_value'
			};
			var outputFields = [
				{ key: 'request_id', title: 'Request ID', aliases: ['requestId'] },
				{ key: 'mode', title: 'Mode' },
				{ key: 'timestamp', title: 'Timestamp', aliases: ['createdAt', 'created_at'] },
				{ key: 'objective', title: 'Objective' },
				{ key: 'classification', title: 'Classification' },
				{ key: 'asset', title: 'Asset' },
				{ key: 'execution_plan', title: 'Execution Plan', aliases: ['next_actions'] },
				{ key: 'systems', title: 'Systems', aliases: ['systems_and_prompts'] },
				{ key: 'monetization_model', title: 'Monetization Model' },
				{ key: 'automation_opportunities', title: 'Automation Opportunities' },
				{ key: 'legal_compliance_risks', title: 'Legal / Compliance Risks', aliases: ['risks'] },
				{ key: 'scaling_path', title: 'Scaling Path' },
				{ key: 'long_term_value', title: 'Long-Term Value' }
			];
			var lastAnalyzeResult = null;
			var sessionId = localStorage.getItem(SESSION_KEY) || crypto.randomUUID();
			var messages = loadMessages();

			localStorage.setItem(SESSION_KEY, sessionId);

			function loadMessages() {
				try {
					var saved = localStorage.getItem(STORAGE_KEY);
					return saved ? JSON.parse(saved) : [
						{ role: 'assistant', content: 'BranchOps chat is ready for short follow-up questions.' }
					];
				} catch (error) {
					return [
						{ role: 'assistant', content: 'BranchOps chat is ready for short follow-up questions.' }
					];
				}
			}

			function persistMessages() {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
			}

			function textOrJson(value) {
				if (value === null || value === undefined) {
					return '';
				}
				if (typeof value === 'string') {
					return value;
				}
				return JSON.stringify(value, null, 2);
			}

			function cleanLabel(label) {
				return label.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().split(/\s+/).map(function (word) {
					return word.charAt(0).toUpperCase() + word.slice(1);
				}).join(' ');
			}

			function redactScalar(value) {
				return String(value).replace(/sk-[A-Za-z0-9_-]{6,}/g, '[redacted sensitive value]').replace(/[A-Z0-9_]*(TOKEN|SECRET|API_KEY|PASSWORD)[A-Z0-9_]*\s*=\s*\S+/g, '[redacted sensitive value]');
			}

			function formatOutputValue(value, depth) {
				depth = depth || 0;
				if (value === null || value === undefined || value === '') {
					return 'Not returned by backend.';
				}
				if (Array.isArray(value)) {
					return value.length ? value.map(function (item) {
						return '  '.repeat(depth) + '- ' + formatOutputValue(item, depth + 1).trimStart();
					}).join('\n') : 'Not returned by backend.';
				}
				if (typeof value === 'object') {
					var rows = Object.keys(value).filter(function (key) {
						return !/(admin.*token|token|api.*key|secret|password|credential|private.*key)/i.test(key);
					});
					if (!rows.length) {
						return 'Not returned by backend.';
					}
					return rows.map(function (key) {
						var item = value[key];
						if (item === null || typeof item !== 'object') {
							return '  '.repeat(depth) + cleanLabel(key) + ': ' + formatOutputValue(item, depth);
						}
						return '  '.repeat(depth) + cleanLabel(key) + ':\n' + formatOutputValue(item, depth + 1);
					}).join('\n');
				}
				return redactScalar(value);
			}

			function readOutputField(source, field) {
				var names = [field.key].concat(field.aliases || []);
				for (var index = 0; index < names.length; index += 1) {
					if (source && Object.prototype.hasOwnProperty.call(source, names[index])) {
						return source[names[index]];
					}
				}
				return undefined;
			}

			function outputSource(result) {
				if (!result || typeof result !== 'object') {
					return {};
				}
				var nested = result.result || result.analysis || result.data;
				if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
					return Object.assign({}, result, nested);
				}
				return result;
			}

			function formatOutputText(result) {
				var source = outputSource(result);
				return outputFields.map(function (field) {
					var value = readOutputField(source, field);
					return field.title + '\n' + formatOutputValue(value);
				}).join('\n\n');
			}

			function currentOutputText() {
				return lastAnalyzeResult ? formatOutputText(lastAnalyzeResult) : '';
			}

			async function copyResult() {
				var text = currentOutputText();
				if (!text) {
					outputActionStatus.textContent = 'Run analysis before copying a result.';
					return;
				}
				try {
					await navigator.clipboard.writeText(text);
					outputActionStatus.textContent = 'Result copied.';
				} catch (error) {
					outputActionStatus.textContent = 'Clipboard unavailable. Use Share Result instead.';
				}
			}

			async function shareResult() {
				var text = currentOutputText();
				if (!text) {
					outputActionStatus.textContent = 'Run analysis before sharing a result.';
					return;
				}
				if (navigator.share) {
					await navigator.share({ title: 'BranchOps Result', text: text });
					outputActionStatus.textContent = 'Share sheet opened.';
					return;
				}
				await copyResult();
			}

			function printResult() {
				var text = currentOutputText();
				if (!text) {
					outputActionStatus.textContent = 'Run analysis before printing a result.';
					return;
				}
				printOutput.textContent = text;
				document.body.classList.add('output-printing');
				window.print();
			}

			function downloadResult() {
				var text = currentOutputText();
				if (!text) {
					outputActionStatus.textContent = 'Run analysis before downloading a result.';
					return;
				}
				var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
				var link = document.createElement('a');
				link.href = URL.createObjectURL(blob);
				link.download = 'branchops-result.txt';
				link.click();
				URL.revokeObjectURL(link.href);
				outputActionStatus.textContent = 'TXT download prepared.';
			}

			function renderResultCards(data) {
				resultCards.innerHTML = '';
				resultOrder.forEach(function (key) {
					var card = document.createElement('article');
					card.className = 'result-card';
					var title = document.createElement('h4');
					title.textContent = resultLabels[key];
					card.appendChild(title);
					var value = data && data[key];
					if (Array.isArray(value)) {
						var list = document.createElement('ul');
						value.forEach(function (item) {
							var li = document.createElement('li');
							li.textContent = textOrJson(item);
							list.appendChild(li);
						});
						card.appendChild(list);
					} else {
						var content = document.createElement('p');
						content.textContent = textOrJson(value) || 'Pending analysis';
						card.appendChild(content);
					}
					resultCards.appendChild(card);
				});
			}

			function renderChat() {
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

			function collectLeadFields() {
				return Object.keys(leadInputs).reduce(function (payload, key) {
					var value = leadInputs[key].value.trim();
					if (value) {
						payload[key] = value;
					}
					return payload;
				}, {});
			}

			function currentMode() {
				return modeSelect.value;
			}

			function applyMode(mode) {
				if (mode && modeDetails[mode]) {
					modeSelect.value = mode;
				}
				var selectedMode = currentMode();
				var details = modeDetails[selectedMode];
				modeTitle.textContent = details.title;
				modeDescription.textContent = details.description;
				modeUseCase.textContent = details.useCase;
				modeActiveLabel.textContent = selectedMode;
				modePromptHelpers.innerHTML = '';
				details.helpers.forEach(function (helper) {
					var item = document.createElement('li');
					item.textContent = helper;
					modePromptHelpers.appendChild(item);
				});
				activeTitle.textContent = details.title;
				activeDescription.textContent = details.description;
			}

			function showPanel(panel, mode) {
				document.querySelectorAll('[data-panel-section]').forEach(function (section) {
					section.hidden = section.getAttribute('data-panel-section') !== panel;
				});
				document.querySelectorAll('[data-nav]').forEach(function (button) {
					button.classList.toggle('active', button.getAttribute('data-panel') === panel && (!mode || button.getAttribute('data-mode') === mode));
				});
				if (panel === 'intake') {
					applyMode(mode || currentMode());
				} else {
					var titleMap = {
						dashboard: 'Dashboard',
						lead: 'Lead Capture',
						admin: 'Export / Admin',
						health: 'System Health'
					};
					var descMap = {
						dashboard: 'A public-safe intake workspace for turning raw ideas into structured BranchOps asset plans.',
						lead: 'Optional follow-up fields connect request IDs to export-ready lead records.',
						admin: 'CSV export and Airtable sync metadata without exposing admin credentials.',
						health: 'Route and capability metadata from the Worker health endpoint.'
					};
					activeTitle.textContent = titleMap[panel];
					activeDescription.textContent = descMap[panel];
				}
				if (panel === 'health') {
					loadHealth();
				}
				document.body.classList.remove('sidebar-open');
			}

			async function analyzeIdea() {
				var text = ideaInput.value.trim();
				if (!text) {
					return;
				}
				requestIdLine.textContent = 'Structuring intake...';
				outputActionStatus.textContent = '';
				lastAnalyzeResult = null;
				renderResultCards({});
				try {
					var payload = Object.assign({
						input: text,
						mode: currentMode()
					}, collectLeadFields());
					if (audienceInput.value.trim()) {
						payload.audience = audienceInput.value.trim();
					}
					if (urgencyInput.value.trim()) {
						payload.urgency = urgencyInput.value.trim();
					}
					if (budgetInput.value.trim()) {
						payload.budget = budgetInput.value.trim();
					}
					if (instructionsInput.value.trim()) {
						payload.instructions = instructionsInput.value.trim();
					}
					var response = await fetch('/analyze', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload)
					});
					var body = await response.json();
					if (!response.ok || !body.ok) {
						throw new Error(body.error || 'Analyze request failed.');
					}
					requestIdLine.textContent = 'Request ID: ' + body.request_id;
					lastAnalyzeResult = Object.assign({
						mode: payload.mode,
						timestamp: new Date().toISOString()
					}, body);
					renderResultCards(body.data);
				} catch (error) {
					requestIdLine.textContent = 'Analyze error: ' + (error && error.message ? error.message : 'Unknown error');
				}
			}

			async function sendChat(text) {
				messages.push({ role: 'user', content: text });
				var pending = { role: 'assistant', content: 'Thinking...' };
				messages.push(pending);
				renderChat();
				persistMessages();
				try {
					var response = await fetch('/chat', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							sessionId: sessionId,
							instructions: 'Use intake mode: ' + currentMode() + '. Keep the response public-safe and asset-oriented.',
							messages: messages.filter(function (message) { return message !== pending; })
						})
					});
					var body = await response.json();
					if (!response.ok || !body.ok) {
						throw new Error(body.error || 'Chat request failed.');
					}
					sessionId = body.sessionId || sessionId;
					localStorage.setItem(SESSION_KEY, sessionId);
					pending.content = body.reply || 'No reply returned.';
				} catch (error) {
					pending.content = 'Error: ' + (error && error.message ? error.message : 'Unknown error');
				}
				renderChat();
				persistMessages();
			}

			async function loadHealth() {
				healthOutput.textContent = 'Loading health...';
				try {
					var response = await fetch('/health');
					var body = await response.json();
					renderHealthCards(body);
					healthOutput.textContent = JSON.stringify(body, null, 2);
				} catch (error) {
					healthOutput.textContent = 'Health request failed: ' + (error && error.message ? error.message : 'Unknown error');
				}
			}

			function renderHealthCards(body) {
				var routes = body && body.routes ? Object.keys(body.routes) : [];
				healthStatus.textContent = body && body.status ? body.status : 'unknown';
				healthExport.textContent = body && body.admin_export && body.admin_export.configured ? 'Configured' : 'Not configured';
				healthAirtableSync.textContent = body && body.airtable_sync && body.airtable_sync.configured ? 'Configured' : 'Not configured';
				healthRouteCount.textContent = String(routes.length);
				exportConfiguredStatus.textContent = body && body.admin_export && body.admin_export.configured ? 'Yes' : 'No';
				intakeModeCount.textContent = body && body.request_contracts && body.request_contracts.analyze ? String(body.request_contracts.analyze.intake_modes.length) : '10';
				leadCaptureStatus.textContent = body && body.lead_capture && body.lead_capture.enabled ? 'Enabled' : 'Off';
				throttleLimit.textContent = body && body.throttle ? body.throttle.limit + ' / ' + body.throttle.window_seconds + 's' : '30 / 60s';
				routeCount.textContent = String(routes.length || 5);
				healthRoutes.innerHTML = '';
				dashboardRoutes.innerHTML = '';
				routes.forEach(function (key) {
					var route = body.routes[key];
					var healthItem = document.createElement('div');
					healthItem.className = 'route-item';
					healthItem.innerHTML = '<strong>' + key + '</strong><br /><code>' + route + '</code>';
					healthRoutes.appendChild(healthItem);
					var dashItem = document.createElement('div');
					dashItem.className = 'route-item';
					dashItem.innerHTML = '<strong>' + route + '</strong><br />' + key.replace(/_/g, ' ');
					dashboardRoutes.appendChild(dashItem);
				});
			}

			document.querySelectorAll('[data-nav]').forEach(function (button) {
				button.addEventListener('click', function () {
					showPanel(button.getAttribute('data-panel'), button.getAttribute('data-mode'));
				});
			});

			document.getElementById('menuButton').addEventListener('click', function () {
				document.body.classList.toggle('sidebar-open');
			});

			document.getElementById('intakeForm').addEventListener('submit', function (event) {
				event.preventDefault();
				analyzeIdea();
			});

			document.getElementById('clearIntakeBtn').addEventListener('click', function () {
				ideaInput.value = '';
				audienceInput.value = '';
				urgencyInput.value = '';
				budgetInput.value = '';
				instructionsInput.value = '';
				Object.keys(leadInputs).forEach(function (key) {
					leadInputs[key].value = '';
				});
				requestIdLine.textContent = 'Request ID appears after analysis.';
				outputActionStatus.textContent = '';
				lastAnalyzeResult = null;
				renderResultCards({});
			});

			document.getElementById('chatForm').addEventListener('submit', function (event) {
				event.preventDefault();
				var text = chatInput.value.trim();
				if (!text) {
					return;
				}
				chatInput.value = '';
				sendChat(text);
			});

			document.getElementById('clearChatBtn').addEventListener('click', function () {
				localStorage.removeItem(STORAGE_KEY);
				localStorage.removeItem(SESSION_KEY);
				sessionId = crypto.randomUUID();
				localStorage.setItem(SESSION_KEY, sessionId);
				messages = [
					{ role: 'assistant', content: 'Chat cleared. Ask a short follow-up when ready.' }
				];
				renderChat();
				persistMessages();
			});

			document.getElementById('refreshHealthBtn').addEventListener('click', loadHealth);
			document.getElementById('copyResultBtn').addEventListener('click', copyResult);
			document.getElementById('shareResultBtn').addEventListener('click', shareResult);
			document.getElementById('printResultBtn').addEventListener('click', printResult);
			document.getElementById('downloadResultBtn').addEventListener('click', downloadResult);
			window.addEventListener('afterprint', function () {
				document.body.classList.remove('output-printing');
			});

			modeSelect.addEventListener('change', function () {
				applyMode(currentMode());
			});

			renderResultCards({});
			renderChat();
			applyMode(currentMode());
			loadHealth();
		})();
	</script>
</body>
</html>`;

const OUTPUT_UTILITY_HTML = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>BranchOps Output Utility</title>
	<style>
		:root { color-scheme: light; font-family: Arial, sans-serif; }
		body { margin: 0; background: #f4f7fb; color: #0f172a; }
		main { max-width: 920px; margin: 0 auto; padding: 32px 18px; }
		h1 { font-size: 28px; margin: 0 0 8px; }
		p { color: #475569; line-height: 1.5; }
		textarea { width: 100%; min-height: 180px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; font: 14px/1.45 Consolas, monospace; box-sizing: border-box; }
		button { border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; color: #0f172a; cursor: pointer; font-weight: 700; min-height: 42px; padding: 0 14px; }
		button.primary { background: #0f172a; color: #ffffff; }
		.utility-toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0; }
		.result-output { background: #ffffff; border: 1px solid #dbe3ee; border-radius: 8px; padding: 18px; white-space: pre-wrap; }
		.status { min-height: 22px; color: #1d4ed8; font-weight: 700; }
		@media print {
			body { background: #ffffff; }
			main { max-width: none; padding: 0; }
			.utility-toolbar, .result-input, .status, button { display: none !important; }
			.result-output { border: 0; padding: 0; }
		}
	</style>
</head>
<body>
<main>
	<h1>BranchOps Output Utility</h1>
	<p>Paste a BranchOps JSON result, format it as plain text, then copy, share, print, or download it.</p>
	<section class="result-input">
		<textarea id="source" aria-label="BranchOps JSON result" spellcheck="false"></textarea>
		<div class="utility-toolbar">
			<button class="primary" id="format" type="button">Format Result</button>
			<button id="copy" type="button">Copy Result</button>
			<button id="share" type="button">Share</button>
			<button id="print" type="button">Print / Save PDF</button>
			<button id="download" type="button">Download TXT</button>
		</div>
		<div class="status" id="status" role="status"></div>
	</section>
	<pre class="result-output" id="output">No formatted result yet.</pre>
</main>
<script>
	(function () {
		var fields = [
			['request_id', 'Request ID', ['requestId']],
			['mode', 'Mode'],
			['timestamp', 'Timestamp', ['createdAt', 'created_at']],
			['objective', 'Objective'],
			['classification', 'Classification'],
			['asset', 'Asset'],
			['execution_plan', 'Execution Plan', ['next_actions']],
			['systems', 'Systems', ['systems_and_prompts']],
			['monetization_model', 'Monetization Model'],
			['automation_opportunities', 'Automation Opportunities'],
			['legal_compliance_risks', 'Legal / Compliance Risks', ['risks']],
			['scaling_path', 'Scaling Path'],
			['long_term_value', 'Long-Term Value']
		];
		var source = document.getElementById('source');
		var output = document.getElementById('output');
		var status = document.getElementById('status');
		function resultSource(value) {
			if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
			var nested = value.result || value.analysis || value.data;
			if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
				return Object.assign({}, value, nested);
			}
			return value;
		}
		function label(value) {
			return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().split(/\\s+/).map(function (word) {
				return word.charAt(0).toUpperCase() + word.slice(1);
			}).join(' ');
		}
		function formatValue(value, depth) {
			depth = depth || 0;
			if (value === null || value === undefined || value === '') return 'Not returned by backend.';
			if (Array.isArray(value)) return value.length ? value.map(function (item) { return '  '.repeat(depth) + '- ' + formatValue(item, depth + 1).trimStart(); }).join('\\n') : 'Not returned by backend.';
			if (typeof value === 'object') {
				var rows = Object.keys(value).filter(function (name) { return !/(admin.*token|token|api.*key|secret|password|credential|private.*key)/i.test(name); });
				if (!rows.length) return 'Not returned by backend.';
				return rows.map(function (name) {
					var item = value[name];
					if (item === null || typeof item !== 'object') return '  '.repeat(depth) + label(name) + ': ' + formatValue(item, depth);
					return '  '.repeat(depth) + label(name) + ':\\n' + formatValue(item, depth + 1);
				}).join('\\n');
			}
			return String(value).replace(/sk-[A-Za-z0-9_-]{6,}/g, '[redacted sensitive value]').replace(/[A-Z0-9_]*(TOKEN|SECRET|API_KEY|PASSWORD)[A-Z0-9_]*\\s*=\\s*\\S+/g, '[redacted sensitive value]');
		}
		function readField(sourceValue, field) {
			var names = [field[0]].concat(field[2] || []);
			for (var index = 0; index < names.length; index += 1) {
				if (Object.prototype.hasOwnProperty.call(sourceValue, names[index])) return sourceValue[names[index]];
			}
			return undefined;
		}
		function formatResult() {
			var value;
			try {
				value = JSON.parse(source.value || '{}');
			} catch {
				status.textContent = 'Enter valid JSON before formatting.';
				return;
			}
			var data = resultSource(value);
			output.textContent = fields.map(function (field) { return field[1] + '\\n' + formatValue(readField(data, field)); }).join('\\n\\n');
			status.textContent = 'Formatted plain text is ready.';
		}
		async function copyResult() {
			formatResult();
			try {
				await navigator.clipboard.writeText(output.textContent);
				status.textContent = 'Copied.';
			} catch {
				source.value = output.textContent;
				source.focus();
				source.select();
				status.textContent = 'Copy from the selected text.';
			}
		}
		async function shareResult() {
			formatResult();
			if (navigator.share) {
				await navigator.share({ title: 'BranchOps Result', text: output.textContent });
				status.textContent = 'Share sheet opened.';
				return;
			}
			await copyResult();
		}
		function downloadResult() {
			formatResult();
			var blob = new Blob([output.textContent], { type: 'text/plain;charset=utf-8' });
			var link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = 'branchops-result.txt';
			link.click();
			URL.revokeObjectURL(link.href);
			status.textContent = 'TXT file prepared.';
		}
		document.getElementById('format').addEventListener('click', formatResult);
		document.getElementById('copy').addEventListener('click', copyResult);
		document.getElementById('share').addEventListener('click', shareResult);
		document.getElementById('print').addEventListener('click', function () { formatResult(); window.print(); });
		document.getElementById('download').addEventListener('click', downloadResult);
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

async function persistIntakeLead(
	env: Env,
	requestId: string,
	mode: string,
	lead: LeadFields,
): Promise<void> {
	if (!hasLeadFields(lead)) {
		return;
	}

	try {
		await env.hello_ai_prod.batch([
			env.hello_ai_prod
				.prepare(
					[
						"INSERT INTO intake_leads",
						"(request_id, name, email, phone, business_name, location, preferred_contact, mode)",
						"VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
					].join(" "),
				)
				.bind(
					requestId,
					lead.name ?? null,
					lead.email ?? null,
					lead.phone ?? null,
					lead.business_name ?? null,
					lead.location ?? null,
					lead.preferred_contact ?? null,
					mode,
				),
		]);
		await persistLeadSyncQueueItem(env, requestId);
	} catch (error) {
		console.error("Failed to persist intake lead.", error);
	}
}

async function persistLeadSyncQueueItem(
	env: Env,
	requestId: string,
): Promise<void> {
	try {
		await env.hello_ai_prod.batch([
			env.hello_ai_prod
				.prepare(
					[
						"INSERT INTO lead_sync_queue",
						"(request_id, destination, status, attempts)",
						"VALUES (?, ?, ?, ?)",
					].join(" "),
				)
				.bind(requestId, AIRTABLE_DESTINATION, "queued", 0),
		]);
	} catch (error) {
		console.error("Failed to enqueue Airtable lead sync.", error);
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

function queueIntakeLead(
	ctx: ExecutionContext,
	env: Env,
	requestId: string,
	mode: string,
	lead: LeadFields,
): void {
	ctx.waitUntil(persistIntakeLead(env, requestId, mode, lead));
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

function csvEscape(value: unknown): string {
	const text = value === null || value === undefined ? "" : String(value);
	return `"${text.replace(/"/g, '""')}"`;
}

function csvResponse(
	rows: LeadExportRow[],
	requestId: string,
	init?: ResponseInit,
): Response {
	const headers = new Headers(init?.headers);
	for (const [key, value] of Object.entries(corsHeaders())) {
		headers.set(key, value);
	}
	headers.set("Content-Type", "text/csv; charset=utf-8");
	headers.set("Content-Disposition", 'attachment; filename="branchops-intake-leads.csv"');
	headers.set("X-Request-Id", requestId);

	const columns = [
		"request_id",
		"name",
		"email",
		"phone",
		"business_name",
		"location",
		"preferred_contact",
		"mode",
		"created_at",
	] as const;
	const lines = [
		columns.join(","),
		...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
	];

	return new Response(lines.join("\n"), {
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

function validateLeadTextField(
	value: unknown,
	fieldName: keyof LeadFields,
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

	const limit = LEAD_FIELD_LIMITS[fieldName];
	if (text.length > limit) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				`'${fieldName}' exceeds ${limit} characters.`,
				requestId,
			),
		};
	}

	return { ok: true, value: text };
}

function validateEmailField(
	value: unknown,
	route: string,
	requestId: string,
): { ok: true; value?: string } | { ok: false; response: Response } {
	const email = validateLeadTextField(value, "email", route, requestId);
	if (!email.ok || !email.value) {
		return email;
	}

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				"'email' must be a valid email address when provided.",
				requestId,
			),
		};
	}

	return email;
}

function validatePhoneField(
	value: unknown,
	route: string,
	requestId: string,
): { ok: true; value?: string } | { ok: false; response: Response } {
	const phone = validateLeadTextField(value, "phone", route, requestId);
	if (!phone.ok || !phone.value) {
		return phone;
	}

	if (!/^[0-9A-Za-z+().\-\s]+$/.test(phone.value)) {
		return {
			ok: false,
			response: errorResponse(
				route,
				400,
				"'phone' contains unsupported characters.",
				requestId,
			),
		};
	}

	return phone;
}

function hasLeadFields(lead: LeadFields): boolean {
	return Object.values(lead).some((value) => Boolean(value));
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

	const name = validateLeadTextField(
		parsed.body.name,
		"name",
		ROUTES.analyze,
		requestId,
	);
	if (!name.ok) {
		return name;
	}

	const email = validateEmailField(parsed.body.email, ROUTES.analyze, requestId);
	if (!email.ok) {
		return email;
	}

	const phone = validatePhoneField(parsed.body.phone, ROUTES.analyze, requestId);
	if (!phone.ok) {
		return phone;
	}

	const businessName = validateLeadTextField(
		parsed.body.business_name,
		"business_name",
		ROUTES.analyze,
		requestId,
	);
	if (!businessName.ok) {
		return businessName;
	}

	const location = validateLeadTextField(
		parsed.body.location,
		"location",
		ROUTES.analyze,
		requestId,
	);
	if (!location.ok) {
		return location;
	}

	const preferredContact = validateLeadTextField(
		parsed.body.preferred_contact,
		"preferred_contact",
		ROUTES.analyze,
		requestId,
	);
	if (!preferredContact.ok) {
		return preferredContact;
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
			lead: {
				name: name.value,
				email: email.value,
				phone: phone.value,
				business_name: businessName.value,
				location: location.value,
				preferred_contact: preferredContact.value,
			},
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

function handleHealth(requestId: string, env: Env): Response {
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
			admin_export_intake_leads: "GET /admin/export/intake-leads",
			admin_export_sync_queue: "GET /admin/export/sync-queue",
			admin_sync_airtable: "POST /admin/sync/airtable",
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
			{
				path: ROUTES.adminExportIntakeLeads,
				method: "GET",
				purpose: "Export captured intake leads when admin export is configured.",
			},
			{
				path: ROUTES.adminExportSyncQueue,
				method: "GET",
				purpose: "Export server-side lead sync queue records when admin export is configured.",
			},
			{
				path: ROUTES.adminSyncAirtable,
				method: "POST",
				purpose: "Manually sync queued lead records to Airtable from the Worker runtime.",
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
					"name",
					"email",
					"phone",
					"business_name",
					"location",
					"preferred_contact",
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
		lead_capture: {
			enabled: true,
			fields: Object.keys(LEAD_FIELD_LIMITS),
			field_limits: LEAD_FIELD_LIMITS,
			stores_full_prompt: false,
			sync_queue_destination: AIRTABLE_DESTINATION,
		},
		admin_export: {
			route: ROUTES.adminExportIntakeLeads,
			configured: Boolean(env.ADMIN_EXPORT_TOKEN),
			auth: "Bearer token via ADMIN_EXPORT_TOKEN",
			content_type: "text/csv",
		},
		airtable_sync: {
			enabled: true,
			configured: isAirtableSyncConfigured(env),
			required_vars: AIRTABLE_REQUIRED_ENV_VARS,
			routes: {
				queue_export: "GET /admin/export/sync-queue",
				manual_sync: "POST /admin/sync/airtable",
			},
			destination: AIRTABLE_DESTINATION,
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
		pathname === ROUTES.root ||
		pathname === ROUTES.outputUtility ||
		pathname === ROUTES.health ||
		pathname === ROUTES.adminExportIntakeLeads ||
		pathname === ROUTES.adminExportSyncQueue
			? "GET"
			: "POST";
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
				"GET /admin/export/intake-leads",
				"GET /admin/export/sync-queue",
				"POST /admin/sync/airtable",
			],
		},
		requestId,
		{ status: 404 },
	);
}

function getBearerToken(request: Request): string | null {
	const authorization = request.headers.get("authorization");
	if (!authorization) {
		return null;
	}

	const [scheme, token] = authorization.split(/\s+/, 2);
	if (scheme?.toLowerCase() !== "bearer" || !token) {
		return null;
	}

	return token;
}

function getAdminAuthorizationError(
	request: Request,
	env: Env,
	route: string,
	requestId: string,
): Response | null {
	if (!env.ADMIN_EXPORT_TOKEN) {
		return errorResponse(
			route,
			503,
			"Admin export is not configured.",
			requestId,
			{
				required_env_var: "ADMIN_EXPORT_TOKEN",
			},
		);
	}

	if (getBearerToken(request) !== env.ADMIN_EXPORT_TOKEN) {
		return errorResponse(route, 401, "Unauthorized.", requestId);
	}

	return null;
}

function getMissingAirtableEnvVars(env: Env): string[] {
	return AIRTABLE_REQUIRED_ENV_VARS.filter((name) => {
		if (name === "AIRTABLE_API_KEY") {
			return !env.AIRTABLE_API_KEY;
		}
		if (name === "AIRTABLE_BASE_ID") {
			return !env.AIRTABLE_BASE_ID;
		}
		return !env.AIRTABLE_TABLE_NAME;
	});
}

function isAirtableSyncConfigured(env: Env): boolean {
	return getMissingAirtableEnvVars(env).length === 0;
}

async function handleAdminExportIntakeLeads(
	request: Request,
	env: Env,
	requestId: string,
): Promise<Response> {
	const authError = getAdminAuthorizationError(
		request,
		env,
		ROUTES.adminExportIntakeLeads,
		requestId,
	);
	if (authError) {
		return authError;
	}

	try {
		const result = await env.hello_ai_prod
			.prepare(
				[
					"SELECT request_id, name, email, phone, business_name, location, preferred_contact, mode, created_at",
					"FROM intake_leads",
					"ORDER BY created_at DESC",
				].join(" "),
			)
			.all<LeadExportRow>();

		return csvResponse(result.results ?? [], requestId);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return errorResponse(
			ROUTES.adminExportIntakeLeads,
			500,
			message,
			requestId,
		);
	}
}

async function handleAdminExportSyncQueue(
	request: Request,
	env: Env,
	requestId: string,
): Promise<Response> {
	const authError = getAdminAuthorizationError(
		request,
		env,
		ROUTES.adminExportSyncQueue,
		requestId,
	);
	if (authError) {
		return authError;
	}

	try {
		const result = await env.hello_ai_prod
			.prepare(
				[
					"SELECT id, request_id, destination, status, attempts, last_error, created_at, updated_at",
					"FROM lead_sync_queue",
					"ORDER BY created_at DESC",
				].join(" "),
			)
			.all<LeadSyncQueueRecord>();

		return jsonResponse(
			{
				ok: true,
				data: {
					records: result.results ?? [],
				},
			},
			requestId,
		);
	} catch (error) {
		console.error("Failed to export sync queue.", error);
		return errorResponse(
			ROUTES.adminExportSyncQueue,
			500,
			"Sync queue export failed.",
			requestId,
		);
	}
}

async function getQueuedAirtableSyncRows(env: Env): Promise<AirtableLeadSyncRow[]> {
	const result = await env.hello_ai_prod
		.prepare(
			[
				"SELECT",
				"q.id, q.request_id, q.destination, q.status, q.attempts, q.last_error, q.created_at, q.updated_at,",
				"l.name, l.email, l.phone, l.business_name, l.location, l.preferred_contact, l.mode, l.created_at AS lead_created_at",
				"FROM lead_sync_queue q",
				"LEFT JOIN intake_leads l ON l.request_id = q.request_id",
				"WHERE q.destination = ? AND q.status = ?",
				"ORDER BY q.created_at ASC",
				"LIMIT ?",
			].join(" "),
		)
		.bind(AIRTABLE_DESTINATION, "queued", AIRTABLE_SYNC_BATCH_LIMIT)
		.all<AirtableLeadSyncRow>();

	return result.results ?? [];
}

function buildAirtablePayload(rows: AirtableLeadSyncRow[]): Record<string, unknown> {
	return {
		records: rows.map((row) => ({
			fields: {
				"Request ID": row.request_id,
				Name: row.name ?? "",
				Email: row.email ?? "",
				Phone: row.phone ?? "",
				"Business Name": row.business_name ?? "",
				Location: row.location ?? "",
				"Preferred Contact": row.preferred_contact ?? "",
				Mode: row.mode ?? "",
				"Created At": row.lead_created_at ?? row.created_at,
			},
		})),
	};
}

async function updateLeadSyncQueueStatus(
	env: Env,
	ids: number[],
	status: "synced" | "error",
	lastError: string | null,
): Promise<void> {
	if (ids.length === 0) {
		return;
	}

	const updatedAt = new Date().toISOString();
	await env.hello_ai_prod.batch(
		ids.map((id) =>
			env.hello_ai_prod
				.prepare(
					"UPDATE lead_sync_queue SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?",
				)
				.bind(status, lastError, updatedAt, id),
		),
	);
}

async function handleAdminSyncAirtable(
	request: Request,
	env: Env,
	requestId: string,
): Promise<Response> {
	const authError = getAdminAuthorizationError(
		request,
		env,
		ROUTES.adminSyncAirtable,
		requestId,
	);
	if (authError) {
		return authError;
	}

	const missingEnvVars = getMissingAirtableEnvVars(env);
	if (missingEnvVars.length > 0) {
		return errorResponse(
			ROUTES.adminSyncAirtable,
			503,
			"Airtable sync is not configured.",
			requestId,
			{
				required_env_vars: AIRTABLE_REQUIRED_ENV_VARS,
				missing_env_vars: missingEnvVars,
			},
		);
	}

	const summary: AirtableSyncSummary = {
		processed: 0,
		synced: 0,
		failed: 0,
		skipped: 0,
	};

	try {
		const rows = await getQueuedAirtableSyncRows(env);
		summary.processed = rows.length;

		const missingLeadRows = rows.filter((row) => !row.lead_created_at);
		if (missingLeadRows.length > 0) {
			await updateLeadSyncQueueStatus(
				env,
				missingLeadRows.map((row) => row.id),
				"error",
				"No matching intake_leads record.",
			);
			summary.skipped = missingLeadRows.length;
		}

		const syncRows = rows.filter((row) => row.lead_created_at);
		if (syncRows.length === 0) {
			return jsonResponse({ ok: true, data: { summary } }, requestId);
		}

		const airtableUrl = `https://api.airtable.com/v0/${encodeURIComponent(
			env.AIRTABLE_BASE_ID!,
		)}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME!)}`;
		const airtablePayload = buildAirtablePayload(syncRows);
		const syncRowIds = syncRows.map((row) => row.id);

		let airtableResponse: Response;
		try {
			airtableResponse = await fetch(airtableUrl, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.AIRTABLE_API_KEY}`,
					"Content-Type": REQUEST_CONTENT_TYPE,
				},
				body: JSON.stringify(airtablePayload),
			});
		} catch (error) {
			console.error("Airtable sync request failed.", error);
			await updateLeadSyncQueueStatus(
				env,
				syncRowIds,
				"error",
				"Airtable API request failed.",
			);
			summary.failed = syncRows.length;
			return jsonResponse({ ok: true, data: { summary } }, requestId);
		}

		if (!airtableResponse.ok) {
			await updateLeadSyncQueueStatus(
				env,
				syncRowIds,
				"error",
				`Airtable API returned HTTP ${airtableResponse.status}.`,
			);
			summary.failed = syncRows.length;
			return jsonResponse({ ok: true, data: { summary } }, requestId);
		}

		await updateLeadSyncQueueStatus(env, syncRowIds, "synced", null);
		summary.synced = syncRows.length;
		return jsonResponse({ ok: true, data: { summary } }, requestId);
	} catch (error) {
		console.error("Airtable sync failed.", error);
		return errorResponse(
			ROUTES.adminSyncAirtable,
			500,
			"Airtable sync failed.",
			requestId,
		);
	}
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

		if (request.method === "GET" && url.pathname === ROUTES.outputUtility) {
			return htmlResponse(OUTPUT_UTILITY_HTML);
		}

		if (request.method === "GET" && url.pathname === ROUTES.health) {
			return handleHealth(requestId, env);
		}

		if (
			request.method === "GET" &&
			url.pathname === ROUTES.adminExportIntakeLeads
		) {
			return handleAdminExportIntakeLeads(request, env, requestId);
		}

		if (
			request.method === "GET" &&
			url.pathname === ROUTES.adminExportSyncQueue
		) {
			return handleAdminExportSyncQueue(request, env, requestId);
		}

		if (request.method === "POST" && url.pathname === ROUTES.adminSyncAirtable) {
			return handleAdminSyncAirtable(request, env, requestId);
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
				queueIntakeLead(
					ctx,
					env,
					requestId,
					getAnalyzeMode(parsedBody.body),
					parsedBody.body.lead,
				);

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
			url.pathname === ROUTES.outputUtility ||
			url.pathname === ROUTES.health ||
			url.pathname === ROUTES.chat ||
			url.pathname === ROUTES.analyze ||
			url.pathname === ROUTES.adminExportIntakeLeads ||
			url.pathname === ROUTES.adminExportSyncQueue ||
			url.pathname === ROUTES.adminSyncAirtable
		) {
			return handleMethodNotAllowed(url.pathname, requestId);
		}

		return handleNotFound(requestId);
	},
} satisfies ExportedHandler<Env>;
