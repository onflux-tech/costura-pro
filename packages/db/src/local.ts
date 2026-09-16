import { join } from "node:path";

import { applyMigrations, closeDb, createDb } from "./index";

const database = createDb({ DATABASE_FILE: join(process.cwd(), "local.db") });

try {
	applyMigrations(database);
} finally {
	closeDb(database);
}
