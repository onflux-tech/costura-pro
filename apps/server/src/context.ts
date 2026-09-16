import type { Context as ApiContext } from "@costura-pro/api/context";
import type { Context as HonoContext } from "hono";
import { auth, getDb } from "./services";

export type CreateContextOptions = {
	context: HonoContext;
};

export async function createContext({
	context,
}: CreateContextOptions): Promise<ApiContext> {
	const db = await getDb();
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
