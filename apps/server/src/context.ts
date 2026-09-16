import type { Context as ApiContext } from "@costura-pro/api/context";
import type { Auth } from "@costura-pro/auth";
import type { Database } from "@costura-pro/db";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
	auth: Auth;
	context: HonoContext;
	db: Database;
};

export async function createContext({
	auth,
	context,
	db,
}: CreateContextOptions): Promise<ApiContext> {
	const session = await auth.api.getSession({
		headers: context.req.raw.headers,
	});
	return {
		auth: null,
		db,
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
