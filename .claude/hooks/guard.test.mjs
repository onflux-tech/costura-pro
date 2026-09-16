import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { evaluate } from "./guard.mjs";

const root = mkdtempSync(join(tmpdir(), "costura-guard-"));

after(() => {
	rmSync(root, { force: true, recursive: true });
});

const bash = (command) =>
	evaluate({ tool_input: { command }, tool_name: "Bash" }, { root });
const powershell = (command) =>
	evaluate({ tool_input: { command }, tool_name: "PowerShell" }, { root });
const write = (path, content) =>
	evaluate(
		{ tool_input: { content, file_path: path }, tool_name: "Write" },
		{ root }
	);
const edit = (path, oldString, newString) =>
	evaluate(
		{
			tool_input: {
				file_path: path,
				new_string: newString,
				old_string: oldString,
			},
			tool_name: "Edit",
		},
		{ root }
	);

function assertBlocked(message, fragment, label = fragment) {
	assert.ok(
		message?.includes(fragment),
		`${label}: esperava bloqueio com "${fragment}", veio ${message}`
	);
}

test("bloqueia suíte de teste com pipe para tail, head, grep ou Select-String", () => {
	for (const command of [
		"pnpm test | tail -20",
		"pnpm run test 2>&1 | grep fail",
		"bun test src | head",
		"node --test scripts/harness.test.mjs | tail",
		"turbo run test | less",
		"npx vitest run | tail",
	]) {
		assertBlocked(bash(command), "suíte de teste com pipe", command);
	}
	for (const command of [
		"pnpm test | Select-String fail",
		"pnpm test 2>&1 | Select-Object -Last 30",
	]) {
		assertBlocked(powershell(command), "suíte de teste com pipe", command);
	}
	for (const command of [
		"cd apps/web && pnpm --filter web test | tail",
		"FOO=1 bun test | head",
		"for s in a b; do pnpm run test:e2e | tail; done",
	]) {
		assertBlocked(bash(command), "suíte de teste com pipe", command);
	}
});

test("deixa passar suíte redirecionada para arquivo e pipe sem suíte", () => {
	assert.equal(bash("pnpm test > test.log 2>&1"), null);
	assert.equal(bash("git log --oneline | head -5"), null);
	assert.equal(bash("echo test | grep test"), null);
	assert.equal(bash("pnpm test > test.log 2>&1; cat test.log | tail -5"), null);
	assert.equal(
		bash(
			"for s in harness:test check; do pnpm run $s > $s.log; done && grep pass x.log | head"
		),
		null
	);
	for (const command of [
		"cat apps/web/vitest.config.ts | head",
		'grep -n "harness:test" package.json | head',
		"rg jest -l | head",
		"pnpm --filter test-app build | tail",
	]) {
		assert.equal(bash(command), null, command);
	}
});

test("bloqueia kill geral de node e deixa passar kill por PID", () => {
	assertBlocked(powershell("Stop-Process -Name node -Force"), "node");
	assertBlocked(bash("taskkill /IM node.exe /F"), "node");
	assertBlocked(bash("pkill -f node"), "node");
	assert.equal(powershell("Stop-Process -Id 4242"), null);
});

test("bloqueia force-push em branch protegida e deixa passar em branch de trabalho", () => {
	assertBlocked(bash("git push --force origin main"), "force-push");
	assertBlocked(bash("git push -f origin develop"), "force-push");
	for (const command of [
		"git push --force-with-lease origin main",
		"git push --force-if-includes --force-with-lease origin develop",
		"git push origin +main",
		"git push -fu origin main",
		"git push origin HEAD:production --force",
		"git push --mirror --force origin",
	]) {
		assertBlocked(bash(command), "force-push", command);
	}
	assert.equal(bash("git push --force-with-lease origin feat/x"), null);
	assert.equal(bash("git push -f origin feat/main-menu"), null);
	assert.equal(bash("git push origin main"), null);
	assert.equal(bash("git push -u origin chore/x"), null);
});

test("force-push sem refspec confere a branch atual", () => {
	const repo = mkdtempSync(join(tmpdir(), "costura-guard-git-"));
	execFileSync("git", ["init", "--quiet", "--initial-branch=main"], {
		cwd: repo,
	});
	try {
		const push = (command) =>
			evaluate({ tool_input: { command }, tool_name: "Bash" }, { root: repo });
		assertBlocked(push("git push -f"), "force-push");
		execFileSync("git", ["checkout", "--quiet", "-b", "feat/x"], {
			cwd: repo,
		});
		assert.equal(push("git push -f"), null);
	} finally {
		rmSync(repo, { force: true, recursive: true });
	}
});

test("bloqueia --no-verify e trailers de sessão ou coautoria", () => {
	assertBlocked(bash("git commit --no-verify -m 'x'"), "--no-verify");
	assertBlocked(
		bash('git commit -m "feat: x" -m "Claude-Session: https://claude.ai/x"'),
		"Claude-Session"
	);
	assertBlocked(
		bash('git commit -m "feat: x" -m "Co-Authored-By: Bot <b@x>"'),
		"Co-Authored-By"
	);
	assert.equal(bash('git commit -m "feat: add guard"'), null);
});

