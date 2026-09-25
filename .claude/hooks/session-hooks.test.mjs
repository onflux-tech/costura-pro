import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
	baselinePath,
	clearSession,
	manifestPath,
	statePath,
} from "./session.mjs";
import { start } from "./session-start.mjs";
import { pathsIn, record } from "./touch.mjs";

const cleanups = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
});

function write(root, path, content) {
	const absolute = join(root, path);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content);
}

function repo() {
	const root = mkdtempSync(join(tmpdir(), "costura-session-"));
	const git = (...args) =>
		execFileSync(
			"git",
			[
				"-c",
				"user.name=t",
				"-c",
				"user.email=t@t",
				"-c",
				"core.autocrlf=false",
				...args,
			],
			{ cwd: root, stdio: "ignore" }
		);
	git("init", "--quiet", "--initial-branch=main");
	write(root, "apps/web/src/a.ts", "export const a = 1;\n");
	git("add", "--all");
	git("commit", "--quiet", "-m", "init");
	const id = `teste-${cleanups.length}-${root.slice(-6)}`;
	cleanups.push(() => {
		rmSync(root, { force: true, recursive: true });
		clearSession(id);
	});
	return { git, id, root };
}

test("touch registra arquivo editado e arquivos citados em comando do shell", () => {
	const { id, root } = repo();
	write(root, "docs/PRD.md", "# PRD\n");

	assert.deepEqual(
		pathsIn({
			cwd: root,
			tool_input: { file_path: join(root, "docs/PRD.md") },
		}),
		["docs/PRD.md"]
	);
	assert.deepEqual(
		pathsIn({
			cwd: root,
			tool_input: { command: "sed -i s/1/2/ apps/web/src/a.ts nao-existe.ts" },
		}),
		["apps/web/src/a.ts"]
	);
	assert.deepEqual(
		pathsIn({
			cwd: root,
			tool_input: { file_path: join(tmpdir(), "fora.md") },
		}),
		[]
	);

	record({
		cwd: root,
		session_id: id,
		tool_input: { file_path: "docs/PRD.md" },
	});

	assert.equal(readFileSync(manifestPath(id), "utf8"), "docs/PRD.md\n");
});

test("session-start grava a foto uma vez e injeta branch, mudanças e lembrete", () => {
	const { id, root } = repo();
	write(root, "apps/web/src/a.ts", "export const a = 2;\n");

	const context = start(
		{ cwd: root, session_id: id },
		{ harnessIssues: () => [] }
	);

	assert.ok(existsSync(baselinePath(id)));
	for (const fragment of [
		"branch main",
		"1 arquivo(s) com mudança",
		"Abra cada entrega com /entrega-iniciar; a sessão de execução segue o /implementar do handoff; feche com /entrega-fechar: é o fechamento que atualiza docs curadas, índice e harness.",
	]) {
		assert.ok(context.includes(fragment), fragment);
	}
	const first = readFileSync(baselinePath(id), "utf8");

	write(root, "apps/web/src/a.ts", "export const a = 3;\n");
	start({ cwd: root, session_id: id }, { harnessIssues: () => [] });

	assert.equal(readFileSync(baselinePath(id), "utf8"), first);
});

test("session-start avisa harness divergente", () => {
	const { id, root } = repo();

	const context = start(
		{ cwd: root, session_id: id },
		{ harnessIssues: () => [".codex/config.toml: diverge da fonte"] }
	);

	assert.ok(context.includes("Harness divergente: 1 problema"));
});

test("session-start preserva a sessão retomada e remove sessões com mais de 7 dias", () => {
	const { id, root } = repo();
	const old = `${id}-antiga`;
	cleanups.push(() => clearSession(old));
	start({ cwd: root, session_id: id }, { harnessIssues: () => [] });
	record({
		cwd: root,
		session_id: id,
		tool_input: { file_path: "apps/web/src/a.ts" },
	});
	writeFileSync(statePath(id), "{}");
	const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
	for (const path of [baselinePath(old), manifestPath(old), statePath(old)]) {
		writeFileSync(path, "{}");
		utimesSync(path, eightDaysAgo, eightDaysAgo);
	}

	start({ cwd: root, session_id: id }, { harnessIssues: () => [] });

	for (const path of [baselinePath(id), manifestPath(id), statePath(id)]) {
		assert.equal(existsSync(path), true, path);
	}
	for (const path of [baselinePath(old), manifestPath(old), statePath(old)]) {
		assert.equal(existsSync(path), false, path);
	}
});

test("hook chamado por caminho com link continua rodando", () => {
	const { root } = repo();
	const hooks = fileURLToPath(new URL(".", import.meta.url));
	const linked = join(root, "hooks-link");
	symlinkSync(hooks, linked, "junction");

	const result = spawnSync(process.execPath, [join(linked, "guard.mjs")], {
		encoding: "utf8",
		env: { ...process.env, CLAUDE_PROJECT_DIR: root },
		input: JSON.stringify({
			tool_input: { command: "pnpm test | tail" },
			tool_name: "Bash",
		}),
	});

	assert.equal(result.status, 2, result.stderr);
});
