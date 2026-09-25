import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

import { ROLE_MODELS } from "../../scripts/harness.mjs";
import { evaluate, IMPLEMENTER_ROLE } from "./guard.mjs";

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

const implementerBash = (command) =>
	evaluate(
		{ agent_type: "implementer", tool_input: { command }, tool_name: "Bash" },
		{ root }
	);
const implementerPowershell = (command) =>
	evaluate(
		{
			agent_type: "implementer",
			tool_input: { command },
			tool_name: "PowerShell",
		},
		{ root }
	);
const implementerWrite = (path, content) =>
	evaluate(
		{
			agent_type: "implementer",
			tool_input: { content, file_path: path },
			tool_name: "Write",
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

test("implementer bloqueado em git que muda índice, branch ou histórico", () => {
	for (const command of [
		'git commit -m "x"',
		"git add .",
		"git stash",
		"git stash pop",
		"git reset --hard HEAD",
		"git checkout -- apps/web/src/a.ts",
		"git switch main",
		"git restore apps/web/src/a.ts",
		"git clean -fd",
		"git merge main",
		"git rebase main",
		"git cherry-pick abc",
		"git revert abc",
		"git push",
		"git pull",
		"git rm a.ts",
		"git mv a.ts b.ts",
		"git am x.patch",
		"git apply x.patch",
		"git update-index --assume-unchanged a.ts",
		'git -C "D:/x y" commit -m x',
		"git -C repo add .",
		"git -c core.autocrlf=false commit -m x",
		'git -c user.name="a b" commit -m x',
		"git --git-dir='D:/x y/.git' add .",
		"git --git-dir .git add .",
		"git --work-tree . checkout -- x",
		"git --namespace ns add .",
		"git --no-pager commit -m x",
		"cd apps && git add .",
		"pnpm fix; git add .",
	]) {
		assertBlocked(
			implementerBash(command),
			"o implementer não muda índice",
			command
		);
	}
	assertBlocked(
		implementerPowershell("git add .; git commit -m x"),
		"o implementer não muda índice",
		"PowerShell"
	);
});

test("implementer liberado em git de leitura e em texto que só cita git", () => {
	for (const command of [
		"git status --short",
		"git diff --stat",
		"git log --oneline -5",
		"git show HEAD --stat",
		"git branch --show-current",
		"git -C repo status",
		"git --no-pager diff",
		"git merge-base main HEAD",
		"git merge-tree a b",
		'grep "git add" docs/HARNESS.md',
		'rg "git stash" .claude',
	]) {
		assert.equal(implementerBash(command), null, command);
	}
});

test("mensagem de git do implementer deixa a árvore de trabalho com ele", () => {
	assert.equal(
		implementerBash("git add ."),
		"BLOQUEADO: o implementer não muda índice, branch nem histórico do git; commits e branch são do agente principal."
	);
});

test("implementer bloqueado em git e em migração em qualquer estágio do pipe", () => {
	for (const command of [
		"printf x | git commit -F -",
		"git diff | git apply",
		"ls | xargs git add",
		"ls | xargs -0 git checkout --",
		"ls | xargs -I {} git add {}",
	]) {
		assertBlocked(
			implementerBash(command),
			"o implementer não muda índice",
			command
		);
	}
	assertBlocked(
		implementerBash("echo y | pnpm db:migrate"),
		"db:migrate do implementer só com DATABASE_FILE temporário"
	);
	for (const command of [
		"git log --oneline | head -5",
		'git diff --stat | grep "git add"',
		'grep "git add" docs/HARNESS.md | head',
		'ls | xargs -0 grep "git add"',
	]) {
		assert.equal(implementerBash(command), null, command);
	}
});

test("implementer bloqueado em subcomandos de git que mexem em refs, worktree, tag e branch", () => {
	for (const command of [
		"git bisect start",
		"git update-ref refs/heads/x HEAD",
		"git symbolic-ref HEAD refs/heads/x",
		"git read-tree HEAD",
		"git checkout-index -f -a",
		"git worktree add ../x",
		"git worktree remove ../x",
		"git worktree move ../x ../y",
		"git worktree prune",
		"git tag v1",
		"git tag -d v1",
		"git tag -a v1 -m x",
		"git branch -d x",
		"git branch -D x",
		"git branch --delete x",
		"git branch -m x y",
		"git branch -M y",
		"git branch --move x y",
		"git branch -f x HEAD",
		"git branch --force x HEAD",
		"git branch -c x y",
		"git branch -C x y",
		"git branch --copy x y",
	]) {
		assertBlocked(
			implementerBash(command),
			"o implementer não muda índice",
			command
		);
	}
	for (const command of [
		"git worktree list",
		"git tag",
		"git tag -l",
		"git tag --list",
		"git branch",
		"git branch --show-current",
		"git branch -a",
		"git branch --list",
		"git branch -vv",
	]) {
		assert.equal(implementerBash(command), null, command);
	}
});

test("implementer só roda db:migrate com DATABASE_FILE no próprio comando", () => {
	for (const command of [
		"pnpm db:migrate",
		"pnpm --filter @costura-pro/db run db:migrate",
		"bunx drizzle-kit migrate",
	]) {
		assertBlocked(
			implementerBash(command),
			"db:migrate do implementer só com DATABASE_FILE temporário",
			command
		);
	}
	assert.equal(
		implementerBash("DATABASE_FILE=/tmp/x.db pnpm db:migrate"),
		null
	);
	assert.equal(
		implementerPowershell(
			'$env:DATABASE_FILE = "C:\\temp\\x.db"; pnpm db:migrate'
		),
		null
	);
	assert.equal(implementerBash("pnpm db:generate"), null);
});

test("implementer só migra com DATABASE_FILE que chega ao comando e não aponta para local.db", () => {
	const migrateMessage =
		"db:migrate do implementer só com DATABASE_FILE temporário";
	for (const command of [
		'DATABASE_FILE="$TMP/x.db"; pnpm db:migrate',
		"DATABASE_FILE=/tmp/x.db bun test; pnpm db:migrate",
		"cd packages/db && bun run src/migrate.ts",
		"bun src/migrate.ts",
		"node packages/db/src/migrate.ts",
		"bunx tsx src/migrate.ts",
		"DATABASE_FILE=D:/x/local.db pnpm db:migrate",
		'DATABASE_FILE="D:/a b/local.db" pnpm db:migrate',
		"export DATABASE_FILE=local.db; pnpm db:migrate",
		"export DATABASE_FILE=/tmp/x.db; export DATABASE_FILE=local.db; pnpm db:migrate",
		'$env:DATABASE_FILE = "C:\\temp\\x.db"; pnpm db:migrate',
		"pnpm db:migrate:deploy",
		"echo y | pnpm db:migrate",
	]) {
		assertBlocked(implementerBash(command), migrateMessage, command);
	}
	for (const command of [
		'$env:DATABASE_FILE = "D:\\x\\local.db"; pnpm db:migrate',
		"export DATABASE_FILE=/tmp/x.db; pnpm db:migrate",
	]) {
		assertBlocked(implementerPowershell(command), migrateMessage, command);
	}
	for (const command of [
		"DATABASE_FILE=/tmp/x.db pnpm db:migrate",
		"export DATABASE_FILE=/tmp/x.db; pnpm db:migrate",
		"DATABASE_FILE=/tmp/x.db bun run src/migrate.ts",
		"cat packages/db/src/migrate.ts",
		"bunx biome check packages/db/src/migrate.ts",
		"bun build packages/db/src/migrate.ts",
		"node --check packages/db/src/migrate.ts",
		"node --test packages/db/tests/migrate.test.ts > x.log 2>&1",
		"pnpm db:generate",
	]) {
		assert.equal(implementerBash(command), null, command);
	}
	assert.equal(
		implementerPowershell(
			'$env:DATABASE_FILE = "C:\\temp\\x.db"; pnpm db:migrate'
		),
		null
	);
});

test("implementer segue sujeito às regras gerais do guard", () => {
	assertBlocked(implementerBash("pnpm test | tail"), "suíte de teste com pipe");
	assertBlocked(
		implementerWrite(join(root, "apps/web/src/x.ts"), "// x\n"),
		"comentário novo em código"
	);
});

test("implementer não mexe em dados do dono por Edit nem MultiEdit", () => {
	const file_path = join(root, "apps/server/.env");
	for (const toolInput of [
		{ file_path, new_string: "B=2", old_string: "A=1" },
		{ edits: [{ new_string: "B=2", old_string: "A=1" }], file_path },
	]) {
		assertBlocked(
			evaluate(
				{
					agent_type: "implementer",
					tool_input: toolInput,
					tool_name: toolInput.edits ? "MultiEdit" : "Edit",
				},
				{ root }
			),
			"o implementer não edita .env, banco local nem mídia do dono"
		);
	}
	for (const path of ["local.db-shm", "local.db-journal"]) {
		assertBlocked(
			implementerWrite(join(root, path), "x"),
			"o implementer não edita .env, banco local nem mídia do dono",
			path
		);
	}
	assert.equal(implementerWrite(join(root, ".env.example"), "A=\n"), null);
});

test("regras do implementer valem só para o papel que o gerador conhece por esse nome", () => {
	assert.equal(IMPLEMENTER_ROLE, "implementer");
	assert.ok(IMPLEMENTER_ROLE in ROLE_MODELS);
	const reviewer = (tool_name, tool_input) =>
		evaluate({ agent_type: "reviewer", tool_input, tool_name }, { root });
	assert.equal(reviewer("Bash", { command: "pnpm db:migrate" }), null);
	assert.equal(
		reviewer("Write", { content: "A=1\n", file_path: join(root, ".env") }),
		null
	);
});

test("implementer não edita .env, banco local nem mídia do dono", () => {
	for (const path of [
		".env",
		"apps/server/.env",
		".env.local",
		"local.db",
		"local.db-wal",
		"media/ab/cd.webp",
	]) {
		assertBlocked(
			implementerWrite(join(root, path), "A=1\n"),
			"o implementer não edita .env, banco local nem mídia do dono",
			path
		);
	}
	for (const path of [
		"apps/server/.env.schema",
		".env.schema",
		"docs/areas/midia.md",
		"apps/server/src/media/store.ts",
	]) {
		assert.equal(
			implementerWrite(join(root, path), "export const a = 1;\n"),
			null,
			path
		);
	}
});

test("agente principal e outros papéis seguem liberados nas regras do implementer", () => {
	assert.equal(bash("git commit -m x"), null);
	assert.equal(bash("pnpm db:migrate"), null);
	assert.equal(write(".env", "A=1\n"), null);
	assert.equal(
		evaluate(
			{
				agent_type: "reviewer",
				tool_input: { command: "git commit -m x" },
				tool_name: "Bash",
			},
			{ root }
		),
		null
	);
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
