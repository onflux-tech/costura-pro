import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { AppRouterClient } from "@costura-pro/api/routers/index";
import { applyMigrations, closeDb, createDb } from "@costura-pro/db";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { type Subprocess, serve, sleep, spawn } from "bun";

import packageJson from "../package.json";

const serverDir = resolve(import.meta.dir, "..");
const webDist = resolve(serverDir, "../web/dist");
const lineBreak = /\r?\n/;
const whitespace = /\s+/;
const secureAttribute = /;\s*secure/i;
const sessionCookieName = /^costura-pro\.session_token=/;
const startupTimeoutMs = 15_000;
const canonicalOrigin = new URL("https://costura.exemplo.com.br");

let directory: string;
let port: number;
let baseUrl: string;
let subprocess: Subprocess;

function freePort() {
	const probe = serve({
		fetch: () => new Response(null),
		hostname: "127.0.0.1",
		port: 0,
	});
	const free = probe.port;
	probe.stop(true);
	if (free === undefined) {
		throw new Error("Nenhuma porta livre em 127.0.0.1");
	}
	return free;
}

async function waitUntilReady(deadline: number): Promise<void> {
	if (subprocess.exitCode !== null) {
		const stderr = await new Response(
			subprocess.stderr as ReadableStream
		).text();
		throw new Error(
			`Servidor saiu com código ${subprocess.exitCode}: ${stderr}`
		);
	}
	if (Date.now() > deadline) {
		throw new Error("Servidor de produção não respondeu a tempo");
	}
	const ready = await fetch(`${baseUrl}/api/auth/ok`).then(
		(response) => response.ok,
		() => false
	);
	if (ready) {
		return;
	}
	await sleep(100);
	return waitUntilReady(deadline);
}

async function listeningAddresses(): Promise<string[]> {
	const suffix = `:${port}`;
	if (process.platform === "win32") {
		const netstat = spawn(["netstat", "-ano"], { stdout: "pipe" });
		const rows = (await new Response(netstat.stdout).text())
			.split(lineBreak)
			.map((line) => line.trim().split(whitespace));
		return rows
			.filter(
				([protocol, local, remote]) =>
					protocol?.startsWith("TCP") &&
					local?.endsWith(suffix) &&
					remote?.endsWith(":0")
			)
			.map(([, local]) => local ?? "");
	}
	const ss = spawn(["ss", "-Hltn", `sport = ${suffix}`], {
		stdout: "pipe",
	});
	return (await new Response(ss.stdout).text())
		.split(lineBreak)
		.filter(Boolean)
		.map((line) => line.trim().split(whitespace)[3] ?? "");
}

beforeAll(async () => {
	directory = await mkdtemp(join(tmpdir(), "costura-pro-production-"));
	const databaseFile = join(directory, "atelier.db");
	const db = createDb({ DATABASE_FILE: databaseFile });
	applyMigrations(db);
	closeDb(db);

	port = freePort();
	baseUrl = `http://127.0.0.1:${port}`;
	const [runtime, ...startArgs] = packageJson.scripts.start.split(whitespace);
	if (runtime !== "bun") {
		throw new Error(`Script start deve rodar com bun: ${runtime}`);
	}
	const { NODE_ENV: _inheritedNodeEnv, ...inherited } = process.env;
	subprocess = spawn([process.execPath, ...startArgs], {
		cwd: serverDir,
		env: {
			...inherited,
			BETTER_AUTH_SECRET: "segredo-so-para-bun-test-0000000000",
			CANONICAL_ORIGIN: canonicalOrigin.origin,
			DATABASE_FILE: databaseFile,
			PORT: String(port),
		},
		stderr: "pipe",
		stdout: "ignore",
	});
	await waitUntilReady(Date.now() + startupTimeoutMs);
}, startupTimeoutMs + 5000);

afterAll(async () => {
	subprocess.kill();
	await subprocess.exited;
	await rm(directory, { force: true, recursive: true });
});

function signUp(host: string, origin: string, email: string) {
	return fetch(`${baseUrl}/api/auth/sign-up/email`, {
		body: JSON.stringify({ email, name: "Dono", password: "senha-forte-123" }),
		headers: { "content-type": "application/json", host, origin },
		method: "POST",
	});
}

describe("production build in one loopback process", () => {
	test("Better Auth trusts loopback and canonical origins with Secure only on the canonical host", async () => {
		const responses = await Promise.all([
			signUp(`127.0.0.1:${port}`, baseUrl, "loopback@costura.test"),
			signUp(
				`localhost:${port}`,
				`http://localhost:${port}`,
				"localhost@costura.test"
			),
			signUp(
				canonicalOrigin.host,
				canonicalOrigin.origin,
				"canonico@costura.test"
			),
		]);
		expect(responses.map((response) => response.status)).toEqual([
			200, 200, 200,
		]);
		const sessionCookies = responses.map(
			(response) =>
				response.headers
					.getSetCookie()
					.find((cookie) => sessionCookieName.test(cookie)) ?? ""
		);
		expect(sessionCookies.map((cookie) => cookie !== "")).toEqual([
			true,
			true,
			true,
		]);
		expect(
			sessionCookies.map((cookie) => secureAttribute.test(cookie))
		).toEqual([false, false, true]);
	});

	test("serves the built SPA for / and internal routes", async () => {
		const responses = await Promise.all(
			["/", "/dashboard"].map((path) => fetch(`${baseUrl}${path}`))
		);
		const bodies = await Promise.all(responses.map((r) => r.text()));
		for (const [index, response] of responses.entries()) {
			expect(response.status).toBe(200);
			expect(response.headers.get("cache-control")).toBe("no-cache");
			expect(bodies[index]).toContain('<div id="app">');
		}
	});

	test("serves a real built asset with immutable cache", async () => {
		const assets = await readdir(join(webDist, "assets"));
		const script = assets.find((name) => name.endsWith(".js"));
		expect(script).toBeDefined();
		const response = await fetch(`${baseUrl}/assets/${script}`);
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=31536000, immutable"
		);
	});

	test("answers /rpc and /api/auth from the same process", async () => {
		const client: AppRouterClient = createORPCClient(
			new RPCLink({ url: `${baseUrl}/rpc` })
		);
		expect(await client.healthCheck()).toBe("OK");
		const auth = await fetch(`${baseUrl}/api/auth/ok`);
		expect(await auth.json()).toEqual({ ok: true });
	});

	test("service worker denies navigation fallback for /api and /rpc", async () => {
		const serviceWorker = await (await fetch(`${baseUrl}/sw.js`)).text();
		expect(serviceWorker).toContain("denylist");
		expect(serviceWorker).toContain("/^\\/api(\\/|-reference|$)/");
		expect(serviceWorker).toContain("/^\\/rpc(\\/|$)/");
	});

	test("listens only on 127.0.0.1", async () => {
		expect(new Set(await listeningAddresses())).toEqual(
			new Set([`127.0.0.1:${port}`])
		);
	});
});