test("bloqueia travessão em commit e em body de PR, inclusive via arquivo", () => {
	assertBlocked(bash('git commit -m "feat: a \u2014 b"'), "travessão");
	assertBlocked(bash('gh pr create --body "a \u2013 b"'), "travessão");
	const body = join(root, "body.md");
	writeFileSync(body, "Resumo \u2014 detalhe\n");
	assertBlocked(
		bash(`gh pr create --title "x" --body-file "${body}"`),
		"travessão"
	);
	assert.equal(bash('gh pr create --title "x" --body "a, b"'), null);
	const message = join(root, "message.txt");
	writeFileSync(message, "feat: a \u2014 b\n");
	assertBlocked(bash(`git commit -F "${message}"`), "travessão");
});

test("-f de outros comandos não vira arquivo de mensagem", () => {
	const skill = join(root, "skill.md");
	writeFileSync(skill, "Skill \u2014 vendorizada\n");
	assert.equal(bash(`git add -f "${skill}" && git commit -m "chore: x"`), null);
	assert.equal(bash(`git add -f "${root}" && git commit -m "chore: x"`), null);
});

test("bloqueia rm -rf na raiz e Remove-Item na raiz do drive", () => {
	assertBlocked(bash("rm -rf /"), "raiz");
	assertBlocked(powershell("Remove-Item -Recurse -Force C:\\"), "raiz");
	assert.equal(bash("rm -rf ./dist"), null);
});

test("bloqueia db:push e drizzle-kit push, deixa passar generate e migrate", () => {
	assertBlocked(bash("pnpm db:push"), "db:push");
	assertBlocked(bash("npx drizzle-kit push"), "db:push");
	assert.equal(bash("pnpm db:generate"), null);
	assert.equal(bash("pnpm db:migrate"), null);
	assertBlocked(bash("pnpm --filter @costura-pro/db db:push"), "db:push");
	assert.equal(bash('rg "db:push" docs'), null);
	assert.equal(bash("grep db:push package.json"), null);
});

test("bloqueia edição direta das portas geradas do harness", () => {
	assertBlocked(
		write(join(root, ".claude/agents/reviewer.md"), "x"),
		"porta gerada"
	);
	assertBlocked(
		edit(join(root, ".codex/config.toml"), "a", "b"),
		"porta gerada"
	);
	assertBlocked(write(".claude/skills/shadcn/SKILL.md", "x"), "porta gerada");
	assert.equal(write(join(root, ".agents/agents/x/agent.md"), "x"), null);
	assert.equal(write(join(root, ".claude/rules/db.md"), "x"), null);
	assert.equal(write(join(root, ".claude/settings.json"), "{}"), null);
});

test("bloqueia travessão novo em markdown do projeto, sem punir o que já existia", () => {
	assertBlocked(
		write(join(root, "docs/PRD.md"), "linha \u2014 nova\n"),
		"travessão"
	);
	assertBlocked(
		edit(join(root, "docs/PRD.md"), "a", "a \u2013 b"),
		"travessão"
	);
	assert.equal(
		edit(join(root, "docs/PRD.md"), "a \u2014 b", "c \u2014 d"),
		null
	);
	assert.equal(
		write(join(root, ".agents/skills/terceira/SKILL.md"), "a \u2014 b"),
		null
	);
	assert.equal(write(join(root, "apps/web/src/x.ts"), "const a = 1;"), null);
});

test("bloqueia comentário novo em código, sem punir o que já existia", () => {
	const file = join(root, "apps/server/src/app.ts");
	assertBlocked(
		edit(file, "const a = 1;", "// explica\nconst a = 1;"),
		"comentário"
	);
	assertBlocked(
		edit(file, "const a = 1;", "const a = 1; // nota"),
		"comentário"
	);
	assertBlocked(
		write(
			join(root, "apps/web/src/novo.tsx"),
			"/* bloco */\nexport const a = 1;\n"
		),
		"comentário"
	);
	assertBlocked(
		write(join(root, "apps/web/src/tela.tsx"), "<div>{/* jsx */}</div>\n"),
		"comentário"
	);
	assertBlocked(
		write(join(root, "scripts/novo.mjs"), "/**\n * doc\n */\nexport {};\n"),
		"comentário"
	);
	assert.equal(
		edit(file, "// antigo\nconst a = 1;", "// antigo\nconst a = 2;"),
		null
	);
});

