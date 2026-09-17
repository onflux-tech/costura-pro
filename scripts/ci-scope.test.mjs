import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";

import { changeRange, needsFullChecks, scopeFor } from "./ci-scope.mjs";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "ci-scope.mjs");
const zero = "0".repeat(40);
const MISSING_BEFORE = /commit before ausente no clone/;
const roots = [];

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

test("só docs, markdown e rules dispensam a bateria pesada", () => {
	assert.equal(
		needsFullChecks([
			"docs/ROADMAP.md",
			"docs/areas/design-system.md",
			"README.md",
			".agents/skills/verificar/SKILL.md",
			".claude/rules/web.md",
			"docs/adr/diagrama.png",
			".claude/rules/exemplo.json",
		]),
		false
	);
});

test("qualquer arquivo fora de docs, markdown e rules pede a bateria pesada", () => {
	for (const file of [
		"apps/web/src/main.tsx",
		"apps/docs/guia.ts",
		".claude/settings.json",
		".github/workflows/ci.yml",
		"pnpm-lock.yaml",
		"scripts/ci-scope.mjs",
	]) {
		assert.equal(needsFullChecks(["docs/ROADMAP.md", file]), true, file);
	}
});

test("intervalo sem arquivo roda tudo", () => {
	assert.equal(needsFullChecks([]), true);
});

test("push comum compara before com o commit do push", () => {
	assert.deepEqual(
		changeRange({
			BEFORE_SHA: "a".repeat(40),
			EVENT_NAME: "push",
			FORCED: "false",
			HEAD_SHA: "b".repeat(40),
		}),
		{ base: "a".repeat(40), head: "b".repeat(40) }
	);
});

test("push forçado, before zerado ou ausente roda tudo", () => {
	const push = { EVENT_NAME: "push", HEAD_SHA: "b".repeat(40) };
	assert.equal(
		changeRange({ ...push, BEFORE_SHA: "a".repeat(40), FORCED: "true" }),
		null
	);
	assert.equal(
		changeRange({ ...push, BEFORE_SHA: zero, FORCED: "false" }),
		null
	);
	assert.equal(changeRange({ ...push, BEFORE_SHA: "", FORCED: "false" }), null);
});

test("pull request compara a base do PR com o commit testado", () => {
	assert.deepEqual(
		changeRange({
			BASE_SHA: "c".repeat(40),
			EVENT_NAME: "pull_request",
			HEAD_SHA: "d".repeat(40),
		}),
		{ base: "c".repeat(40), head: "d".repeat(40) }
	);
	assert.equal(
		changeRange({ BASE_SHA: "", EVENT_NAME: "pull_request", HEAD_SHA: "d" }),
		null
	);
});

test("outro evento roda tudo", () => {
	for (const event of ["workflow_dispatch", "schedule", "merge_group"]) {
		assert.equal(
			changeRange({
				BEFORE_SHA: "a".repeat(40),
				EVENT_NAME: event,
				FORCED: "false",
				HEAD_SHA: "e".repeat(40),
			}),
			null,
			event
		);
	}
});

test("falha ao listar mudanças roda tudo", () => {
	const scope = scopeFor(
		{
			BEFORE_SHA: "a".repeat(40),
			EVENT_NAME: "push",
			FORCED: "false",
			HEAD_SHA: "b".repeat(40),
		},
		() => {
			throw new Error("commit before ausente no clone");
		}
	);
	assert.equal(scope.full, true);
	assert.match(scope.reason, MISSING_BEFORE);
});

function git(root, args) {
	return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function commit(root, path, content) {
	const absolute = join(root, path);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content);
	git(root, ["add", "."]);
	git(root, [
		"-c",
		"user.name=ci",
		"-c",
		"user.email=ci@example.com",
		"commit",
		"--quiet",
		"-m",
		path,
	]);
	return git(root, ["rev-parse", "HEAD"]);
}

function runScript(root, env) {
	const output = join(root, "github-output.txt");
	writeFileSync(output, "");
	execFileSync(process.execPath, [script], {
		cwd: root,
		env: { ...process.env, GITHUB_OUTPUT: output, ...env },
		stdio: "pipe",
	});
	return readFileSync(output, "utf8");
}

test("script grava full no GITHUB_OUTPUT a partir do git do repositório", () => {
	const root = mkdtempSync(join(tmpdir(), "costura-ci-scope-"));
	roots.push(root);
	git(root, ["init", "--quiet"]);
	const first = commit(root, "apps/web/src/main.tsx", "export {};\n");
	const docs = commit(root, "docs/ROADMAP.md", "# Roadmap\n");
	const code = commit(root, "apps/web/src/main.tsx", "export const a = 1;\n");

	const push = { EVENT_NAME: "push", FORCED: "false" };
	assert.equal(
		runScript(root, { ...push, BEFORE_SHA: first, HEAD_SHA: docs }),
		"full=false\n"
	);
	assert.equal(
		runScript(root, { ...push, BEFORE_SHA: docs, HEAD_SHA: code }),
		"full=true\n"
	);
	assert.equal(
		runScript(root, { ...push, BEFORE_SHA: "f".repeat(40), HEAD_SHA: code }),
		"full=true\n"
	);
});
