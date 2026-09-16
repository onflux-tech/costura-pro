import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import {
	isEntrypoint,
	projectRoot,
	readHookInput,
	repoRelative,
} from "./session.mjs";

// Com este arquivo presente, o guard global do dono (~/.claude/hooks/bash-guard.js)
// deixa de rodar neste repositório; por isso as regras dele estão todas aqui.
// Início de comando: prefixos de shell que não mudam o que roda (laço, env, npx e afins).
const LEAD =
	"^\\s*(?:\\(\\s*)?(?:(?:do|then|else|time)\\s+)?(?:\\w+=\\S*\\s+)*(?:(?:npx|bunx|pnpm\\s+(?:exec|dlx)|yarn\\s+dlx)\\s+)?";
const TEST_RUNNER = new RegExp(
	`${LEAD}(?:(?:bun|pnpm|npm|yarn)\\b[^|]*?\\s(?:run\\s+)?(?:harness:)?test(?![\\w-])|turbo\\s+(?:run\\s+)?test\\b|node\\s+(?:[^|]*\\s)?--test\\b|vitest\\b|jest\\b)`,
	"i"
);
const PIPE_READER =
	/^\s*(?:tail|head|grep|rg|less|more|select-string|sls|select-object|select|findstr)\b/i;
const DB_PUSH = new RegExp(
	`${LEAD}(?:(?:bun|pnpm|npm|yarn|turbo)\\b[^|]*?\\s(?:run\\s+)?db:push\\b|drizzle-kit\\s+push\\b)`,
	"i"
);
const GIT_PUSH = /^\s*git\s+push\b(.*)$/i;
const WHITESPACE = /\s+/;
const SHORT_FORCE = /^-[a-z]*f[a-z]*$/i;
const PROTECTED = new Set(["main", "develop", "production"]);
const HEADS_PREFIX = /^refs\/heads\//;

const PIPE_MESSAGE =
	"BLOQUEADO: suíte de teste com pipe para tail/head/grep/Select-Object trava a sessão. Redirecione para arquivo (> test.log 2>&1) e leia com Read ou Grep.";
const FORCE_MESSAGE =
	"BLOQUEADO: force-push em branch protegida (main, develop, production), inclusive com --force-with-lease ou refspec com +. Se for intencional, o dono roda manualmente.";
const DB_PUSH_MESSAGE =
	"BLOQUEADO: db:push e drizzle-kit push reescrevem o banco sem migration. Use pnpm db:generate e pnpm db:migrate.";

