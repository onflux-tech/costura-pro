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
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-clients-"));
	temporaryDirectories.push(directory);
	const database = createDb({ DATABASE_FILE: join(directory, "atelier.db") });
	openDatabases.push(database);
	applyMigrations(database);
	return getNativeDatabase(database);
}

type Native = Awaited<ReturnType<typeof migratedDatabase>>;

function columns(native: Native, table: string) {
	return native
		.query<{ name: string }, []>(
			`SELECT name FROM pragma_table_info('${table}')`
		)
		.all()
		.map((row) => row.name);
}

function insertChange(native: Native, aggregateId: string) {
	native.run(
		"INSERT INTO change_log (epoch, aggregate_type, aggregate_id, version, data, changed_at) VALUES ('e', 'client', ?, 1, '{\"name\":\"Maria\"}', 1)",
		[aggregateId]
	);
}

function redact(native: Native, aggregateId: string) {
	native.run(
		"INSERT INTO redacted_aggregate (aggregate_type, aggregate_id, op_id, redacted_at) VALUES ('client', ?, 'op', 1)",
		[aggregateId]
	);
}

describe("clients schema", () => {
	test("creates client, profile and redaction tables", async () => {
		const native = await migratedDatabase();
		expect(columns(native, "client")).toEqual(
			expect.arrayContaining([
				"id",
				"kind",
				"name",
				"phone",
				"secondary_phone",
				"email",
				"address",
				"notes",
				"search_text",
				"archived_at",
				"anonymized_at",
				"version",
			])
		);
		expect(columns(native, "client_profile")).toEqual(
			expect.arrayContaining([
				"id",
				"client_id",
				"name",
				"notes",
				"archived_at",
				"version",
			])
		);
		expect(columns(native, "redacted_aggregate")).toEqual(
			expect.arrayContaining([
				"aggregate_type",
				"aggregate_id",
				"op_id",
				"redacted_at",
			])
		);
	});

	test("a profile needs an existing client", async () => {
		const native = await migratedDatabase();
		expect(() =>
			native.run(
				"INSERT INTO client_profile (id, client_id, name, created_at, updated_at, version) VALUES ('p', 'missing', 'Helena', 1, 1, 1)"
			)
		).toThrow();
	});

	test("change_log accepts only a data rewrite of a redacted aggregate", async () => {
		const native = await migratedDatabase();
		insertChange(native, "c1");
		insertChange(native, "c2");
		expect(() =>
			native.run("UPDATE change_log SET data = '{}' WHERE aggregate_id = 'c1'")
		).toThrow("append-only fora da redação");
		redact(native, "c1");
		native.run("UPDATE change_log SET data = '{}' WHERE aggregate_id = 'c1'");
		expect(
			native
				.query<{ data: string }, []>(
					"SELECT data FROM change_log WHERE aggregate_id = 'c1'"
				)
				.get()?.data
		).toBe("{}");
		expect(() =>
			native.run("UPDATE change_log SET version = 2 WHERE aggregate_id = 'c1'")
		).toThrow("append-only fora da redação");
		expect(() =>
			native.run("UPDATE change_log SET data = '{}' WHERE aggregate_id = 'c2'")
		).toThrow("append-only fora da redação");
		expect(() =>
			native.run("DELETE FROM change_log WHERE aggregate_id = 'c1'")
		).toThrow("append-only");
	});

	test("a redacted change_log row keeps every column except data", async () => {
		const native = await migratedDatabase();
		insertChange(native, "c1");
		redact(native, "c1");
		for (const change of [
			"aggregate_id = 'c9'",
			"aggregate_type = 'profile'",
			"epoch = 'outra'",
			"op_id = 'op'",
			"changed_at = 2",
			"cursor = 99",
		]) {
			expect(() =>
				native.run(`UPDATE change_log SET ${change} WHERE aggregate_id = 'c1'`)
			).toThrow("append-only fora da redação");
		}
	});

	test("opens the database with secure_delete", async () => {
		const native = await migratedDatabase();
		expect(
			native.query<{ secure_delete: number }, []>("PRAGMA secure_delete").get()
				?.secure_delete
		).toBe(1);
	});

	test("keeps redacted_aggregate append-only", async () => {
		const native = await migratedDatabase();
		redact(native, "c1");
		expect(() =>
			native.run("UPDATE redacted_aggregate SET op_id = 'x'")
		).toThrow("append-only");
		expect(() => native.run("DELETE FROM redacted_aggregate")).toThrow(
			"append-only"
		);
	});
});
