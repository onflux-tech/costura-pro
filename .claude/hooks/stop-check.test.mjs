import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";
import { baselinePath, clearSession, snapshot } from "./session.mjs";
import { check } from "./stop-check.mjs";
import { recordAgentEvent } from "./subagents.mjs";
import { record } from "./touch.mjs";

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

const lines = (count, label) =>
	Array.from(
		{ length: count },
		(_, index) => `export const ${label}${index} = ${index};`
	).join("\n");

function session() {
	const root = mkdtempSync(join(tmpdir(), "costura-stop-"));
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
	write(root, "docs/SPEC.md", "# SPEC\n");
	git("add", "--all");
	git("commit", "--quiet", "-m", "init");
	const id = `stop-${cleanups.length}-${root.slice(-6)}`;
	writeFileSync(baselinePath(id), JSON.stringify(snapshot(root)));
	cleanups.push(() => {
		rmSync(root, { force: true, recursive: true });
		clearSession(id);
	});
	const edit = (path, content) => {
		write(root, path, content);
		record({
			cwd: root,
			session_id: id,
			tool_input: { file_path: join(root, path) },
		});
	};
	const stop = (options = {}) =>
		check(
			{ cwd: root, session_id: id },
			{ docsIssues: () => [], harnessIssues: () => [], ...options }
		);
	return { edit, git, id, root, stop };
}

test("sem foto da sessão grava a foto e libera", () => {
	const { id, root } = session();
	clearSession(id);

	assert.equal(check({ cwd: root, session_id: id }), null);
	assert.ok(existsSync(baselinePath(id)));
});

test("código sem docs cobra /entrega-fechar duas vezes e libera na terceira", () => {
	const { edit, stop } = session();
	edit("apps/web/src/a.ts", lines(12, "a"));

	const first = stop();
	assert.equal(first?.decision, "block");
	assert.ok(first.reason.includes("/entrega-fechar"));
	assert.ok(first.reason.includes("/verificar"));

	const second = stop();
	assert.equal(second?.decision, "block");
	assert.ok(second.reason.includes("última vez"));

	assert.equal(stop(), null);
});

test("subagente rodando segura a cobrança e o SubagentStop a devolve sem gastar a insistência", () => {
	const { edit, id, stop } = session();
	edit("apps/web/src/a.ts", lines(12, "a"));
	recordAgentEvent(
		id,
		{ agent_id: "a1", hook_event_name: "SubagentStart" },
		Date.now() - 60_000
	);

	assert.equal(stop(), null);

	recordAgentEvent(
		id,
		{ agent_id: "a1", hook_event_name: "SubagentStop" },
		Date.now()
	);
	const result = stop();
	assert.equal(result?.decision, "block");
	assert.ok(!result.reason.startsWith("Lembrete (última vez)"));
});

test("entrada de 4 h não segura a cobrança", () => {
	const { edit, id, stop } = session();
	edit("apps/web/src/a.ts", lines(12, "a"));
	recordAgentEvent(
		id,
		{ agent_id: "a1", hook_event_name: "SubagentStart" },
		Date.now() - 4 * 3_600_000
	);

	assert.equal(stop()?.decision, "block");
});

test("código acompanhado de doc curada não cobra fechamento", () => {
	const { edit, stop } = session();
	edit("apps/web/src/a.ts", lines(12, "a"));
	edit("docs/SPEC.md", "# SPEC\n\nContrato novo.\n");

	assert.equal(stop(), null);
});

test("mudança que não passou pelas tools da sessão fica fora", () => {
	const { root, stop } = session();
	write(root, "apps/web/src/a.ts", lines(20, "outra"));

	assert.equal(stop(), null);
});

test("fonte do harness alterada com portas divergentes cobra harness:sync", () => {
	const { edit, stop } = session();
	edit(
		".agents/agents/reviewer/agent.md",
		"---\nname: reviewer\n---\n\nNovo.\n"
	);

	const result = stop({
		harnessIssues: () => [".claude/agents/reviewer.md: diverge da fonte"],
	});

	assert.equal(result?.decision, "block");
	assert.ok(result.reason.includes("pnpm harness:sync"));
});

test("markdown tocado com docs-check falhando lista os problemas", () => {
	const { edit, stop } = session();
	edit("docs/SPEC.md", "# SPEC\n\nVeja `apps/web/src/sumiu.ts`.\n");

	const result = stop({
		docsIssues: () => [
			"docs/SPEC.md: caminho inexistente apps/web/src/sumiu.ts",
		],
	});

	assert.equal(result?.decision, "block");
	assert.ok(
		result.reason.includes("caminho inexistente apps/web/src/sumiu.ts")
	);
});

test("depois de liberar, rearma só quando o código dobra e cobra uma vez", () => {
	const { edit, stop } = session();
	edit("apps/web/src/a.ts", lines(12, "a"));
	stop();
	stop();
	assert.equal(stop(), null);

	edit("apps/web/src/b.ts", lines(11, "b"));
	assert.equal(stop(), null, "crescimento pequeno não rearma");

	edit("apps/web/src/c.ts", lines(5, "c"));
	const rearmed = stop();
	assert.equal(rearmed?.decision, "block");
	assert.ok(rearmed.reason.includes("última vez"));
	assert.equal(stop(), null);
});

test("linhas de docs não rearmam a cobrança", () => {
	const { edit, stop } = session();
	edit("apps/web/src/a.ts", lines(12, "a"));
	stop();
	stop();
	assert.equal(stop(), null);

	edit("docs/SPEC.md", `# SPEC\n\n${lines(40, "doc")}\n`);

	assert.equal(stop({ docsIssues: () => ["docs/SPEC.md: 1 travessão"] }), null);
});
