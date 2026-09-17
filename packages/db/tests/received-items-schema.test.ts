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
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-received-"));
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

describe("received items and media schema", () => {
	test("creates received_item with the client index and media_file", async () => {
		const native = await migratedDatabase();
		expect(columns(native, "received_item").sort()).toEqual(
			[
				"accessories",
				"archived_at",
				"client_id",
				"condition",
				"created_at",
				"description",
				"expected_return_on",
				"id",
				"notes",
				"photos",
				"quantity",
				"received_on",
				"returned_on",
				"updated_at",
				"version",
			].sort()
		);
		expect(columns(native, "media_file").sort()).toEqual(
			["byte_size", "hash", "mime", "uploaded_at"].sort()
		);
		expect(
			native
				.query<{ name: string }, []>(
					"SELECT name FROM pragma_index_list('received_item')"
				)
				.all()
				.map((row) => row.name)
		).toContain("received_item_client_idx");
	});

	test("refuses a received item whose client does not exist", async () => {
		const native = await migratedDatabase();
		expect(() =>
			native.run(
				"INSERT INTO received_item (id, client_id, description, condition, quantity, photos, received_on, created_at, updated_at, version) VALUES ('i', 'sem-cliente', 'Vestido', 'good', 1, '[]', '2026-09-17', 0, 0, 1)"
			)
		).toThrow();
	});
});
