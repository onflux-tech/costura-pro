import { existsSync } from "node:fs";
import { join } from "node:path";
import type { EvlogVariables } from "evlog/hono";
import type { Context, Hono } from "hono";
import { serveStatic } from "hono/bun";

const immutableCache = "public, max-age=31536000, immutable";
const revalidateCache = "no-cache";
const serverPath = /^\/(?:api(?:\/|-reference|$)|rpc(?:\/|$))/;

function cacheControl(value: string) {
	return (_path: string, c: Context) => {
		c.header("Cache-Control", value);
	};
}

export function serveWeb(app: Hono<EvlogVariables>, webRoot: string) {
	if (!existsSync(join(webRoot, "index.html"))) {
		throw new Error(
			`Instalação incompleta: build da web não encontrado em ${webRoot}. Rode pnpm build.`
		);
	}

	app.get(
		"/assets/*",
		serveStatic({ onFound: cacheControl(immutableCache), root: webRoot })
	);
	app.get("/assets/*", (c) => c.notFound());

	app.get("*", async (c, next) => {
		if (serverPath.test(c.req.path)) {
			return c.notFound();
		}
		await next();
	});
	app.get(
		"*",
		serveStatic({ onFound: cacheControl(revalidateCache), root: webRoot })
	);
	app.get(
		"*",
		serveStatic({
			onFound: cacheControl(revalidateCache),
			path: "index.html",
			root: webRoot,
		})
	);
}
