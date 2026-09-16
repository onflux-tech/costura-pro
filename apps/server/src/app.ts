import { appRouter } from "@costura-pro/api/routers/index";
import type { Auth } from "@costura-pro/auth";
import type { Database } from "@costura-pro/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
	type BetterAuthInstance,
	createAuthMiddleware,
} from "evlog/better-auth";
import { type EvlogHonoOptions, type EvlogVariables, evlog } from "evlog/hono";
import { type Context, Hono } from "hono";

import { createContext } from "./context";
import { originGuard, secureCookiesOnCanonicalHost } from "./origin";
import { serveWeb } from "./web";

export type AppOptions = {
	auth: Auth;
	canonicalOrigin?: URL;
	db: Database;
	drain?: EvlogHonoOptions["drain"];
	webRoot?: string;
};

const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

const apiReferenceHandler = new OpenAPIHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
});

export function createApp({
	auth,
	canonicalOrigin,
	db,
	drain,
	webRoot,
}: AppOptions) {
	const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
		maskEmail: true,
	});
	const app = new Hono<EvlogVariables>();

	async function apiContext(c: Context<EvlogVariables>) {
		await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
		return createContext({ auth, context: c, db });
	}

	app.use(evlog({ drain }));
	app.use(originGuard(canonicalOrigin));
	app.use(secureCookiesOnCanonicalHost(canonicalOrigin));

	app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

	app.use("/rpc/*", async (c, next) => {
		const result = await rpcHandler.handle(c.req.raw, {
			context: await apiContext(c),
			prefix: "/rpc",
		});
		if (result.matched) {
			return c.newResponse(result.response.body, result.response);
		}
		await next();
	});

	app.use("/api-reference/*", async (c, next) => {
		const result = await apiReferenceHandler.handle(c.req.raw, {
			context: await apiContext(c),
			prefix: "/api-reference",
		});
		if (result.matched) {
			return c.newResponse(result.response.body, result.response);
		}
		await next();
	});

	if (webRoot !== undefined) {
		serveWeb(app, webRoot);
	}

	return app;
}
