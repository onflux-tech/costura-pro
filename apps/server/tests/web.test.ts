import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { createApp } from "../src/app";
import {
	canonicalOrigin,
	loopbackHost,
	startTestServer,
	type TestServer,
} from "./support";

const indexHtml = '<!doctype html><div id="app"></div>';
const assetPath = "assets/index-abc123.js";

let server: TestServer;

beforeAll(async () => {
	server = await startTestServer({
		[assetPath]: "console.log('asset');",
		"index.html": indexHtml,
	});
});

afterAll(async () => {
	await server.close();
});

describe("SPA served by the process", () => {
	test("serves index.html without cache for / and internal routes", async () => {
		const responses = await Promise.all(
			["/", "/dashboard", "/clientes/42"].map((path) => server.send(path))
		);
		for (const response of responses) {
			expect(response.status).toBe(200);
			expect(response.headers.get("cache-control")).toBe("no-cache");
		}
		const bodies = await Promise.all(responses.map((r) => r.text()));
		expect(bodies).toEqual([indexHtml, indexHtml, indexHtml]);
	});

	test("serves hashed assets with immutable cache", async () => {
		const response = await server.send(`/${assetPath}`);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=31536000, immutable"
		);
		expect(await response.text()).toBe("console.log('asset');");
	});

	test("answers 404 for a missing asset", async () => {
		const response = await server.send("/assets/ausente.js");
		expect(response.status).toBe(404);
		expect(await response.text()).not.toBe(indexHtml);
	});

	test("answers 404 without HTML for unknown /api and /rpc paths", async () => {
		const responses = await Promise.all(
			["/api", "/rpc", "/api/desconhecido", "/rpc/desconhecido"].map((path) =>
				server.send(path)
			)
		);
		for (const response of responses) {
			expect(response.status).toBe(404);
		}
		const bodies = await Promise.all(responses.map((r) => r.text()));
		expect(bodies).not.toContain(indexHtml);
	});

	test("guards the SPA against a Host outside the allowlist", async () => {
		const response = await server.send("/dashboard", { host: "evil.example" });
		expect(response.status).toBe(403);
		expect(await response.text()).toBe("Host não permitido");
	});

	test("keeps /api-reference out of the SPA fallback", async () => {
		const response = await server.send("/api-reference");
		expect(await response.text()).not.toBe(indexHtml);
	});
});

describe("without SPA and with a missing build", () => {
	test("does not serve the SPA without webRoot", async () => {
		const devApp = createApp({
			auth: server.auth,
			canonicalOrigin,
			db: server.db,
		});
		const response = await devApp.request("/dashboard", {
			headers: { host: loopbackHost },
		});
		expect(response.status).toBe(404);
	});

	test("throws an installation error when the web build is missing", async () => {
		const webRoot = join(server.directory, "sem-build");
		await mkdir(webRoot);
		expect(() =>
			createApp({
				auth: server.auth,
				canonicalOrigin,
				db: server.db,
				webRoot,
			})
		).toThrow(
			`Instalação incompleta: build da web não encontrado em ${webRoot}. Rode pnpm build.`
		);
	});
});
