import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { classifyAccess } from "../src/access";
import { authPathAllowlist } from "../src/auth-routes";
import {
	canonicalOrigin,
	inSequence,
	loopbackHost,
	rpc,
	startTestServer,
	type TestServer,
} from "./support";

const uuid = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/;

let server: TestServer;

beforeAll(async () => {
	server = await startTestServer();
});

afterAll(async () => {
	await server.close();
});

describe("classifyAccess", () => {
	test("loopback hosts without cf-connecting-ip are local", () => {
		for (const host of [loopbackHost, "localhost:3001", "LOCALHOST"]) {
			expect(classifyAccess(new Headers({ host }))).toEqual({
				access: "local",
				ip: null,
			});
		}
	});

	test("the canonical host is remote", () => {
		expect(
			classifyAccess(
				new Headers({
					"cf-connecting-ip": "203.0.113.9",
					host: canonicalOrigin.host,
				})
			)
		).toEqual({ access: "remote", ip: "203.0.113.9" });
		expect(classifyAccess(new Headers({ host: canonicalOrigin.host }))).toEqual(
			{ access: "remote", ip: null }
		);
	});

	test("a loopback host carrying cf-connecting-ip is remote", () => {
		expect(
			classifyAccess(
				new Headers({ "cf-connecting-ip": "2001:db8::1", host: loopbackHost })
			)
		).toEqual({ access: "remote", ip: "2001:db8::1" });
	});

	test("ignores an invalid or listed cf-connecting-ip value", () => {
		for (const value of ["not-an-ip", "203.0.113.9, 198.51.100.1", ""]) {
			expect(
				classifyAccess(
					new Headers({ "cf-connecting-ip": value, host: loopbackHost })
				)
			).toEqual({ access: "remote", ip: null });
		}
	});
});

describe("Better Auth allowlist", () => {
	test("closed routes answer 404 without reaching Better Auth", async () => {
		const closed: [string, string][] = [
			["POST", "/api/auth/sign-up/email"],
			["POST", "/api/auth/sign-in/email"],
			["POST", "/api/auth/is-username-available"],
			["POST", "/api/auth/update-user"],
			["POST", "/api/auth/request-password-reset"],
			["GET", "/api/auth/list-accounts"],
		];
		const answers = await inSequence(closed, async ([method, path]) => {
			const response = await server.send(path, {
				body: method === "POST" ? {} : undefined,
				method,
			});
			return `${method} ${path} ${response.status}`;
		});
		expect(answers).toEqual(
			closed.map(([method, path]) => `${method} ${path} 404`)
		);
	});

	test("open routes still answer", async () => {
		const response = await server.send("/api/auth/ok");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});
});

describe("installation singleton", () => {
	test("a fresh installation starts empty with a UUID epoch", async () => {
		expect(await rpc(server).installation.status()).toEqual({
			state: "empty",
		});
		expect(
			await rpc(server, { access: "remote" }).installation.status()
		).toEqual({ state: "empty" });
		const rows = server
			.native()
			.query<{ epoch: string; singleton: number; version: number }, []>(
				"SELECT epoch, singleton, version FROM installation"
			)
			.all();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.singleton).toBe(1);
		expect(rows[0]?.version).toBe(1);
		expect(rows[0]?.epoch).toMatch(uuid);
	});

	test("reopening the server keeps the same installation", () => {
		const [before] = server
			.native()
			.query<{ epoch: string }, []>("SELECT epoch FROM installation")
			.all();
		server.reopen();
		const after = server
			.native()
			.query<{ epoch: string }, []>("SELECT epoch FROM installation")
			.all();
		expect(after).toEqual([before as { epoch: string }]);
	});
});

describe("allowlist contract", () => {
	test("the allowlist is exactly the routes the product uses", () => {
		expect([...authPathAllowlist].sort()).toEqual([
			"/change-password",
			"/get-session",
			"/list-sessions",
			"/ok",
			"/revoke-other-sessions",
			"/revoke-session",
			"/sign-in/username",
			"/sign-out",
		]);
	});

	test("every other Better Auth endpoint answers 404", async () => {
		const paths = new Set(
			Object.values(server.auth.api)
				.map((endpoint) => (endpoint as { path?: unknown }).path)
				.filter((path): path is string => typeof path === "string")
		);
		expect(paths.size).toBeGreaterThan(20);
		const closed = [...paths].filter((path) => !authPathAllowlist.has(path));
		const answers = await inSequence(closed, async (path) => {
			const response = await server.send(`/api/auth${path}`, {
				body: {},
				method: "POST",
			});
			return `${path} ${response.status}`;
		});
		expect(answers).toEqual(closed.map((path) => `${path} 404`));
	});

	test("sign-out stays reachable", async () => {
		const response = await server.send("/api/auth/sign-out", {
			body: {},
			method: "POST",
			origin: "http://127.0.0.1:3000",
		});
		expect(response.status).not.toBe(404);
	});
});
