import { afterEach, describe, expect, test } from "bun:test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import {
	applyMigrations,
	closeDb,
	createDb,
	type Database,
	getNativeDatabase,
} from "../src/index";
import { productionFlow } from "../src/schema/production";
import { service } from "../src/schema/services";

const openDatabases: Database[] = [];
const temporaryDirectories: string[] = [];
const migrationsFolder = fileURLToPath(
	new URL("../src/migrations", import.meta.url)
);

const cutStage = "c0000000-0000-4000-8000-000000000001";
const fittingStage = "c0000000-0000-4000-8000-000000000003";

type ColumnInfo = {
	dflt_value: string | null;
	name: string;
	notnull: number;
};

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

async function temporaryDirectory() {
	const directory = await mkdtemp(join(tmpdir(), "costura-pro-production-"));
	temporaryDirectories.push(directory);
	return directory;
}

async function openDatabase() {
	const directory = await temporaryDirectory();
	const database = createDb({ DATABASE_FILE: join(directory, "atelier.db") });
	openDatabases.push(database);
	return database;
}

async function migratedDatabase() {
	const database = await openDatabase();
	applyMigrations(database);
	return database;
}

function columnsOf(database: Database, table: string) {
	return new Map(
		getNativeDatabase(database)
			.query<ColumnInfo, []>(
				`SELECT name, "notnull", dflt_value FROM pragma_table_info('${table}')`
			)
			.all()
			.map((column) => [
				column.name,
				{ defaultValue: column.dflt_value, notNull: column.notnull === 1 },
			])
	);
}

describe("production schema", () => {
	test("creates the production flow table with required columns", async () => {
		const database = await migratedDatabase();
		const columns = columnsOf(database, "production_flow");
		expect([...columns.keys()].sort()).toEqual([
			"created_at",
			"id",
			"stages",
			"updated_at",
			"version",
		]);
		for (const column of columns.values()) {
			expect(column.notNull).toBe(true);
		}
	});

	test("keeps the flow stages through the json column", async () => {
		const database = await migratedDatabase();
		const stages = [
			{ active: true, id: cutStage, name: "Corte" },
			{ active: false, id: fittingStage, name: "Prova" },
		];
		database
			.insert(productionFlow)
			.values({
				createdAt: new Date(0),
				id: "flow-1",
				stages,
				updatedAt: new Date(0),
				version: 1,
			})
			.run();
		const row = database
			.select()
			.from(productionFlow)
			.where(eq(productionFlow.id, "flow-1"))
			.get();
		expect(row?.stages).toEqual(stages);
	});

	test("adds production columns to the order, the item and the service", async () => {
		const database = await migratedDatabase();
		const item = columnsOf(database, "service_order_item");
		expect(item.get("production_status")).toEqual({
			defaultValue: "'notStarted'",
			notNull: true,
		});
		expect(item.get("stage_ids")).toEqual({
			defaultValue: null,
			notNull: false,
		});
		expect(item.get("stage_id")).toEqual({
			defaultValue: null,
			notNull: false,
		});
		const order = columnsOf(database, "service_order");
		expect(order.get("flow_version")).toEqual({
			defaultValue: null,
			notNull: false,
		});
		expect(order.get("flow_stages")).toEqual({
			defaultValue: null,
			notNull: false,
		});
		expect(columnsOf(database, "service").get("suggested_stage_ids")).toEqual({
			defaultValue: "'[]'",
			notNull: true,
		});
	});

	test("adds production columns to an existing installation without rebuilding tables", async () => {
		const database = await openDatabase();
		const earlier = await temporaryDirectory();
		await cp(migrationsFolder, earlier, { recursive: true });
		const journalFile = join(earlier, "meta", "_journal.json");
		const journal = JSON.parse(await readFile(journalFile, "utf8")) as {
			entries: { tag: string }[];
		};
		const cut = journal.entries.findIndex((entry) =>
			entry.tag.endsWith("_production_flow")
		);
		expect(cut).toBeGreaterThan(0);
		await writeFile(
			journalFile,
			JSON.stringify({ ...journal, entries: journal.entries.slice(0, cut) })
		);
		migrate(database, { migrationsFolder: earlier });
		const native = getNativeDatabase(database);
		const tableSql = (name: string) =>
			native
				.query<{ sql: string }, [string]>(
					"SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?"
				)
				.get(name)?.sql ?? "";
		const added = {
			service: [", `suggested_stage_ids` text DEFAULT '[]' NOT NULL"],
			service_order: [", `flow_stages` text", ", `flow_version` integer"],
			service_order_item: [
				", `production_status` text DEFAULT 'notStarted' NOT NULL",
				", `stage_id` text",
				", `stage_ids` text",
			],
		};
		const before = Object.fromEntries(
			Object.keys(added).map((name) => [name, tableSql(name)])
		);
		native.run(
			"INSERT INTO service (id, name, cost_cents, price_cents, outsourced, search_text, created_at, updated_at, version) VALUES ('service-1', 'Barra de calça', 6000, 9000, 0, 'barra de calca', 0, 0, 3)"
		);
		applyMigrations(database);
		expect(
			database
				.select({
					suggestedStageIds: service.suggestedStageIds,
					version: service.version,
				})
				.from(service)
				.where(eq(service.id, "service-1"))
				.get()
		).toEqual({ suggestedStageIds: [], version: 3 });
		for (const [name, definitions] of Object.entries(added)) {
			const after = tableSql(name);
			for (const definition of definitions) {
				expect(after).toContain(definition);
			}
			expect(
				definitions.reduce(
					(text, definition) => text.replace(definition, ""),
					after
				)
			).toBe(before[name] ?? "");
		}
	});
});
