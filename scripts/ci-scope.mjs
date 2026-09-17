import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LIGHT_PATH = /^(?:docs\/|\.claude\/rules\/)|\.md$/;
const ZERO_SHA = /^0+$/;
const LINE_BREAK = /\r?\n/;

export function needsFullChecks(files) {
	return files.length === 0 || files.some((file) => !LIGHT_PATH.test(file));
}

export function changeRange(env) {
	const head = env.HEAD_SHA ?? "";
	if (env.EVENT_NAME === "pull_request") {
		return env.BASE_SHA ? { base: env.BASE_SHA, head } : null;
	}
	if (env.EVENT_NAME !== "push" || env.FORCED === "true") {
		return null;
	}
	const before = env.BEFORE_SHA ?? "";
	return before && !ZERO_SHA.test(before) ? { base: before, head } : null;
}

export function gitChangedFiles(base, head, cwd = process.cwd()) {
	return execFileSync("git", ["diff", "--name-only", base, head], {
		cwd,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	})
		.split(LINE_BREAK)
		.filter(Boolean);
}

export function scopeFor(env, listChanges = gitChangedFiles) {
	const range = changeRange(env);
	if (!range) {
		return {
			full: true,
			reason:
				"sem intervalo comparável (push forçado, before zerado ou outro evento)",
		};
	}
	let files;
	try {
		files = listChanges(range.base, range.head);
	} catch (error) {
		return {
			full: true,
			reason: `não foi possível listar as mudanças: ${String(error.message ?? error).split(LINE_BREAK)[0]}`,
		};
	}
	const full = needsFullChecks(files);
	return {
		full,
		reason: full
			? `${files.length} arquivo(s) no intervalo, algum fora de docs, markdown e rules`
			: `${files.length} arquivo(s) no intervalo, todos em docs, markdown ou rules`,
	};
}

const scriptPath = fileURLToPath(import.meta.url);

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const scope = scopeFor(process.env);
	process.stdout.write(
		`Bateria ${scope.full ? "completa" : "leve"}: ${scope.reason}.\n`
	);
	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(process.env.GITHUB_OUTPUT, `full=${scope.full}\n`);
	}
}
