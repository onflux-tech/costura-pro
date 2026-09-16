import { execFileSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmdirSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Claude é a ferramenta padrão: `.agents/agents` e `.mcp.json` são as fontes;
// as portas de Claude e Codex são geradas para não divergirem à mão.
export const ROLE_MODELS = {
	contract: {
		claude: "opus",
		codex: { effort: "high", model: "gpt-5.6-terra" },
	},
	explorer: {
		claude: "sonnet",
		codex: { effort: "medium", model: "gpt-5.6-luna" },
	},
	reviewer: {
		claude: "opus",
		codex: { effort: "high", model: "gpt-5.6-terra" },
	},
};

const CODEX_SESSION = {
	effort: "medium",
	maxThreads: 2,
	model: "gpt-5.6-terra",
	subagentEffort: "medium",
	subagentModel: "gpt-5.6-luna",
};

const CLAUDE_TOOLS = "Read, Grep, Glob";
// Symlink vira arquivo de texto num clone Windows sem Developer Mode, então as
// portas são cópias reais e estes diretórios pertencem só ao gerador.
const GENERATED_DIRS = [".claude/agents", ".codex/agents", ".claude/skills"];
const PORT_PARENTS = [".claude", ".codex"];
const PORT_PATHS = [...GENERATED_DIRS, ".codex/config.toml"];
const MCP_FIELDS = new Set(["args", "command", "env", "type", "url"]);
const MCP_NAME = /^[A-Za-z0-9_-]+$/;
const QUOTED = /^["']/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const FRONTMATTER_FIELD = /^([a-z]+):\s*(.*)$/;
const LINE_BREAK = /\r?\n/;
const CRLF = /\r\n/g;
const SKILLS_SOURCE = ".agents/skills/";

function tomlString(value) {
	return JSON.stringify(value);
}

function parseRole(root, role) {
	const source = `.agents/agents/${role}/agent.md`;
	const text = readFileSync(join(root, source), "utf8");
	const match = text.match(FRONTMATTER);
	if (!match) {
		throw new Error(`${source}: frontmatter ausente`);
	}
	const fields = {};
	for (const line of match[1].split(LINE_BREAK)) {
		const field = line.match(FRONTMATTER_FIELD);
		if (field) {
			fields[field[1]] = field[2].trim();
		}
	}
	if (fields.name !== role || !fields.description) {
		throw new Error(
			`${source}: name deve ser ${role} e description é obrigatória`
		);
	}
	if (QUOTED.test(fields.description)) {
		throw new Error(`${source}: description sem aspas na fonte`);
	}
	const body = text.slice(match[0].length).replace(CRLF, "\n").trim();
	if (body.includes("'''")) {
		throw new Error(`${source}: corpo não pode conter '''`);
	}
	return { body, description: fields.description, source };
}

function claudeAgent(role, { body, description, source }) {
	return [
		"---",
		`# Gerado por pnpm harness:sync a partir de ${source}`,
		`name: ${role}`,
		`description: ${JSON.stringify(description)}`,
		`model: ${ROLE_MODELS[role].claude}`,
		`tools: ${CLAUDE_TOOLS}`,
		"---",
		"",
		body,
		"",
	].join("\n");
}

function codexAgent(role, { body, description, source }) {
	const { effort, model } = ROLE_MODELS[role].codex;
	return [
		`# Gerado por pnpm harness:sync a partir de ${source}`,
		`name = ${tomlString(role)}`,
		`description = ${tomlString(description)}`,
		`model = ${tomlString(model)}`,
		`model_reasoning_effort = ${tomlString(effort)}`,
		'sandbox_mode = "read-only"',
		`developer_instructions = '''\n${body}\n'''`,
		"",
	].join("\n");
}

function mcpServerLines(name, server) {
	const unsupported = Object.keys(server).filter(
		(field) => !MCP_FIELDS.has(field)
	);
	if (unsupported.length > 0) {
		throw new Error(
			`.mcp.json: ${name} usa campos sem porta Codex (${unsupported.join(", ")})`
		);
	}
	const lines = [];
	if (server.url) {
		lines.push(`url = ${tomlString(server.url)}`);
	}
	if (server.command) {
		lines.push(`command = ${tomlString(server.command)}`);
	}
	if (server.args) {
		lines.push(`args = [${server.args.map(tomlString).join(", ")}]`);
	}
	if (server.env) {
		const pairs = Object.entries(server.env).map(
			([key, value]) => `${key} = ${tomlString(value)}`
		);
		lines.push(`env = { ${pairs.join(", ")} }`);
	}
	return lines;
}

function codexConfig(root) {
	const mcp = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"));
	const lines = [
		"# Gerado por pnpm harness:sync a partir de .mcp.json e scripts/harness.mjs",
		`model = ${tomlString(CODEX_SESSION.model)}`,
		`model_reasoning_effort = ${tomlString(CODEX_SESSION.effort)}`,
		"",
		"[agents]",
		"enabled = true",
		`max_concurrent_threads_per_session = ${CODEX_SESSION.maxThreads}`,
		`default_subagent_model = ${tomlString(CODEX_SESSION.subagentModel)}`,
		`default_subagent_reasoning_effort = ${tomlString(CODEX_SESSION.subagentEffort)}`,
	];
	for (const [name, server] of Object.entries(mcp.mcpServers ?? {})) {
		if (!MCP_NAME.test(name)) {
			throw new Error(
				`.mcp.json: nome de servidor inválido (${name}); use letras, números, - ou _`
			);
		}
		lines.push("", `[mcp_servers.${name}]`, ...mcpServerLines(name, server));
	}
	return `${lines.join("\n")}\n`;
}

function listFiles(root, relativeDir) {
	const directory = join(root, relativeDir);
	if (!existsSync(directory)) {
		return [];
	}
	const files = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = `${relativeDir}/${entry.name}`;
		if (entry.isSymbolicLink()) {
			files.push({ path, symlink: true });
		} else if (entry.isDirectory()) {
			files.push(...listFiles(root, path));
		} else {
			files.push({ path, symlink: false });
		}
	}
	return files;
}

function sourceRoles(root) {
	return readdirSync(join(root, ".agents/agents"), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

export function buildHarness(root) {
	for (const role of sourceRoles(root)) {
		if (!(role in ROLE_MODELS)) {
			throw new Error(
				`.agents/agents/${role}: papel sem modelos em scripts/harness.mjs`
			);
		}
	}
	const expected = new Map();
	for (const role of Object.keys(ROLE_MODELS)) {
		const parsed = parseRole(root, role);
		expected.set(
			`.claude/agents/${role}.md`,
			Buffer.from(claudeAgent(role, parsed))
		);
		expected.set(
			`.codex/agents/${role}.toml`,
			Buffer.from(codexAgent(role, parsed))
		);
	}
	expected.set(".codex/config.toml", Buffer.from(codexConfig(root)));
	for (const file of listFiles(root, ".agents/skills")) {
		if (file.symlink) {
			throw new Error(`${file.path}: fonte de skill não pode ser symlink`);
		}
		const target = `.claude/skills/${file.path.slice(SKILLS_SOURCE.length)}`;
		expected.set(target, readFileSync(join(root, file.path)));
	}
	return expected;
}

function sameContent(actual, wanted) {
	if (actual.includes(0) || wanted.includes(0)) {
		return actual.equals(wanted);
	}
	const normalize = (buffer) => buffer.toString("utf8").replace(CRLF, "\n");
	return normalize(actual) === normalize(wanted);
}

export function checkHarness(root = process.cwd()) {
	let expected;
	try {
		expected = buildHarness(root);
	} catch (error) {
		return [error.message];
	}
	const issues = [];
	for (const [path, wanted] of expected) {
		const absolute = join(root, path);
		if (!existsSync(absolute)) {
			issues.push(`${path}: ausente`);
		} else if (!sameContent(readFileSync(absolute), wanted)) {
			issues.push(`${path}: diverge da fonte`);
		}
	}
	for (const directory of GENERATED_DIRS) {
		const problem = structureProblem(root, directory);
		if (problem) {
			issues.push(problem);
			continue;
		}
		for (const file of listFiles(root, directory)) {
			if (file.symlink) {
				issues.push(`${file.path}: symlink não é permitido`);
			} else if (!expected.has(file.path)) {
				issues.push(`${file.path}: sobrando`);
			}
		}
	}
	return [...new Set(issues)];
}

// Um diretório gerado em symlink passa pelo check lendo o alvo, mas vira arquivo
// de texto num clone Windows; por isso cada segmento do caminho é conferido.
function structureProblem(root, relativeDir) {
	const segments = relativeDir.split("/");
	for (const [index] of segments.entries()) {
		const path = segments.slice(0, index + 1).join("/");
		const absolute = join(root, path);
		if (!existsSync(absolute)) {
			return null;
		}
		const stats = lstatSync(absolute);
		if (stats.isSymbolicLink()) {
			return `${path}: symlink não é permitido`;
		}
		if (!stats.isDirectory()) {
			return `${path}: não é diretório`;
		}
	}
	return null;
}

// O hook de commit precisa garantir que a porta regenerada entrou no stage junto
// com a fonte; o check comum só enxerga o disco.
export function unstagedPortIssues(root = process.cwd()) {
	const output = execFileSync(
		"git",
		[
			"status",
			"--porcelain=v1",
			"-z",
			"--untracked-files=all",
			"--",
			...PORT_PATHS,
		],
		{ cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
	);
	const entries = output.split("\0");
	const issues = [];
	let skipOriginalPath = false;
	for (const entry of entries) {
		// Renomeação e cópia trazem o caminho de origem no token seguinte.
		if (skipOriginalPath || entry.length < 4) {
			skipOriginalPath = false;
			continue;
		}
		const status = entry.slice(0, 2);
		skipOriginalPath = status[0] === "R" || status[0] === "C";
		if (status === "??" || status[1] !== " ") {
			issues.push(`${entry.slice(3)}: porta gerada fora do commit`);
		}
	}
	return issues;
}

function removeGenerated(absolute) {
	if (!existsSync(absolute)) {
		return;
	}
	if (lstatSync(absolute).isSymbolicLink()) {
		try {
			unlinkSync(absolute);
		} catch {
			rmdirSync(absolute);
		}
		return;
	}
	rmSync(absolute, { force: true, recursive: true });
}

export function syncHarness(root = process.cwd()) {
	const expected = buildHarness(root);
	for (const parent of PORT_PARENTS) {
		const problem = structureProblem(root, parent);
		if (problem) {
			throw new Error(`${problem}; corrija à mão antes do sync`);
		}
	}
	for (const directory of GENERATED_DIRS) {
		removeGenerated(join(root, directory));
	}
	for (const [path, content] of expected) {
		const absolute = join(root, path);
		mkdirSync(dirname(absolute), { recursive: true });
		writeFileSync(absolute, content);
	}
	return [...expected.keys()];
}

function runCli([command, ...flags]) {
	const rootIndex = flags.indexOf("--root");
	const root =
		rootIndex !== -1 && flags[rootIndex + 1]
			? resolve(flags[rootIndex + 1])
			: process.cwd();
	if (command === "sync") {
		const written = syncHarness(root);
		process.stdout.write(`Harness gerado: ${written.length} arquivos.\n`);
		return 0;
	}
	if (command === "check") {
		const issues = checkHarness(root);
		if (flags.includes("--staged")) {
			issues.push(...unstagedPortIssues(root));
		}
		if (issues.length === 0) {
			process.stdout.write("Harness consistente.\n");
			return 0;
		}
		process.stderr.write(
			`Harness divergente (rode pnpm harness:sync e inclua as portas no commit):\n${issues.map((issue) => `- ${issue}`).join("\n")}\n`
		);
		return 1;
	}
	process.stderr.write(
		"Uso: node scripts/harness.mjs <sync|check> [--staged] [--root DIRETORIO]\n"
	);
	return 2;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	process.exitCode = runCli(process.argv.slice(2));
}
