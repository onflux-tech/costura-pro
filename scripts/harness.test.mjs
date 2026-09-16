import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, test } from "node:test";

import { checkHarness, syncHarness, unstagedPortIssues } from "./harness.mjs";

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

function read(root, path) {
	return readFileSync(join(root, path), "utf8");
}

function lines(root, path) {
	return read(root, path).split("\n");
}

function git(root, ...args) {
	execFileSync("git", ["-c", "core.autocrlf=false", ...args], {
		cwd: root,
		stdio: "ignore",
	});
}

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "costura-harness-"));
	roots.push(root);
	for (const role of ["contract", "explorer", "reviewer"]) {
		write(
			root,
			`.agents/agents/${role}/agent.md`,
			`---\nname: ${role}\ndescription: Papel ${role} de teste\n---\n\nCorpo do papel ${role}.\n`
		);
	}
	write(
		root,
		".agents/skills/demo/SKILL.md",
		"---\nname: demo\n---\n\nDemo.\n"
	);
	write(
		root,
		".agents/skills/demo/assets/logo.bin",
		Buffer.from([0, 1, 2, 255])
	);
	write(
		root,
		".mcp.json",
		JSON.stringify({
			mcpServers: {
				context7: { args: ["-y", "@upstash/context7-mcp"], command: "npx" },
				docs: { type: "http", url: "https://example.com/mcp" },
			},
		})
	);
	return root;
}

test("sync gera portas Claude e Codex consistentes com a fonte", () => {
	const root = fixture();

	syncHarness(root);

	assert.deepEqual(checkHarness(root), []);
	const explorer = lines(root, ".claude/agents/explorer.md");
	assert.ok(explorer.includes("model: sonnet"));
	assert.ok(explorer.includes("tools: Read, Grep, Glob"));
	assert.ok(explorer.includes("Corpo do papel explorer."));
	assert.ok(lines(root, ".claude/agents/reviewer.md").includes("model: opus"));
	const codexReviewer = lines(root, ".codex/agents/reviewer.toml");
	assert.ok(codexReviewer.includes('model = "gpt-5.6-terra"'));
	assert.ok(codexReviewer.includes('model_reasoning_effort = "high"'));
	assert.ok(codexReviewer.includes('sandbox_mode = "read-only"'));
	assert.ok(codexReviewer.includes("Corpo do papel reviewer."));
	assert.ok(
		lines(root, ".codex/agents/explorer.toml").includes(
			'model = "gpt-5.6-luna"'
		)
	);
	const config = lines(root, ".codex/config.toml");
	assert.ok(config.includes("max_concurrent_threads_per_session = 2"));
	assert.ok(config.includes("[mcp_servers.context7]"));
	assert.ok(config.includes('args = ["-y", "@upstash/context7-mcp"]'));
	assert.ok(config.includes('url = "https://example.com/mcp"'));
	assert.deepEqual(
		readFileSync(join(root, ".claude/skills/demo/assets/logo.bin")),
		Buffer.from([0, 1, 2, 255])
	);
	assert.equal(
		lstatSync(join(root, ".claude/skills/demo")).isSymbolicLink(),
		false
	);
});

test("check acusa porta editada à mão", () => {
	const root = fixture();
	syncHarness(root);

	write(
		root,
		".claude/agents/explorer.md",
		`${read(root, ".claude/agents/explorer.md")}\nregra extra\n`
	);

	assert.deepEqual(checkHarness(root), [
		".claude/agents/explorer.md: diverge da fonte",
	]);
});

test("check acusa MCP novo que não chegou ao Codex", () => {
	const root = fixture();
	syncHarness(root);

	write(
		root,
		".mcp.json",
		JSON.stringify({
			mcpServers: { shadcn: { args: ["-y", "shadcn@latest"], command: "npx" } },
		})
	);

	assert.deepEqual(checkHarness(root), [
		".codex/config.toml: diverge da fonte",
	]);
});

test("check acusa porta ausente e arquivo gerado sobrando", () => {
	const root = fixture();
	syncHarness(root);

	rmSync(join(root, ".codex/agents/contract.toml"));
	write(root, ".claude/skills/removida/SKILL.md", "velha\n");

	assert.deepEqual(checkHarness(root), [
		".codex/agents/contract.toml: ausente",
		".claude/skills/removida/SKILL.md: sobrando",
	]);
});

test("check aceita quebra de linha CRLF do checkout no Windows", () => {
	const root = fixture();
	syncHarness(root);

	const reviewer = read(root, ".claude/agents/reviewer.md");
	write(root, ".claude/agents/reviewer.md", reviewer.replaceAll("\n", "\r\n"));

	assert.deepEqual(checkHarness(root), []);
});

test("sync troca symlink de skill por cópia sem apagar a fonte", () => {
	const root = fixture();
	mkdirSync(join(root, ".claude/skills"), { recursive: true });
	symlinkSync(
		join(root, ".agents/skills/demo"),
		join(root, ".claude/skills/demo"),
		"junction"
	);

	assert.ok(
		checkHarness(root).includes(".claude/skills/demo: symlink não é permitido")
	);

	syncHarness(root);

	assert.ok(existsSync(join(root, ".agents/skills/demo/SKILL.md")));
	assert.equal(
		lstatSync(join(root, ".claude/skills/demo")).isSymbolicLink(),
		false
	);
	assert.deepEqual(checkHarness(root), []);
});

