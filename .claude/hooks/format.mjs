import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
	isEntrypoint,
	projectRoot,
	readHookInput,
	repoRelative,
} from "./session.mjs";

// Só formata: com `check --write`, o fix seguro de noUnusedImports apagaria um import recém-
// adicionado antes do Edit que o usa. Lint fica para o Lefthook e o pnpm check. Se o biome
// reescrever o arquivo, o modelo é avisado: o próximo Edit falharia com old_string desatualizado.
const FORMATTABLE = /\.(?:ts|tsx|js|jsx|mjs|cjs|json|jsonc|css)$/i;
const SKIP =
	/(?:^|\/)(?:node_modules|dist|build)\/|^\.(?:claude|agents)\/skills\/|^\.codex\/|routeTree\.gen\.ts$|\/src\/env\.ts$/;
const CRLF = /\r\n/g;
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const MAX_LINES = 25;

export function plan(filePath, root) {
	const rel = repoRelative(root, filePath);
	if (!(rel && FORMATTABLE.test(rel)) || SKIP.test(rel)) {
		return null;
	}
	return {
		args: ["format", "--write", "--no-errors-on-unmatched", join(root, rel)],
		bin: join(root, "node_modules", "@biomejs", "biome", "bin", "biome"),
		rel,
		tool: "biome",
	};
}

const hash = (path) =>
	createHash("sha1")
		.update(readFileSync(path, "utf8").replace(CRLF, "\n"))
		.digest("hex");

function compress(output) {
	const lines = String(output)
		.replace(ANSI, "")
		.split("\n")
		.filter((line) => line.trim());
	const head = lines.slice(0, MAX_LINES);
	if (lines.length > head.length) {
		head.push(`... (${lines.length - head.length} linhas omitidas)`);
	}
	return head.join("\n");
}

export function run(input) {
	const root = projectRoot(input);
	const planned = plan(input.tool_input?.file_path, root);
	const absolute = planned && join(root, planned.rel);
	if (!(planned && existsSync(absolute) && existsSync(planned.bin))) {
		return { code: 0 };
	}
	const before = hash(absolute);
	const result = spawnSync(process.execPath, [planned.bin, ...planned.args], {
		cwd: root,
		encoding: "utf8",
	});
	if (result.status !== 0) {
		return {
			code: 2,
			stderr: `biome não conseguiu formatar ${planned.rel} (em geral, erro de sintaxe). Corrija antes de seguir:\n${compress(`${result.stdout ?? ""}\n${result.stderr ?? ""}`)}`,
		};
	}
	if (hash(absolute) === before) {
		return { code: 0 };
	}
	return {
		code: 0,
		stdout: JSON.stringify({
			hookSpecificOutput: {
				additionalContext: `${planned.rel} foi reformatado pelo biome depois da sua edição. Releia o trecho antes do próximo Edit nesse arquivo.`,
				hookEventName: "PostToolUse",
			},
		}),
	};
}

if (isEntrypoint(import.meta.url)) {
	readHookInput((input) => {
		const result = run(input);
		if (result.stderr) {
			process.stderr.write(`${result.stderr}\n`);
		}
		if (result.stdout) {
			process.stdout.write(`${result.stdout}\n`);
		}
		process.exit(result.code);
	});
}
