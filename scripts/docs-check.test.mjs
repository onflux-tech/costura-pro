import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";

import { checkDocs } from "./docs-check.mjs";

const roots = [];

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

function write(root, path, content) {
	const absolute = join(root, path);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content);
}

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "costura-docs-"));
	roots.push(root);
	execFileSync("git", ["init", "--quiet"], { cwd: root, stdio: "ignore" });
	write(root, ".gitignore", "docs/superpowers\n");
	write(root, "skills-lock.json", JSON.stringify({ skills: { terceira: {} } }));
	write(
		root,
		"AGENTS.md",
		"# Agentes\n\nRegras: `.claude/rules/db.md`. Índice em [docs](docs/README.md).\n"
	);
	write(
		root,
		".claude/rules/db.md",
		"---\npaths:\n  - packages/db/**\n---\n\nUse `packages/db/src/index.ts`.\n"
	);
	write(root, "packages/db/src/index.ts", "export {};\n");
	write(
		root,
		"docs/README.md",
		"# Índice\n\n- [PRD](PRD.md#1-resumo)\n- [ROADMAP](ROADMAP.md)\n- [HARNESS](HARNESS.md)\n"
	);
	write(
		root,
		"docs/PRD.md",
		"# PRD\n\n## 1. Resumo\n\n- **RF-ENT-01** a\n- **RF-ENT-02** b\n- **RF-ENT-03** c\n"
	);
	write(
		root,
		"docs/ROADMAP.md",
		"# Roadmap\n\n## Rastreio de requisitos por fase\n\n| Área | F2 | F3 |\n|---|---|---|\n| RF-ENT | 01 a 02 | 03 |\n"
	);
	write(
		root,
		"docs/HARNESS.md",
		"# Harness\n\nPapel `explorer`. Skill `/entrega-fechar`. Specs locais em `docs/superpowers/specs/`.\n"
	);
	write(
		root,
		".agents/agents/explorer/agent.md",
		"---\nname: explorer\n---\n\nCorpo.\n"
	);
	write(
		root,
		".agents/skills/entrega-fechar/SKILL.md",
		"---\nname: entrega-fechar\n---\n\nFecha.\n"
	);
	write(
		root,
		".agents/skills/terceira/SKILL.md",
		"Skill de terceiro \u2014 com travessão.\n"
	);
	return root;
}

test("repositório consistente não tem problema", () => {
	assert.deepEqual(checkDocs(fixture()), []);
});

test("doc de docs fora do índice vira problema", () => {
	const root = fixture();
	write(root, "docs/areas/auth.md", "# Auth\n");

	assert.deepEqual(checkDocs(root), [
		"docs/README.md: docs/areas/auth.md fora do índice",
	]);
});

test("link para arquivo inexistente e âncora sem heading viram problema", () => {
	const root = fixture();
	write(
		root,
		"docs/README.md",
		"# Índice\n\n- [PRD](PRD.md#9-nao-existe)\n- [ROADMAP](ROADMAP.md)\n- [HARNESS](HARNESS.md)\n- [velho](harness.md)\n"
	);

	assert.deepEqual(checkDocs(root), [
		"docs/README.md: link quebrado harness.md",
		"docs/README.md: âncora inexistente PRD.md#9-nao-existe",
	]);
});

test("âncora HTML explícita vale como destino de link", () => {
	const root = fixture();
	write(
		root,
		"docs/HARNESS.md",
		'# Harness\n\n<a id="portugues"></a>\n\nPapel `explorer`. Skill `/entrega-fechar`. [Ir](#portugues) e [sumiu](#nao-existe).\n'
	);

	assert.deepEqual(checkDocs(root), [
		"docs/HARNESS.md: âncora inexistente #nao-existe",
	]);
});

test("caminho em crases que não existe vira problema; glob, placeholder, ignorado e pacote npm não", () => {
	const root = fixture();
	write(
		root,
		"docs/HARNESS.md",
		"# Harness\n\nPapel `explorer`. Skill `/entrega-fechar`. Veja `packages/db/src/sumiu.ts`, `packages/*/src`, `docs/areas/<area>.md`, `docs/superpowers/plans/x.md` e `drizzle-orm/bun-sqlite/migrator`.\n"
	);

	assert.deepEqual(checkDocs(root), [
		"docs/HARNESS.md: caminho inexistente packages/db/src/sumiu.ts",
	]);
});

test("travessão em doc do projeto vira problema; skill vendorizada fica fora", () => {
	const root = fixture();
	write(
		root,
		"AGENTS.md",
		"# Agentes \u2013 regras\n\nRegras: `.claude/rules/db.md`.\n"
	);

	assert.deepEqual(checkDocs(root), ["AGENTS.md: 1 travessão"]);
});

test("rule fora do AGENTS.md vira problema", () => {
	const root = fixture();
	write(
		root,
		".claude/rules/web.md",
		"---\npaths:\n  - apps/web/**\n---\n\nWeb.\n"
	);

	assert.deepEqual(checkDocs(root), [
		"AGENTS.md: rule .claude/rules/web.md não listada",
	]);
});

test("requisito do PRD fora do rastreio do ROADMAP vira problema", () => {
	const root = fixture();
	write(
		root,
		"docs/ROADMAP.md",
		"# Roadmap\n\n## Rastreio de requisitos por fase\n\n| Área | F2 |\n|---|---|\n| RF-ENT | 01, 03 (parcial) |\n"
	);

	assert.deepEqual(checkDocs(root), [
		"docs/ROADMAP.md: RF-ENT-02 fora do rastreio",
	]);
});

test("papel ou skill do projeto fora do HARNESS vira problema", () => {
	const root = fixture();
	write(
		root,
		".agents/skills/verificar/SKILL.md",
		"---\nname: verificar\n---\n\nRoda.\n"
	);

	assert.deepEqual(checkDocs(root), [
		"docs/HARNESS.md: skill verificar não documentada",
	]);
});
