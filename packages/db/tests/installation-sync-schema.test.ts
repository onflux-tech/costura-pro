import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	applyMigrations,
	closeDb,
	createDb,
	type Database,
	getNativeDatabase,
} from "../src/index";

const openDatabases: Database[] = [];
const temporaryDirectories: string[] = [];

afterEach(async () => {
	for (const database of openDatabases.splice(0)) {
		closeDb(database);
	}
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true }))
	);
});

async function migratedDatabase() {
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-schema-"));
	temporaryDirectories.push(directory);
	const database = createDb({ DATABASE_FILE: join(directory, "atelier.db") });
	openDatabases.push(database);
	applyMigrations(database);
	return getNativeDatabase(database);
}

function columns(native: ReturnType<typeof getNativeDatabase>, table: string) {
	return native
		.query<{ name: string }, []>(
			`SELECT name FROM pragma_table_info('${table}')`
		)
		.all()
		.map((row) => row.name);
}

describe("installation, access and sync schema", () => {
	test("creates installation, access and sync tables", async () => {
		const native = await migratedDatabase();
		const tables = native
			.query<{ name: string }, []>(
				"SELECT name FROM sqlite_master WHERE type = 'table'"
			)
			.all()
			.map((row) => row.name);
		expect(tables).toEqual(
			expect.arrayContaining([
				"installation",
				"sign_in_guard",
				"recovery_code",
				"audit_event",
				"rate_limit",
				"device",
				"device_activation_code",
				"operation",
				"change_log",
				"sync_conflict",
			])
		);
		expect(columns(native, "user")).toContain("username");
		expect(columns(native, "rate_limit")).toEqual(
			expect.arrayContaining(["key", "count", "last_request"])
		);
		expect(columns(native, "operation")).toEqual(
			expect.arrayContaining(["op_id", "device_id", "op_hash", "result"])
		);
	});

	test("keeps a single installation row", async () => {
		const native = await migratedDatabase();
		const insert = (id: string, singleton: number) =>
			native.run(
				"INSERT INTO installation (id, singleton, state, epoch, version, created_at, updated_at) VALUES (?, ?, 'empty', 'epoch', 1, 1, 1)",
				[id, singleton]
			);
		insert("a", 1);
		expect(() => insert("b", 1)).toThrow();
		expect(() => insert("c", 2)).toThrow();
	});

	test("keeps audit_event and change_log append-only", async () => {
		const native = await migratedDatabase();
		native.run(
			"INSERT INTO audit_event (id, occurred_at, type, access, outcome, details) VALUES ('a', 1, 'auth.sign_in', 'local', 'failed', '{}')"
		);
		native.run(
			"INSERT INTO change_log (epoch, aggregate_type, aggregate_id, version, data, changed_at) VALUES ('e', 'device', 'd', 1, '{}', 1)"
		);
		expect(() => native.run("UPDATE audit_event SET type = 'x'")).toThrow(
			"append-only"
		);
		expect(() => native.run("DELETE FROM audit_event")).toThrow("append-only");
		expect(() => native.run("UPDATE change_log SET version = 2")).toThrow(
			"append-only"
		);
		expect(() => native.run("DELETE FROM change_log")).toThrow("append-only");
	});
});
