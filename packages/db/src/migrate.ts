import "varlock/auto-load";

import { ENV as env } from "./env";
import { applyMigrations, closeDb, createDb } from "./index";

const database = createDb(env);

try {
	applyMigrations(database);
} finally {
	closeDb(database);
}
