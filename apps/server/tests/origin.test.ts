import { describe, expect, test } from "bun:test";
import { Hono } from "hono";

import {
	expectedOrigin,
	originGuard,
	parseCanonicalOrigin,
	secureCookiesOnCanonicalHost,
} from "../src/origin";

const canonical = new URL("https://costura.exemplo.com.br");
const loopbackHost = "127.0.0.1:3000";

function guardedApp() {
	const app = new Hono();
	app.use(originGuard(canonical));
	app.use(secureCookiesOnCanonicalHost(canonical));
	app.all("/eco", (c) => {
		c.header("set-cookie", "sessao=1; Path=/; HttpOnly", { append: true });
		c.header("set-cookie", "tema=escuro; Path=/; Secure", { append: true });
		return c.text("ok");
	});
	return app;
}

function send(headers: Record<string, string>, method = "GET") {
	return guardedApp().request("/eco", { headers, method });
}

describe("parseCanonicalOrigin", () => {
	test("returns undefined without a value", () => {
		expect(parseCanonicalOrigin(undefined)).toBeUndefined();
		expect(parseCanonicalOrigin("")).toBeUndefined();
	});

	test("normalizes a valid https origin", () => {
		expect(
			parseCanonicalOrigin("https://Costura.Exemplo.com.br/")?.origin
		).toBe("https://costura.exemplo.com.br");
	});

	test("requires https", () => {
		expect(() => parseCanonicalOrigin("http://costura.exemplo.com.br")).toThrow(
			RangeError
		);
	});

	test("rejects path, query, hash, credentials and invalid URLs", () => {
		const invalid = [
			"https://costura.exemplo.com.br/app",
			"https://costura.exemplo.com.br/?a=1",
			"https://costura.exemplo.com.br/#x",
			"https://dono:senha@costura.exemplo.com.br",
			"não é url",
		];
		for (const value of invalid) {
			expect(() => parseCanonicalOrigin(value)).toThrow(RangeError);
		}
	});
});

describe("expectedOrigin", () => {
	test("accepts localhost and 127.0.0.1 on any port", () => {
		expect(expectedOrigin("127.0.0.1:3000", undefined)).toBe(
			"http://127.0.0.1:3000"
		);
		expect(expectedOrigin("localhost:3001", undefined)).toBe(
			"http://localhost:3001"
		);
		expect(expectedOrigin("LOCALHOST", undefined)).toBe("http://localhost");
	});

	test("maps the canonical host to the canonical origin", () => {
		expect(expectedOrigin("costura.exemplo.com.br", canonical)).toBe(
			"https://costura.exemplo.com.br"
		);
	});

	test("rejects hosts that only look like loopback", () => {
		const hosts = [
			"evil.localhost.com",
			"evil.localhost:3000",
			"notlocalhost:3000",
			"localhost.evil.com",
			"127.0.0.1.nip.io",
			"0.0.0.0:3000",
			"[::1]:3000",
			"192.168.0.10:3000",
		];
		for (const host of hosts) {
			expect(expectedOrigin(host, canonical)).toBeUndefined();
		}
	});

	test("rejects a missing Host and a public host without canonical origin", () => {
		expect(expectedOrigin(undefined, canonical)).toBeUndefined();
		expect(expectedOrigin("costura.exemplo.com.br", undefined)).toBeUndefined();
	});
});

describe("originGuard", () => {
	test("accepts an Origin equal to the Host origin", async () => {
		const response = await send(
			{ host: loopbackHost, origin: "http://127.0.0.1:3000" },
			"POST"
		);
		expect(response.status).toBe(200);
	});

	test("lets requests without Origin through", async () => {
		expect((await send({ host: loopbackHost })).status).toBe(200);
	});

	test("rejects an Origin with a different port", async () => {
		const response = await send(
			{ host: loopbackHost, origin: "http://127.0.0.1:3001" },
			"POST"
		);
		expect(response.status).toBe(403);
		expect(await response.text()).toBe("Origem não permitida");
	});

	test("rejects a foreign Origin even on GET", async () => {
		const response = await send({
			host: loopbackHost,
			origin: "https://evil.example",
		});
		expect(response.status).toBe(403);
	});

	test("rejects a null Origin", async () => {
		const response = await send({ host: loopbackHost, origin: "null" }, "POST");
		expect(response.status).toBe(403);
	});

	test("rejects a Host outside the allowlist", async () => {
		const response = await send({ host: "evil.example" });
		expect(response.status).toBe(403);
		expect(await response.text()).toBe("Host não permitido");
	});
});

describe("secureCookiesOnCanonicalHost", () => {
	test("adds Secure only on the canonical host without duplicating it", async () => {
		const canonicalResponse = await send({ host: canonical.host });
		expect(canonicalResponse.headers.getSetCookie()).toEqual([
			"sessao=1; Path=/; HttpOnly; Secure",
			"tema=escuro; Path=/; Secure",
		]);

		const loopbackResponse = await send({ host: loopbackHost });
		expect(loopbackResponse.headers.getSetCookie()).toEqual([
			"sessao=1; Path=/; HttpOnly",
			"tema=escuro; Path=/; Secure",
		]);
	});
});
