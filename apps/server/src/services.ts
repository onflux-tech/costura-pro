import { createAuth } from "@costura-pro/auth";
import { createDb, type Database } from "@costura-pro/db";

import { desktopOrigins, env } from "./env.server";

const db = createDb(env);

export function getDb(): Database {
	return db;
}
export const auth = createAuth(env, db, desktopOrigins);