test("deixa passar URL, glob, regex, diretivas e arquivos que não são código", () => {
	const file = join(root, "apps/server/src/app.ts");
	for (const code of [
		'const url = "http://127.0.0.1:3000";',
		'app.use("/rpc/*", handler);',
		'const glob = "**/*.{js,ts}";',
		"const regex = /^\\/api(\\/|$)/;",
		"// biome-ignore lint/suspicious/noConsole: saída do CLI",
		"// @ts-expect-error tipo da biblioteca",
		'/// <reference types="vite/client" />',
	]) {
		assert.equal(edit(file, "", code), null, code);
	}
	assert.equal(edit(join(root, "docs/SPEC.md"), "a", "a // b"), null);
	assert.equal(
		write(join(root, ".agents/skills/terceira/script.mjs"), "// vendorizada\n"),
		null
	);
});

test("bloqueia comentário colado em parêntese ou chave e em .cjs", () => {
	assertBlocked(
		edit(join(root, "apps/server/src/app.ts"), "f();", "f()// colado"),
		"comentário"
	);
	assertBlocked(
		edit(join(root, "apps/server/src/app.ts"), "}", "}/* bloco */"),
		"comentário"
	);
	assertBlocked(
		write(join(root, "scripts/novo.cjs"), "module.exports = 1; // nota\n"),
		"comentário"
	);
});

test("o teste do próprio guard pode conter casos que parecem comentário", () => {
	assert.equal(
		edit(
			join(root, ".claude/hooks/guard.test.mjs"),
			"a",
			'const exemplo = "a // b";'
		),
		null
	);
});

test("Write sobre arquivo existente só conta o que acrescenta", () => {
	const file = join(root, "scripts/existente.mjs");
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, "// cabeçalho\nexport const a = 1;\n");
	assert.equal(write(file, "// cabeçalho\nexport const a = 2;\n"), null);
	assertBlocked(
		write(file, "// cabeçalho\n// outro\nexport const a = 2;\n"),
		"comentário"
	);
});

test("bloqueia arquivo de código ou migration com fase ou spike no nome", () => {
	for (const path of [
		"packages/db/tests/f2-schema.test.ts",
		"packages/db/src/migrations/0001_f2_installation.sql",
		"apps/web/src/F1-tokens.tsx",
		"apps/server/src/s5-service.ts",
	]) {
		assertBlocked(write(join(root, path), "export const a = 1;"), "fase", path);
	}
});

test("deixa passar nomes sem fase, markdown local e migration descritiva", () => {
	for (const path of [
		"packages/db/src/migrations/0001_installation_access_sync.sql",
		"packages/domain/src/sha256.ts",
		"apps/web/src/utf8.ts",
		"packages/api/src/ed25519.ts",
		"apps/server/tests/v2-api.test.ts",
		"docs/superpowers/specs/2026-09-16-f2-servidor-acesso-design.md",
	]) {
		assert.equal(write(join(root, path), "export const a = 1;"), null, path);
	}
});

test("bloqueia commit que cita fase, spike, spec, plano ou IDs, inclusive via arquivo", () => {
	for (const command of [
		'git commit -m "feat(server): add F2 access"',
		'git commit -m "docs: close spike S5"',
		"git commit -m 'feat: follow the spec'",
		'git commit -m "fix: RF-ACE-01 lockout"',
		'git commit -m "docs: record DEC-60"',
		'git commit -m "docs: resolve Q-11"',
		'git add . && git commit -m "chore: plano da entrega"',
	]) {
		assertBlocked(bash(command), "fase", command);
	}
	const message = join(root, "commit-fase.txt");
	writeFileSync(message, "feat: server for F2");
	assertBlocked(
		bash(`git commit -F "${message}"`),
		"fase",
		"arquivo de mensagem"
	);
});

test("deixa passar commit sem esses termos e comandos que só os citam fora do commit", () => {
	for (const command of [
		'git commit -m "fix(server): serve /api-reference/spec.json"',
		'git commit -m "feat(api): parse the 0xF2 marker"',
		'git commit -m "feat(sync): add conflict resolution"',
		"git add packages/db/tests/installation-sync-schema.test.ts",
		'grep -rn "F2" docs',
		"git log --grep F2",
	]) {
		assert.equal(bash(command), null, command);
	}
});

test("ignora ferramenta desconhecida e entrada sem comando", () => {
	assert.equal(evaluate({ tool_input: {}, tool_name: "Read" }, { root }), null);
	assert.equal(evaluate({ tool_name: "Bash" }, { root }), null);
});

test("processo do hook sai com 2 e mensagem no stderr quando bloqueia", () => {
	const hook = fileURLToPath(new URL("./guard.mjs", import.meta.url));
	const run = (command) =>
		spawnSync(process.execPath, [hook], {
			encoding: "utf8",
			env: { ...process.env, CLAUDE_PROJECT_DIR: root },
			input: JSON.stringify({ tool_input: { command }, tool_name: "Bash" }),
		});

	const blocked = run("pnpm test | tail");
	assert.equal(blocked.status, 2);
	assert.ok(blocked.stderr.includes("suíte de teste com pipe"));

	const allowed = run("pnpm test > test.log 2>&1");
	assert.equal(allowed.status, 0);
	assert.equal(allowed.stderr, "");
});
