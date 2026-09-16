import { appendFileSync, existsSync, statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import {
	isEntrypoint,
	manifestPath,
	projectRoot,
	readHookInput,
	repoRelative,
} from "./session.mjs";

// Em modo bypass o modelo também edita pelo shell (sed, node -e, heredoc), que os hooks de
// Edit/Write não enxergam; por isso todo caminho citado num comando entra no manifesto.
const PATH_TOKEN = /[A-Za-z0-9_./\\:~-]+\.[A-Za-z0-9]{1,8}/g;
const QUOTES = /^["']|["']$/g;

export function pathsIn(input) {
	const root = projectRoot(input);
	const toolInput = input.tool_input ?? {};
	const found = new Set();
	const add = (candidate) => {
		const rel = repoRelative(root, candidate);
		if (!rel) {
			return;
		}
		const absolute = isAbsolute(candidate)
			? candidate
			: resolve(root, candidate);
		if (existsSync(absolute) && !statSync(absolute).isDirectory()) {
			found.add(rel);
		}
	};
	add(toolInput.file_path);
	for (const token of String(toolInput.command ?? "").match(PATH_TOKEN) ?? []) {
		add(token.replace(QUOTES, ""));
	}
	return [...found];
}

export function record(input) {
	const paths = pathsIn(input);
	if (input.session_id && paths.length > 0) {
		appendFileSync(manifestPath(input.session_id), `${paths.join("\n")}\n`);
	}
	return paths;
}

if (isEntrypoint(import.meta.url)) {
	readHookInput((input) => {
		try {
			record(input);
		} catch {
			// Registro nunca bloqueia a sessão.
		}
		process.exit(0);
	});
}
