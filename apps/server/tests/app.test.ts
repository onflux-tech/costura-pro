import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
	canonicalOrigin,
	createOwnerDirect,
	forceInstallationState,
	loopbackHost,
	loopbackOrigin,
	ownerPassword,
	ownerUsername,
	rpc,
	sessionCookie,
	startTestServer,
	type TestServer,
} from "./support";

const secureAttribute = /;\s*secure/i;
const sessionCookieName = /^costura-pro\.session_token=/;

let server: TestServer;

beforeAll(async () => {
	server = await startTestServer();
	await createOwnerDirect(server);
});

afterAll(async () => {
	await server.close();
});

function sessionSetCookie(response: Response) {
	return response.headers
		.getSetCookie()
		.find((cookie) => sessionCookieName.test(cookie));
}

function signInOn(host: string, origin: string) {
	return server.send("/api/auth/sign-in/username", {
		body: { password: ownerPassword, username: ownerUsername },
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
		const response = await server.send("/api/auth/sign-in/username", {
			body: { password: ownerPassword, username: ownerUsername },
			method: "POST",
			origin: "https://evil.example",
		});
		expect(response.status).toBe(403);
		expect(await response.text()).toBe("Origem não permitida");
	});

	test("guards /rpc against a same-site Origin on another port even with a valid session", async () => {
		const cookie = sessionCookie(await signInOn(loopbackHost, loopbackOrigin));
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
	test("sign-in over loopback sets the session cookie without Secure and with SameSite=Lax", async () => {
		const response = await signInOn(loopbackHost, loopbackOrigin);
		expect(response.status).toBe(200);
		const cookie = sessionSetCookie(response);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).not.toMatch(secureAttribute);
	});

	test("sign-in over the canonical host sets the session cookie with Secure", async () => {
		const response = await signInOn(
			canonicalOrigin.host,
			canonicalOrigin.origin
		);
		expect(response.status).toBe(200);
		expect(sessionSetCookie(response)).toMatch(secureAttribute);
	});

	test("the session cookie authenticates /rpc on the same origin once the installation is ready", async () => {
		const cookie = sessionCookie(await signInOn(loopbackHost, loopbackOrigin));
		forceInstallationState(server, "ready");
		expect(await rpc(server, { cookie }).privateData()).toMatchObject({
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
		expect(await rpc(server).healthCheck()).toBe("OK");
	});

	test("/api-reference/spec.json answers from the server", async () => {
		const response = await server.send("/api-reference/spec.json");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("application/json");
	});
});
