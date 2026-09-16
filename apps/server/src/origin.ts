import type { MiddlewareHandler } from "hono";

const loopbackHostnames = new Set(["127.0.0.1", "localhost"]);
const hostWithOptionalPort = /^([a-z\d.-]+)(?::\d{1,5})?$/;
const secureAttribute = /;\s*secure\s*(?:;|$)/i;

export function parseCanonicalOrigin(
	value: string | undefined
): URL | undefined {
	if (value === undefined || value === "") {
		return;
	}
	const url = URL.canParse(value) ? new URL(value) : undefined;
	const isBareHttpsOrigin =
		url?.protocol === "https:" &&
		url.pathname === "/" &&
		url.search === "" &&
		url.hash === "" &&
		url.username === "" &&
		url.password === "";
	if (!isBareHttpsOrigin) {
		throw new RangeError(
			"CANONICAL_ORIGIN deve ser uma origem https sem caminho, como https://costura.exemplo.com.br"
		);
	}
	return url;
}

export function isLoopbackHost(host: string | null | undefined): boolean {
	const hostname =
		hostWithOptionalPort.exec((host ?? "").toLowerCase())?.[1] ?? "";
	return loopbackHostnames.has(hostname);
}

export function expectedOrigin(
	host: string | undefined,
	canonical: URL | undefined
): string | undefined {
	if (host === undefined) {
		return;
	}
	const normalized = host.toLowerCase();
	if (normalized === canonical?.host) {
		return canonical.origin;
	}
	const hostname = hostWithOptionalPort.exec(normalized)?.[1] ?? "";
	return loopbackHostnames.has(hostname) ? `http://${normalized}` : undefined;
}

export function originGuard(canonical: URL | undefined): MiddlewareHandler {
	return async (c, next) => {
		const allowed = expectedOrigin(c.req.header("host"), canonical);
		if (allowed === undefined) {
			return c.text("Host não permitido", 403);
		}
		const origin = c.req.header("origin");
		if (origin !== undefined && origin.toLowerCase() !== allowed) {
			return c.text("Origem não permitida", 403);
		}
		await next();
	};
}

export function secureCookiesOnCanonicalHost(
	canonical: URL | undefined
): MiddlewareHandler {
	return async (c, next) => {
		await next();
		if (
			canonical === undefined ||
			c.req.header("host")?.toLowerCase() !== canonical.host
		) {
			return;
		}
		const cookies = c.res.headers.getSetCookie();
		if (cookies.length === 0) {
			return;
		}
		c.res.headers.delete("set-cookie");
		for (const cookie of cookies) {
			c.res.headers.append(
				"set-cookie",
				secureAttribute.test(cookie) ? cookie : `${cookie}; Secure`
			);
		}
	};
}
