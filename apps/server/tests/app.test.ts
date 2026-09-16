import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
	canonicalOrigin,
	loopbackHost,
	loopbackOrigin,
	rpcClient,
	startTestServer,
	type TestServer,
} from "./support";

const secureAttribute = /;\s*secure/i;
const sessionCookieName = /^costura-pro\.session_token=/;
const password = "senha-forte-123";

let server: TestServer;

beforeAll(async () => {
	server = await startTestServer();
});

afterAll(async () => {
	await server.close();
});

function sessionSetCookie(response: Response) {
	return response.headers
		.getSetCookie()
		.find((cookie) => sessionCookieName.test(cookie));
}

function signUp(email: string, host = loopbackHost, origin = loopbackOrigin) {
	return server.send("/api/auth/sign-up/email", {
		body: { email, name: "Dono", password },
		host,
		method: "POST",
		origin,
	});
}

describe("Host and Origin guard", () => {
	test("rejects a Host outside the allowlist with 403", async () => {
		const response = await server.send("/api/auth/ok", {
			host: "evil.example",
		});
		expect(response.status).toBe(403);
		expect(await response.text()).toBe("Host não permitido");
	});

	test("rejects a foreign Origin before Better Auth", async () => {
		const response = await server.send("/api/auth/sign-in/email", {
			body: { email: "dono@costura.test", password },
			method: "POST",
			origin: "https://evil.example",
		});
		expect(response.status).toBe(403);
		expect(await response.text()).toBe("Origem não permitida");
	});

	test("guards /rpc against a same-site Origin on another port even with a valid session", async () => {
		const response = await signUp("guarda-rpc@costura.test");
		const cookie = sessionSetCookie(response)?.split(";")[0] ?? "";
		const guarded = await server.send("/rpc/privateData", {
			body: {},
			cookie,
			method: "POST",
			origin: "http://127.0.0.1:3001",
		});
		expect(guarded.status).toBe(403);
		expect(await guarded.text()).toBe("Origem não permitida");
	});

	test("guards /rpc against a Host outside the allowlist", async () => {
		const response = await server.send("/rpc/healthCheck", {
			body: {},
			host: "evil.example",
			method: "POST",
		});
		expect(response.status).toBe(403);
		expect(await response.text()).toBe("Host não permitido");
	});
});

describe("session cookie per origin", () => {
	test("sign-up over loopback sets the session cookie without Secure and with SameSite=Lax", async () => {
		const response = await signUp("loopback@costura.test");
		expect(response.status).toBe(200);
		const cookie = sessionSetCookie(response);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).not.toMatch(secureAttribute);
	});

	test("sign-up over the canonical host sets the session cookie with Secure", async () => {
		const response = await signUp(
			"canonico@costura.test",
			canonicalOrigin.host,
			canonicalOrigin.origin
		);
		expect(response.status).toBe(200);
		expect(sessionSetCookie(response)).toMatch(secureAttribute);
	});

	test("the session cookie authenticates /rpc on the same origin", async () => {
		const response = await signUp("rpc@costura.test");
		const cookie = sessionSetCookie(response)?.split(";")[0] ?? "";
		const client = rpcClient(server, {
			cookie,
			host: loopbackHost,
			origin: loopbackOrigin,
		});
		expect(await client.privateData()).toMatchObject({
			message: "This is private",
		});
	});
});

describe("API routes", () => {
	test("/api/auth/ok answers JSON", async () => {
		const response = await server.send("/api/auth/ok");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	test("/rpc/healthCheck answers through the oRPC client", async () => {
		expect(await rpcClient(server, { host: loopbackHost }).healthCheck()).toBe(
			"OK"
		);
	});

	test("/api-reference/spec.json answers from the server", async () => {
		const response = await server.send("/api-reference/spec.json");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("application/json");
	});
});
