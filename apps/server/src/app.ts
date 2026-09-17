import { ensureInstallation } from "@costura-pro/api/installation/store";
import { ensureMeasurementTemplates } from "@costura-pro/api/measurements/seed";
import { appRouter } from "@costura-pro/api/routers/index";
import type { Auth } from "@costura-pro/auth";
import type { Database } from "@costura-pro/db";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
	type BetterAuthInstance,
	createAuthMiddleware,
} from "evlog/better-auth";
import { type EvlogHonoOptions, type EvlogVariables, evlog } from "evlog/hono";
import { type Context, Hono } from "hono";

import {
	authBasePath,
	authRoutes,
	signInGuard,
	signInUsernameRoute,
} from "./auth-routes";
import { createContext } from "./context";
import { originGuard, secureCookiesOnCanonicalHost } from "./origin";
import { serveWeb } from "./web";

export type AppOptions = {
	auth: Auth;
	canonicalOrigin?: URL;
	db: Database;
	drain?: EvlogHonoOptions["drain"];
	now?: () => Date;
	webRoot?: string;
};

type ValidationIssue = { code?: unknown; path?: unknown };

function logProcedureError(error: unknown) {
	if (error instanceof ORPCError) {
		const issues = (error.cause as { issues?: ValidationIssue[] } | undefined)
			?.issues;
		console.error({
			code: error.code,
			issues: issues?.map(({ code, path }) => ({ code, path })),
			message: error.message,
			status: error.status,
		});
		return;
	}
	console.error(
		error instanceof Error
			? { message: error.message, name: error.name, stack: error.stack }
			: { error: "erro desconhecido" }
	);
}

const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [onError(logProcedureError)],
});

const apiReferenceHandler = new OpenAPIHandler(appRouter, {
	interceptors: [onError(logProcedureError)],
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
	now = () => new Date(),
	webRoot,
}: AppOptions) {
	const bootedAt = now();
	ensureInstallation(db, bootedAt);
	ensureMeasurementTemplates(db, bootedAt);
	const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
		maskEmail: true,
	});
	const app = new Hono<EvlogVariables>();

	async function apiContext(c: Context<EvlogVariables>) {
		await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
		return createContext({ auth, context: c, db, now });
	}

	app.use(evlog({ drain }));
	app.use(originGuard(canonicalOrigin));
	app.use(secureCookiesOnCanonicalHost(canonicalOrigin));

	app.use(signInUsernameRoute, signInGuard({ db, now }));
	app.on(["POST", "GET"], `${authBasePath}/*`, authRoutes(auth));

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
