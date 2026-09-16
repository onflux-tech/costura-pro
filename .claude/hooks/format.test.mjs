import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { plan } from "./format.mjs";

const root = join(tmpdir(), "costura-format");

test("formata código e JSON do projeto com biome", () => {
	for (const file of [
		"apps/web/src/routes/index.tsx",
		"packages/db/src/index.ts",
		"scripts/harness.mjs",
		".claude/settings.json",
	]) {
		const result = plan(join(root, file), root);
		assert.equal(result?.tool, "biome", file);
		assert.equal(result.rel, file);
	}
});

test("só formata: fix de lint apagaria import ainda não usado entre dois Edits", () => {
	const result = plan(join(root, "apps/web/src/main.tsx"), root);

	assert.equal(result.args[0], "format");
	assert.ok(result.args.includes("--write"));
});

test("não formata markdown, portas geradas, dependências, arquivos gerados nem fora do repo", () => {
	for (const file of [
		"docs/PRD.md",
		".claude/skills/shadcn/evals/evals.json",
		".agents/skills/shadcn/evals/evals.json",
		".codex/config.toml",
		"node_modules/x/index.js",
		"apps/web/dist/assets/index.js",
		"apps/web/src/routeTree.gen.ts",
		"apps/server/src/env.ts",
	]) {
		assert.equal(plan(join(root, file), root), null, file);
	}
	assert.equal(plan(join(tmpdir(), "fora.ts"), root), null);
	assert.equal(plan(undefined, root), null);
});
