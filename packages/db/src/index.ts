import { Database as NativeDatabase } from "bun:sqlite";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import type { DatabaseConfig } from "./config";
import * as schema from "./schema";

const connections = new WeakMap<Database, NativeDatabase>();
const migrationsFolder = fileURLToPath(
	new URL("./migrations", import.meta.url)
);
const remoteDatabaseUrl = /^[a-z][a-z\d+.-]*:\/\//i;
const urlScheme = /^[a-z][a-z\d+.-]*:/i;
const windowsDrivePath = /^[a-z]:[\\/]/i;
const networkPath = /^(?:\\\\|\/\/)/;

export function createDb(env: DatabaseConfig) {
	const databaseFile = validateDatabaseFile(env.DATABASE_FILE);

	const client = new NativeDatabase(databaseFile, { create: true });
	client.run("PRAGMA foreign_keys = ON");
	client.run("PRAGMA journal_mode = WAL");
	client.run("PRAGMA secure_delete = ON");
	const database = drizzle({ client, schema });
	connections.set(database, client);

	return database;
}

export function getNativeDatabase(database: Database): NativeDatabase {
	const client = connections.get(database);
	if (!client) {
		throw new RangeError("Conexão SQLite não pertence ao Costura Pro");
	}
	return client;
}

export function closeDb(database: Database) {
	const client = getNativeDatabase(database);
	// close() adia o fechamento enquanto houver statements do Drizzle abertos, e no
	// Windows o arquivo segue travado; close(true) fecha na hora e libera o arquivo.
	client.close(true);
	connections.delete(database);
}

export function truncateWal(database: Database) {
	getNativeDatabase(database).run("PRAGMA wal_checkpoint(TRUNCATE)");
}

export function applyMigrations(database: Database) {
	migrate(database, { migrationsFolder });
}

export function validateDatabaseFile(databaseFile: string): string {
	const isLocalFile =
		databaseFile.length > 0 &&
		databaseFile !== ":memory:" &&
		!remoteDatabaseUrl.test(databaseFile) &&
		!networkPath.test(databaseFile) &&
		(isAbsolute(databaseFile) || windowsDrivePath.test(databaseFile)) &&
		(!urlScheme.test(databaseFile) || windowsDrivePath.test(databaseFile));
	if (!isLocalFile) {
		throw new RangeError(
			"DATABASE_FILE deve apontar para um arquivo SQLite local"
		);
	}
	return databaseFile;
}

export type Database = ReturnType<typeof createDb>;