const COMMAND_RULES = [
	{
		message:
			"BLOQUEADO: kill geral de node derruba dev servers do dono. Encontre o PID do processo certo e mate só ele.",
		pattern:
			/Stop-Process\b[^|;\n]*\bnode\b|taskkill\b[^\n]*\/im\s+node(?:\.exe)?\b|\bpkill\b[^\n]*\bnode\b/i,
	},
	{
		message:
			"BLOQUEADO: --no-verify pula os hooks do Lefthook e é proibido sem pedido explícito do dono.",
		pattern: /git\s+(?:commit|push)\b[^\n]*--no-verify\b/i,
	},
	{
		message:
			"BLOQUEADO: o trailer Claude-Session é proibido em commit. Use só o subject em conventional commits.",
		pattern: /git\s+commit\b[^\n]*Claude-Session/i,
	},
	{
		message:
			"BLOQUEADO: Co-Authored-By é proibido em commit neste repositório.",
		pattern: /git\s+commit\b[^\n]*Co-Authored-By/i,
	},
	{
		message: "BLOQUEADO: rm -rf na raiz ou no home.",
		pattern: /rm\s+-[a-z]*r[a-z]*f?[a-z]*\s+["']?(?:\/|~\/?)["']?(?:\s|$)/i,
	},
	{
		message: "BLOQUEADO: Remove-Item -Recurse na raiz de um drive.",
		pattern:
			/Remove-Item\b[^\n]*-Recurse\b[^\n]*\s["']?[A-Za-z]:[\\/]["']?(?:\s|$)/,
	},
];

const COMMAND_SEPARATOR = /;|&&|\|\||\r?\n/;
const DASH = /[\u2013\u2014]/g;
const DASH_MESSAGE =
	"BLOQUEADO: travessão (U+2014) ou meia-risca (U+2013). Use vírgula, dois-pontos, parênteses ou ponto.";
const COMMIT_OR_PR = /\bgit\s+commit\b|\bgh\s+pr\s+(?:create|edit)\b/i;
// Sem flag i: -F só é arquivo de mensagem depois de git commit; -f de git add ou rm não conta.
const MESSAGE_FILES = [
	/\bgit\s+commit\b[^;&|\n]*?\s(?:-F|--file)(?:\s+|=)("[^"]+"|'[^']+'|\S+)/,
	/\bgh\s+pr\s+(?:create|edit)\b[^;&|\n]*?\s--body-file(?:\s+|=)("[^"]+"|'[^']+'|\S+)/,
];
const QUOTES = /^["']|["']$/g;
const GENERATED_PORT = /^(?:\.claude\/agents\/|\.claude\/skills\/|\.codex\/)/;
const MARKDOWN = /\.md$/i;
const VENDORED_SKILLS = /^(?:\.agents|\.claude)\/skills\//;

const countDashes = (text) => (String(text ?? "").match(DASH) ?? []).length;

function messageFileText(command, root) {
	let text = "";
	for (const pattern of MESSAGE_FILES) {
		const match = command.match(pattern);
		if (!match) {
			continue;
		}
		const path = match[1].replace(QUOTES, "");
		const absolute = isAbsolute(path) ? path : resolve(root, path);
		if (existsSync(absolute) && statSync(absolute).isFile()) {
			text += readFileSync(absolute, "utf8");
		}
	}
	return text;
}

function currentBranch(root) {
	try {
		return execFileSync("git", ["branch", "--show-current"], {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return "";
	}
}

function isProtectedForcePush(statement, root) {
	const match = statement.match(GIT_PUSH);
	if (!match) {
		return false;
	}
	const tokens = match[1]
		.trim()
		.split(WHITESPACE)
		.filter(Boolean)
		.map((token) => token.replace(QUOTES, ""));
	const flags = tokens.filter((token) => token.startsWith("-"));
	const positional = tokens.filter((token) => !token.startsWith("-"));
	const refspecs = positional.slice(1);
	const force =
		refspecs.some((refspec) => refspec.startsWith("+")) ||
		flags.some(
			(flag) =>
				flag === "--force" ||
				flag.startsWith("--force-with-lease") ||
				flag === "--force-if-includes" ||
				SHORT_FORCE.test(flag)
		);
	if (!force) {
		return false;
	}
	if (flags.includes("--all") || flags.includes("--mirror")) {
		return true;
	}
	const targets =
		refspecs.length > 0
			? refspecs.map((refspec) => refspec.replace("+", "").split(":").pop())
			: ["HEAD"];
	return targets.some((target) => {
		const branch = target === "HEAD" ? currentBranch(root) : target;
		return PROTECTED.has(branch.replace(HEADS_PREFIX, ""));
	});
}

// Regras que dependem do comando que roda olham um trecho por vez e ancoram no início dele:
// `pnpm test > log; cat log | tail` e `grep harness:test package.json | head` não são suíte com pipe.
function statementMessage(statement, root) {
	const [first, ...rest] = statement.split("|");
	if (
		TEST_RUNNER.test(first) &&
		rest.some((stage) => PIPE_READER.test(stage))
	) {
		return PIPE_MESSAGE;
	}
	if (DB_PUSH.test(first)) {
		return DB_PUSH_MESSAGE;
	}
	if (isProtectedForcePush(first, root)) {
		return FORCE_MESSAGE;
	}
	return null;
}

function evaluateCommand(command, root) {
	for (const statement of command.split(COMMAND_SEPARATOR)) {
		const message = statementMessage(statement, root);
		if (message) {
			return message;
		}
	}
	for (const rule of COMMAND_RULES) {
		if (rule.pattern.test(command)) {
			return rule.message;
		}
	}
	if (
		COMMIT_OR_PR.test(command) &&
		countDashes(command) + countDashes(messageFileText(command, root)) > 0
	) {
		return `${DASH_MESSAGE} Vale para mensagem de commit e body de PR.`;
	}
	return null;
}

function addedDashes(toolName, toolInput) {
	if (toolName === "Write") {
		return countDashes(toolInput.content);
	}
	const edits = toolInput.edits ?? [toolInput];
	let added = 0;
	for (const change of edits) {
		added += countDashes(change.new_string) - countDashes(change.old_string);
	}
	return added;
}

function evaluateFileChange(input, root) {
	const toolInput = input.tool_input ?? {};
	const rel = repoRelative(root, toolInput.file_path);
	if (!rel) {
		return null;
	}
	if (GENERATED_PORT.test(rel)) {
		return `BLOQUEADO: ${rel} é porta gerada do harness. Edite a fonte (.agents/agents, .agents/skills, .mcp.json ou scripts/harness.mjs) e rode pnpm harness:sync.`;
	}
	if (
		MARKDOWN.test(rel) &&
		!VENDORED_SKILLS.test(rel) &&
		addedDashes(input.tool_name, toolInput) > 0
	) {
		return `${DASH_MESSAGE} Arquivo: ${rel}.`;
	}
	return null;
}

export function evaluate(input, options = {}) {
	const root = options.root ?? projectRoot(input);
	switch (input?.tool_name) {
		case "Bash":
		case "PowerShell": {
			const command = input.tool_input?.command;
			return command ? evaluateCommand(command, root) : null;
		}
		case "Edit":
		case "MultiEdit":
		case "Write":
			return evaluateFileChange(input, root);
		default:
			return null;
	}
}

if (isEntrypoint(import.meta.url)) {
	readHookInput((input) => {
		const message = evaluate(input);
		if (message) {
			process.stderr.write(`${message}\n`);
			process.exit(2);
		}
		process.exit(0);
	});
}