test("sync troca diretório gerado inteiro em symlink por cópia", () => {
	const root = fixture();
	mkdirSync(join(root, ".claude"), { recursive: true });
	symlinkSync(
		join(root, ".agents/skills"),
		join(root, ".claude/skills"),
		"junction"
	);

	assert.ok(
		checkHarness(root).includes(".claude/skills: symlink não é permitido")
	);

	syncHarness(root);

	assert.ok(existsSync(join(root, ".agents/skills/demo/SKILL.md")));
	assert.equal(lstatSync(join(root, ".claude/skills")).isSymbolicLink(), false);
	assert.deepEqual(checkHarness(root), []);
});

test("sync recusa .claude em symlink sem apagar o alvo", () => {
	const root = fixture();
	const outside = mkdtempSync(join(tmpdir(), "costura-harness-alvo-"));
	roots.push(outside);
	write(outside, "agents/manter.md", "não apagar\n");
	symlinkSync(outside, join(root, ".claude"), "junction");

	assert.throws(() => syncHarness(root), {
		message: ".claude: symlink não é permitido; corrija à mão antes do sync",
	});
	assert.equal(read(outside, "agents/manter.md"), "não apagar\n");
});

test("diretório gerado que virou arquivo vira problema sem exceção", () => {
	const root = fixture();
	syncHarness(root);
	rmSync(join(root, ".claude/skills"), { force: true, recursive: true });
	write(root, ".claude/skills", "../.agents/skills");

	assert.ok(checkHarness(root).includes(".claude/skills: não é diretório"));
});

test("description com dois-pontos gera YAML válido na porta Claude", () => {
	const root = fixture();
	write(
		root,
		".agents/agents/reviewer/agent.md",
		"---\nname: reviewer\ndescription: Revisa diff: dinheiro e dados\n---\n\nCorpo.\n"
	);

	syncHarness(root);

	assert.ok(
		lines(root, ".claude/agents/reviewer.md").includes(
			'description: "Revisa diff: dinheiro e dados"'
		)
	);
	assert.deepEqual(checkHarness(root), []);
});

test("description entre aspas na fonte vira problema", () => {
	const root = fixture();
	write(
		root,
		".agents/agents/reviewer/agent.md",
		'---\nname: reviewer\ndescription: "Revisor"\n---\n\nCorpo.\n'
	);

	assert.deepEqual(checkHarness(root), [
		".agents/agents/reviewer/agent.md: description sem aspas na fonte",
	]);
});

test("nome de servidor MCP fora do padrão de chave TOML vira problema", () => {
	const root = fixture();
	write(
		root,
		".mcp.json",
		JSON.stringify({
			mcpServers: { "docs.v2": { args: [], command: "npx" } },
		})
	);

	assert.deepEqual(checkHarness(root), [
		".mcp.json: nome de servidor inválido (docs.v2); use letras, números, - ou _",
	]);
});

test("check de commit acusa porta regenerada que ficou fora do stage", () => {
	const root = fixture();
	git(root, "init", "--quiet");
	syncHarness(root);
	git(root, "add", "--all");
	write(
		root,
		".agents/agents/reviewer/agent.md",
		"---\nname: reviewer\ndescription: Revisor novo\n---\n\nCorpo novo.\n"
	);
	syncHarness(root);
	git(root, "add", ".agents/agents/reviewer/agent.md");

	assert.deepEqual(checkHarness(root), []);
	assert.deepEqual(unstagedPortIssues(root), [
		".claude/agents/reviewer.md: porta gerada fora do commit",
		".codex/agents/reviewer.toml: porta gerada fora do commit",
	]);

	git(root, "add", "--all");

	assert.deepEqual(unstagedPortIssues(root), []);
});

test("papel sem modelos definidos vira problema", () => {
	const root = fixture();
	write(
		root,
		".agents/agents/extra/agent.md",
		"---\nname: extra\ndescription: Extra\n---\n\nCorpo.\n"
	);

	assert.deepEqual(checkHarness(root), [
		".agents/agents/extra: papel sem modelos em scripts/harness.mjs",
	]);
});

test("corpo de papel com aspas triplas vira problema", () => {
	const root = fixture();
	write(
		root,
		".agents/agents/reviewer/agent.md",
		"---\nname: reviewer\ndescription: Revisor\n---\n\nUse ''' aqui.\n"
	);

	assert.deepEqual(checkHarness(root), [
		".agents/agents/reviewer/agent.md: corpo não pode conter '''",
	]);
});

test("servidor MCP com campo sem porta Codex vira problema", () => {
	const root = fixture();
	write(
		root,
		".mcp.json",
		JSON.stringify({
			mcpServers: {
				remoto: { headers: { Authorization: "x" }, url: "https://x" },
			},
		})
	);

	assert.deepEqual(checkHarness(root), [
		".mcp.json: remoto usa campos sem porta Codex (headers)",
	]);
});
