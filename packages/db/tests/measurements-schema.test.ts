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
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-measurements-"));
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

describe("measurements schema", () => {
	test("creates the template and measurement tables with the profile index", async () => {
		const native = await migratedDatabase();
		expect(columns(native, "measurement_template")).toEqual(
			expect.arrayContaining([
				"id",
				"name",
				"fields",
				"archived_at",
				"created_at",
				"updated_at",
				"version",
			])
		);
		expect(columns(native, "measurement")).toEqual(
			expect.arrayContaining([
				"id",
				"profile_id",
				"template_id",
				"template_name",
				"template_version",
				"taken_on",
				"notes",
				"fields",
				"archived_at",
				"created_at",
				"updated_at",
				"version",
			])
		);
		expect(
			native
				.query<{ name: string }, []>(
					"SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'measurement_profile_idx'"
				)
				.all()
		).toHaveLength(1);
	});

	test("refuses a measurement whose profile or template does not exist", async () => {
		const native = await migratedDatabase();
		expect(() =>
			native.run(
				"INSERT INTO measurement (id, profile_id, template_id, template_name, template_version, taken_on, fields, created_at, updated_at, version) VALUES ('m', 'p', 't', 'Vestido', 1, '2026-09-17', '[]', 1, 1, 1)"
			)
		).toThrow();
	});
});
