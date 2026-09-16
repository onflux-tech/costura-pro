import { Database as NativeDatabase } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	applyMigrations,
	closeDb,
	createDb,
	getNativeDatabase,
	validateDatabaseFile,
} from "../src/index";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true }))
	);
});

async function createTemporaryDatabaseFile() {
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-db-"));
	temporaryDirectories.push(directory);
	return {
		backupFile: join(directory, "backup.db"),
		databaseFile: join(directory, "atelier.db"),
	};
}

test("opens a local SQLite database with WAL and makes a VACUUM backup after rollback", async () => {
	const { backupFile, databaseFile } = await createTemporaryDatabaseFile();
	const db = createDb({ DATABASE_FILE: databaseFile });

	try {
		const native = getNativeDatabase(db);
		expect(native.query("PRAGMA journal_mode").get()).toEqual({
			journal_mode: "wal",
		});
		expect(native.query("PRAGMA integrity_check").get()).toEqual({
			integrity_check: "ok",
		});
		native.run("CREATE TABLE ledger (entry TEXT NOT NULL)");
		expect(() => {
			native.transaction(() => {
				native.run("INSERT INTO ledger (entry) VALUES (?)", ["discarded"]);
				throw new Error("rollback");
			})();
		}).toThrow("rollback");
		expect(native.query("SELECT count(*) AS count FROM ledger").get()).toEqual({
			count: 0,
		});
		native.run(`VACUUM INTO '${backupFile.replaceAll("'", "''")}'`);
	} finally {
		closeDb(db);
	}

	const backup = new NativeDatabase(backupFile, { readonly: true });
	expect(backup.query("PRAGMA integrity_check").get()).toEqual({
		integrity_check: "ok",
	});
	backup.close();
});

test("rejects remote URLs and in-memory files for the operational database", () => {
	expect(() => createDb({ DATABASE_FILE: "libsql://remote.example" })).toThrow(
		RangeError
	);
	expect(() => createDb({ DATABASE_FILE: ":memory:" })).toThrow(RangeError);
	expect(() => createDb({ DATABASE_FILE: "atelier.db" })).toThrow(RangeError);
	expect(() => createDb({ DATABASE_FILE: "file:atelier.db" })).toThrow(
		RangeError
	);
});

test("accepts only absolute local paths, including Windows drive paths", () => {
	expect(validateDatabaseFile("C:\\Costura Pro\\atelier.db")).toBe(
		"C:\\Costura Pro\\atelier.db"
	);
	expect(() => validateDatabaseFile("C:atelier.db")).toThrow(RangeError);
	expect(() => validateDatabaseFile("\\\\server\\share\\atelier.db")).toThrow(
		RangeError
	);
	expect(() => validateDatabaseFile("//server/share/atelier.db")).toThrow(
		RangeError
	);
});

test("applies the auth migration to a native SQLite file", async () => {
	const { databaseFile } = await createTemporaryDatabaseFile();
	const db = createDb({ DATABASE_FILE: databaseFile });

	try {
		applyMigrations(db);
		expect(
			getNativeDatabase(db)
				.query(
					"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user'"
				)
				.get()
		).toEqual({ name: "user" });
	} finally {
		closeDb(db);
	}
});
