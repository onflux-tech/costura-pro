import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { checkDocs } from "../../scripts/docs-check.mjs";
import { checkHarness } from "../../scripts/harness.mjs";
import {
	baselinePath,
	dirtyEntries,
	git,
	hashFile,
	isEntrypoint,
	manifestPath,
	projectRoot,
	readHookInput,
	snapshot,
	statePath,
} from "./session.mjs";

// O fechamento (/entrega-fechar) é o que evolui docs e harness; este hook cobra quando a
// sessão mexeu em código sem tocar docs curadas. Escopo = mudou desde a foto E passou pelas
// tools desta sessão, então trabalho concorrente no mesmo checkout fica fora. Insiste duas
// vezes e libera na terceira; só rearma quando as linhas de código dobram depois de liberada.
const MIN_LINES = 10;
const MAX_LISTED = 8;
const CODE = /^(?:apps|packages|scripts)\/|^\.claude\/hooks\//;
const CURATED =
	/^(?:docs\/|CONTEXT\.md$|AGENTS\.md$|CLAUDE\.md$|README\.md$|\.claude\/rules\/|\.agents\/)/;
const HARNESS_SOURCE = /^(?:\.agents\/|\.mcp\.json$|scripts\/harness\.mjs$)/;
const MARKDOWN = /\.md$/i;
const SKIP = /(?:^|\/)(?:node_modules|dist|build|coverage)\//;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function isAncestor(root, ancestor, descendant) {
	try {
		git(["merge-base", "--is-ancestor", ancestor, descendant], root);
		return true;
	} catch {
		return false;
	}
}

function changedSince(root, base) {
	const changed = new Set();
	const head = git(["rev-parse", "HEAD"], root).trim();
	if (base.head !== head && isAncestor(root, base.head, head)) {
		for (const file of git(
			["diff", "--name-only", `${base.head}..${head}`],
			root
		).split("\n")) {
			if (file.trim()) {
				changed.add(file.trim());
			}
		}
	}
	for (const entry of dirtyEntries(root)) {
		const absolute = join(root, entry.path);
		if (!existsSync(absolute)) {
			if (base.dirty[entry.path] !== null) {
				changed.add(entry.path);
			}
		} else if (
			!statSync(absolute).isDirectory() &&
			base.dirty[entry.path] !== hashFile(absolute)
		) {
			changed.add(entry.path);
		}
	}
	return [...changed].filter((file) => !SKIP.test(file));
}

function touchedBySession(id) {
	if (!existsSync(manifestPath(id))) {
		return new Set();
	}
	return new Set(
		readFileSync(manifestPath(id), "utf8")
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
	);
}

function isTracked(root, file) {
	try {
		git(["ls-files", "--error-unmatch", "--", file], root);
		return true;
	} catch {
		return false;
	}
}

function linesChanged(root, base, files) {
	let total = 0;
	const tracked = files.filter((file) => isTracked(root, file));
	if (tracked.length > 0) {
		for (const line of git(
			["diff", "--numstat", base.head, "--", ...tracked],
			root
		).split("\n")) {
			const [added, removed] = line.split("\t");
			if (added && added !== "-") {
				total += Number(added) + Number(removed);
			}
		}
	}
	for (const file of files.filter(
		(candidate) => !tracked.includes(candidate)
	)) {
		const absolute = join(root, file);
		if (existsSync(absolute)) {
			total += readFileSync(absolute, "utf8").split("\n").length;
		}
	}
	return total;
}

function listed(items) {
	const shown = items.slice(0, MAX_LISTED).map((item) => `  - ${item}`);
	if (items.length > MAX_LISTED) {
		shown.push(`  - ... e mais ${items.length - MAX_LISTED}`);
	}
	return shown.join("\n");
}

function findings(root, files, total, options) {
	const parts = [];
	const code = files.filter((file) => CODE.test(file));
	if (
		code.length > 0 &&
		total >= MIN_LINES &&
		!files.some((file) => CURATED.test(file))
	) {
		parts.push(
			`Esta sessão mudou ${total} linha(s) em código (${code.slice(0, MAX_LISTED).join(", ")}) sem tocar docs curadas nem harness. Rode /entrega-fechar: /verificar, SPEC §0, ROADMAP, índice de docs e evolução do harness (rules, agents, skills, falhas conhecidas).`
		);
	}
	if (files.some((file) => HARNESS_SOURCE.test(file))) {
		const issues = options.harnessIssues(root);
		if (issues.length > 0) {
			parts.push(
				`Harness divergente; rode pnpm harness:sync:\n${listed(issues)}`
			);
		}
	}
	if (files.some((file) => MARKDOWN.test(file) || CODE.test(file))) {
		const issues = options.docsIssues(root);
		if (issues.length > 0) {
			parts.push(`Docs divergentes (pnpm docs:check):\n${listed(issues)}`);
		}
	}
	return parts;
}

function readState(id) {
	try {
		return JSON.parse(readFileSync(statePath(id), "utf8"));
	} catch {
		return { phase: 0, total: 0 };
	}
}

export function check(input, options = {}) {
	const id = input?.session_id;
	if (!id) {
		return null;
	}
	const root = options.root ?? projectRoot(input);
	if (!existsSync(baselinePath(id))) {
		writeFileSync(baselinePath(id), JSON.stringify(snapshot(root)));
		return null;
	}
	const base = JSON.parse(readFileSync(baselinePath(id), "utf8"));
	const touched = touchedBySession(id);
	const files = changedSince(root, base).filter((file) => touched.has(file));
	if (files.length === 0) {
		return null;
	}
	const total = linesChanged(
		root,
		base,
		files.filter((file) => CODE.test(file))
	);
	const state = readState(id);
	if (state.phase >= 3) {
		if (total < Math.max(state.total * 2, state.total + MIN_LINES)) {
			return null;
		}
		// Rearmada, cobra uma vez só: implementação longa não para duas vezes a cada turno.
		state.phase = 1;
	}
	if (state.phase === 2) {
		writeFileSync(statePath(id), JSON.stringify({ phase: 3, total }));
		return null;
	}
	const parts = findings(root, files, total, {
		docsIssues: options.docsIssues ?? (() => checkDocs(repoRoot)),
		harnessIssues: options.harnessIssues ?? (() => checkHarness(repoRoot)),
	});
	if (parts.length === 0) {
		return null;
	}
	if (state.phase === 1) {
		writeFileSync(statePath(id), JSON.stringify({ phase: 2, total }));
		return {
			decision: "block",
			reason: `Lembrete (última vez):\n${parts.join("\n\n")}\nPare de novo para encerrar assim mesmo.`,
		};
	}
	writeFileSync(statePath(id), JSON.stringify({ phase: 1, total }));
	return {
		decision: "block",
		reason: `${parts.join("\n\n")}\nSe não houver impacto em docs nem harness, pare de novo para seguir.`,
	};
}

if (isEntrypoint(import.meta.url)) {
	readHookInput((input) => {
		let result = null;
		try {
			result = check(input);
		} catch {
			result = null;
		}
		if (result) {
			process.stdout.write(`${JSON.stringify(result)}\n`);
		}
		process.exit(0);
	});
}
