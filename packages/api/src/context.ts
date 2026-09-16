import type { createAuth } from "@costura-pro/auth";
import type { Database } from "@costura-pro/db";

export type Context = {
	auth: null;
	session: Awaited<
		ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>
	>;
	db: Database;
};
