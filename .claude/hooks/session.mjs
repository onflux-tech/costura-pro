import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Estado de sessão fica em tmpdir: nada de hook escreve no repositório.
const sessionFile = (id, suffix) =>
	join(tmpdir(), `costura-pro-claude-${id}.${suffix}`);

export const baselinePath = (id) => sessionFile(id, "baseline.json");
export const manifestPath = (id) => sessionFile(id, "touched.txt");
export const statePath = (id) => sessionFile(id, "stop.json");
const sessionFilesOf = (id) => [
	baselinePath(id),
	manifestPath(id),
	statePath(id),
];
const SESSION_PREFIX = "costura-pro-claude-";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function clearSession(id) {
	for (const path of sessionFilesOf(id)) {
		rmSync(path, { force: true });
	}
}

// Não há limpeza no SessionEnd: o resume reaproveita o id e precisa da foto original.
// Sessões esquecidas somem por idade quando outra sessão começa.
export function pruneSessions(now = Date.now(), maxAgeMs = WEEK_MS) {
	for (const name of readdirSync(tmpdir())) {
		if (!name.startsWith(SESSION_PREFIX)) {
			continue;
		}
		const path = join(tmpdir(), name);
		try {
			if (now - statSync(path).mtimeMs > maxAgeMs) {
				rmSync(path, { force: true });
			}
		} catch {
			// Arquivo removido por outra sessão no meio da varredura.
		}
	}
}

const BACKSLASH = /\\/g;

export const slash = (path) => String(path).replace(BACKSLASH, "/");

export function projectRoot(input) {
	return process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd();
}

// Caminho relativo à raiz, com barra normal; null quando fica fora do repositório.
export function repoRelative(root, path) {
	if (!path) {
		return null;
	}
	const absolute = isAbsolute(path) ? path : resolve(root, path);
	const rel = slash(relative(root, absolute));
	if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
		return null;
	}
	return rel;
}

export function git(args, cwd) {
	return execFileSync("git", args, {
		cwd,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
		stdio: ["ignore", "pipe", "ignore"],
	});
}

export function hashFile(path) {
	return createHash("sha1").update(readFileSync(path)).digest("hex");
}

export function dirtyEntries(cwd) {
	const entries = [];
	let skipOriginalPath = false;
	for (const record of git(
		["status", "--porcelain", "-z", "--untracked-files=all"],
		cwd
	).split("\0")) {
		if (skipOriginalPath || record.length < 4) {
			skipOriginalPath = false;
			continue;
		}
		const status = record.slice(0, 2);
		skipOriginalPath = status[0] === "R" || status[0] === "C";
		entries.push({ path: record.slice(3), status });
	}
	return entries;
}

export function snapshot(cwd) {
	const head = git(["rev-parse", "HEAD"], cwd).trim();
	const dirty = {};
	for (const entry of dirtyEntries(cwd)) {
		const absolute = join(cwd, entry.path);
		if (!existsSync(absolute)) {
			dirty[entry.path] = null;
		} else if (!statSync(absolute).isDirectory()) {
			dirty[entry.path] = hashFile(absolute);
		}
	}
	return { dirty, head };
}

// realpath dos dois lados: por junction, symlink ou subst o argv difere do módulo, e um guard
// que não se reconhece sai com 0 sem avaliar nada.
export function isEntrypoint(moduleUrl) {
	if (!process.argv[1]) {
		return false;
	}
	try {
		return (
			realpathSync(process.argv[1]) === realpathSync(fileURLToPath(moduleUrl))
		);
	} catch {
		return false;
	}
}

// Todo hook lê JSON do stdin; entrada inválida nunca derruba a sessão.
export function readHookInput(handler) {
	let raw = "";
	process.stdin.on("data", (chunk) => {
		raw += chunk;
	});
	process.stdin.on("end", () => {
		let input;
		try {
			input = JSON.parse(raw);
		} catch {
			process.exit(0);
		}
		handler(input);
	});
}
